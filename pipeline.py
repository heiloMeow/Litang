# -*- coding: utf-8 -*-
"""
pipeline_fixed_v3.py
- 本地离线多说话人语音转文字（Whisper + 说话人嵌入）
- 模式：实时 / 离线音频文件
- 修复点：Windows ffmpeg 调用、说话人嵌入返回类型统一、输入维度 (B,C,T)、聚类前 L2 归一
- 增强：自动创建按时间戳分目录保存 transcript（TXT+JSON）
"""

import os
import sys
import json
import time
import queue
import subprocess
from shutil import which
from dataclasses import dataclass, asdict
from pathlib import Path

import numpy as np

# -----------------------
# 依赖加载（尽量容错）
# -----------------------
def _safe_import():
    try:
        import torch
    except Exception:
        os.system(sys.executable + " -m pip install --upgrade torch -q")
        import torch

    try:
        import whisper
    except Exception:
        os.system(sys.executable + " -m pip install openai-whisper -q")
        import whisper

    try:
        from pyannote.audio import Audio
        from pyannote.core import Segment
        from pyannote.audio.pipelines.speaker_verification import PretrainedSpeakerEmbedding
    except Exception:
        os.system(sys.executable + " -m pip install pyannote.audio -q")
        from pyannote.audio import Audio
        from pyannote.core import Segment
        from pyannote.audio.pipelines.speaker_verification import PretrainedSpeakerEmbedding

    try:
        from sklearn.cluster import KMeans
        from sklearn.preprocessing import normalize
    except Exception:
        os.system(sys.executable + " -m pip install scikit-learn -q")
        from sklearn.cluster import KMeans
        from sklearn.preprocessing import normalize

    # 录音优先 sounddevice；失败退回 pyaudio
    sd = None
    pa = None
    try:
        import sounddevice as _sd
        sd = _sd
    except Exception:
        try:
            import pyaudio as _pa
            pa = _pa
        except Exception:
            os.system(sys.executable + " -m pip install pyaudio -q")
            import pyaudio as _pa
            pa = _pa

    try:
        from tqdm import tqdm
    except Exception:
        os.system(sys.executable + " -m pip install tqdm -q")
        from tqdm import tqdm

    return whisper, torch, Audio, Segment, PretrainedSpeakerEmbedding, KMeans, normalize, sd, pa, tqdm

whisper, torch, Audio, Segment, PretrainedSpeakerEmbedding, KMeans, normalize, sd, pa, tqdm = _safe_import()

# -----------------------
# 配置
# -----------------------
SAMPLE_RATE = 16000
CHANNELS = 1
FFMPEG_BIN = which("ffmpeg") or "ffmpeg"  # 自动定位 ffmpeg

DEFAULT_WHISPER_OFFLINE = "medium"  # 离线文件识别默认模型（精度更高）
DEFAULT_WHISPER_REALTIME = "small"  # 实时识别默认模型（延迟更低）

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# -----------------------
# 数据结构
# -----------------------
@dataclass
class Utterance:
    speaker: str
    start: float
    end: float
    text: str

# -----------------------
# 工具函数
# -----------------------
def ensure_wav_16k_mono(path: str) -> str:
    """
    若输入不是 wav 或采样率/声道不合要求，用 ffmpeg 转 16kHz mono wav
    使用 subprocess.run(list) 避免 Windows 引号问题
    """
    if path.lower().endswith(".wav"):
        return path
    out = "converted_temp.wav"
    cmd = [FFMPEG_BIN, "-y", "-i", path, "-ac", "1", "-ar", str(SAMPLE_RATE), out]
    print(f"[FFmpeg] 转换音频: {' '.join(cmd)}")
    subprocess.run(cmd, check=True, shell=False)
    return out

def to_waveform_tensor(x) -> torch.Tensor:
    """
    将 numpy/torch waveform 统一为 (1, T) float32, 幅度在 [-1, 1]
    """
    if isinstance(x, np.ndarray):
        wav = torch.from_numpy(x)
    else:
        wav = x

    if wav.ndim == 1:
        pass
    elif wav.ndim == 2:
        # (C, T) -> 单声道取第一通道
        if wav.shape[0] > 1:
            wav = wav[0]
        else:
            wav = wav.squeeze(0)
    else:
        wav = wav.view(-1)

    wav = wav.to(torch.float32)
    # 若像 int16 刻度则归一
    if wav.abs().max() > 1.5:
        wav = wav / 32768.0
    return wav.unsqueeze(0)  # (1, T)

def _ensure_numpy_1d(emb) -> np.ndarray:
    """
    将说话人嵌入统一为 1D numpy 向量：
    - 兼容 torch.Tensor / numpy.ndarray / 列表
    - 去掉 batch 维 / 通道维（若有）
    """
    if isinstance(emb, torch.Tensor):
        emb = emb.detach().cpu().numpy()
    else:
        emb = np.asarray(emb)
    emb = np.squeeze(emb)
    if emb.ndim != 1:
        emb = emb.reshape(-1)
    return emb

def make_session_dir(prefix: str) -> Path:
    ts = time.strftime("%Y%m%d_%H%M%S")
    out_dir = Path("outputs") / f"{prefix}_{ts}"
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir

def save_transcript_txt_json(utterances, out_dir: Path, base_name: str):
    txt_path = out_dir / f"{base_name}.txt"
    json_path = out_dir / f"{base_name}.json"

    # TXT（按说话人连续输出）
    with open(txt_path, "w", encoding="utf-8") as f:
        last_spk = None
        for u in utterances:
            if u.speaker != last_spk:
                f.write(f"\n{u.speaker} [{u.start:.2f}s - {u.end:.2f}s]:\n")
                last_spk = u.speaker
            f.write(u.text.strip() + " ")

    # JSON（结构化）
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump([asdict(u) for u in utterances], f, ensure_ascii=False, indent=2)

    print(f"[保存] TXT -> {txt_path}")
    print(f"[保存] JSON -> {json_path}")

# -----------------------
# Whisper 转录
# -----------------------
def load_whisper(model_size: str):
    print(f"[Whisper] 加载模型: {model_size}  (device={DEVICE})")
    return whisper.load_model(model_size, device=str(DEVICE))

def transcribe_file(whisper_model, wav_path: str):
    """
    返回 whisper 的 segments 列表：每个包含 start, end, text
    """
    print("[Whisper] 开始转录（文件）...")
    result = whisper_model.transcribe(wav_path, fp16=(DEVICE.type == "cuda"), language="en")
    segments = result.get("segments", [])
    print(f"[Whisper] 转录完成，片段数：{len(segments)}")
    return segments

def transcribe_numpy(whisper_model, audio_np: np.ndarray):
    """
    实时模式：对 numpy waveform (float32, 16k) 做转写
    """
    result = whisper_model.transcribe(audio_np, fp16=(DEVICE.type == "cuda"))
    return result.get("text", "").strip()

# -----------------------
# 说话人嵌入与聚类
# -----------------------
class SpeakerEmbedder:
    def __init__(self, device=DEVICE):
        print("[Embedding] 加载 SpeechBrain ECAPA 说话人嵌入模型...")
        self.model = PretrainedSpeakerEmbedding("speechbrain/spkrec-ecapa-voxceleb", device=device)
        self.audio_loader = Audio(sample_rate=SAMPLE_RATE)
        self.device = device

    def embed_segment_from_file(self, file_path: str, start: float, end: float) -> np.ndarray:
        """ 对音频文件的 [start, end] 片段提取嵌入 -> 返回 1D numpy 向量 """
        segment_audio, sr = self.audio_loader.crop(file_path, Segment(start, end))
        waveform = to_waveform_tensor(segment_audio).unsqueeze(1).to(self.device)  # (1,1,T)
        with torch.no_grad():
            emb = self.model(waveform)  # 可能返回 torch.Tensor 或 numpy.ndarray
        return _ensure_numpy_1d(emb)

    def embed_waveform(self, waveform_np: np.ndarray) -> np.ndarray:
        """ 对 numpy waveform 提取嵌入（实时） -> 返回 1D numpy 向量 """
        waveform = to_waveform_tensor(waveform_np).unsqueeze(1).to(self.device)    # (1,1,T)
        with torch.no_grad():
            emb = self.model(waveform)  # 可能返回 torch.Tensor 或 numpy.ndarray
        return _ensure_numpy_1d(emb)

def cluster_speakers(embeddings: np.ndarray, n_speakers: int) -> np.ndarray:
    """
    用 KMeans 聚类（对嵌入做 L2 归一，等价近似余弦相似）
    返回 labels（0..n_speakers-1）
    """
    if embeddings.ndim != 2 or embeddings.shape[0] == 0:
        return np.array([])
    from sklearn.preprocessing import normalize
    emb_norm = normalize(embeddings)
    from sklearn.cluster import KMeans
    kmeans = KMeans(n_clusters=n_speakers, n_init=10, random_state=0)
    labels = kmeans.fit_predict(emb_norm)
    return labels

# -----------------------
# 离线文件流程
# -----------------------
def process_offline(num_speakers: int):
    # 选择文件
    try:
        import tkinter as tk
        from tkinter import filedialog
        tk.Tk().withdraw()
        path = filedialog.askopenfilename(
            title="选择音频文件",
            filetypes=[("Audio", "*.wav *.mp3 *.ogg *.flac *.m4a"), ("All files", "*.*")]
        )
    except Exception:
        path = input("请输入音频文件路径: ").strip()

    if not path:
        print("未选择音频文件。")
        return

    try:
        wav_path = ensure_wav_16k_mono(path)
    except subprocess.CalledProcessError as e:
        print(f"[FFmpeg] 转换失败：{e}. 请确认 FFmpeg 已安装并在 PATH 中。")
        return

    # 输出会话目录
    base_name = Path(path).stem
    out_dir = make_session_dir(prefix=f"offline_{base_name}")

    # Whisper 转录
    whisper_model = load_whisper(DEFAULT_WHISPER_OFFLINE)
    segments = transcribe_file(whisper_model, wav_path)

    # 提取每个片段的嵌入
    embedder = SpeakerEmbedder(device=DEVICE)
    from tqdm import tqdm
    embeddings = []
    ok_mask = []
    for seg in tqdm(segments, desc="提取嵌入"):
        start, end = seg["start"], seg["end"]
        try:
            emb = embedder.embed_segment_from_file(wav_path, start, end)
            embeddings.append(emb)
            ok_mask.append(True)
        except Exception as e:
            # 极短片段或异常时标记失败
            embeddings.append(None)
            ok_mask.append(False)

    # 将失败的片段用小噪声向量兜底，避免聚类崩溃
    if any(e is None for e in embeddings):
        D = next((len(e) for e in embeddings if e is not None), 192)
        for i, e in enumerate(embeddings):
            if e is None:
                embeddings[i] = np.random.normal(0, 1e-6, size=(D,))
    embeddings = np.vstack(embeddings) if embeddings else np.zeros((0, 192), dtype=np.float32)

    # 聚类分配说话人
    labels = cluster_speakers(embeddings, num_speakers)
    utterances = []
    for i, seg in enumerate(segments):
        spk = f"Speaker_{int(labels[i]) + 1}" if labels.size else "Speaker_1"
        utterances.append(Utterance(
            speaker=spk,
            start=float(seg["start"]),
            end=float(seg["end"]),
            text=seg["text"].strip()
        ))

    # 按时间排序并保存
    utterances.sort(key=lambda u: u.start)
    save_transcript_txt_json(utterances, out_dir=out_dir, base_name="transcript")
    print("[完成] 离线文件处理完成。输出目录：", out_dir)

# -----------------------
# 实时流程（含声纹登记）
# -----------------------
def record_reference_embeddings(n_speakers: int, seconds_per_speaker: int = 3):
    """
    声纹登记：逐个玩家说话 N 秒，获取参考嵌入
    使用 sounddevice（优先）或 pyaudio。
    """
    embedder = SpeakerEmbedder(device=DEVICE)
    refs = []
    if sd is not None:
        print("[登记] 使用 sounddevice 录音。")
        for i in range(1, n_speakers + 1):
            print(f"请 Speaker_{i} 开始说话 {seconds_per_speaker} 秒...")
            rec = sd.rec(int(seconds_per_speaker * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=CHANNELS)
            sd.wait()
            w = rec.flatten().astype(np.float32)
            emb = embedder.embed_waveform(w)
            refs.append(emb)
            print(f"Speaker_{i} 登记完成。")
    else:
        print("[登记] 使用 pyaudio 录音。")
        p = pa.PyAudio()
        stream = p.open(format=pa.paInt16, channels=CHANNELS, rate=SAMPLE_RATE, input=True, frames_per_buffer=1024)
        for i in range(1, n_speakers + 1):
            print(f"请 Speaker_{i} 开始说话 {seconds_per_speaker} 秒...")
            frames = []
            for _ in range(int(SAMPLE_RATE / 1024 * seconds_per_speaker)):
                frames.append(stream.read(1024))
            buf = b"".join(frames)
            w = (np.frombuffer(buf, dtype=np.int16).astype(np.float32) / 32768.0)
            emb = embedder.embed_waveform(w)
            refs.append(emb)
            print(f"Speaker_{i} 登记完成。")
        stream.stop_stream()
        stream.close()
        p.terminate()
    return np.vstack(refs) if refs else np.zeros((0, 192), dtype=np.float32)

def cosine_argmax(x: np.ndarray, mat: np.ndarray) -> int:
    """
    在参考矩阵 mat (N,D) 中找到与向量 x (D,) 余弦相似度最大的行索引
    """
    if mat.size == 0:
        return 0
    x_norm = x / (np.linalg.norm(x) + 1e-9)
    mat_norm = mat / (np.linalg.norm(mat, axis=1, keepdims=True) + 1e-9)
    sims = mat_norm @ x_norm
    return int(np.argmax(sims))

def process_realtime(num_speakers: int):
    """
    实时录音 -> 片段 -> Whisper 转写 -> 参考嵌入最近邻匹配 -> 实时打印 + 保存（会后一次性写出）
    简单能量阈值做 VAD；需要更强 VAD 可改 webrtcvad（需另装）。
    """
    out_dir = make_session_dir(prefix="live")

    print("[实时] 声纹登记开始（可跳过输入 0）")
    try:
        sec = input("每位玩家登记时长（秒，默认3，输入0跳过）：").strip()
        sec = int(sec) if sec else 3
    except Exception:
        sec = 3
    ref_embs = None
    if sec > 0:
        ref_embs = record_reference_embeddings(num_speakers, seconds_per_speaker=sec)
    else:
        print("跳过登记：不进行说话人匹配，仅按默认 Speaker_1 输出。")

    model = load_whisper(DEFAULT_WHISPER_REALTIME)
    embedder = SpeakerEmbedder(device=DEVICE)

    utterances = []
    print("[实时] 开始监听麦克风（Ctrl+C 停止）")
    energy_threshold = 0.015  # 对 sounddevice 浮点流
    min_chunk_sec = 0.8
    max_chunk_sec = 8.0
    silence_hang_sec = 0.4

    if sd is not None:
        # 使用 sounddevice 回调
        q = queue.Queue()

        def callback(indata, frames, ctime, status):
            if status:
                pass
            q.put(indata.copy())

        with sd.InputStream(callback=callback, channels=CHANNELS, samplerate=SAMPLE_RATE, dtype='float32'):
            buf = []
            last_voice_t = None
            start_t = time.time()

            try:
                while True:
                    chunk = q.get()
                    rms = float(np.sqrt(np.mean(chunk ** 2)))
                    now = time.time()
                    if rms > energy_threshold:
                        buf.append(chunk.copy())
                        last_voice_t = now
                        dur = len(np.concatenate(buf, axis=0)) / SAMPLE_RATE
                        if dur >= max_chunk_sec:
                            audio_np = np.concatenate(buf, axis=0).flatten()
                            text = transcribe_numpy(model, audio_np)
                            if text:
                                spk = "Speaker_1"
                                if ref_embs is not None and ref_embs.size > 0:
                                    emb = embedder.embed_waveform(audio_np)
                                    idx = cosine_argmax(emb, ref_embs)
                                    spk = f"Speaker_{idx+1}"
                                print(f"{spk}: {text}")
                                utterances.append(Utterance(spk, start=now - dur - start_t, end=now - start_t, text=text))
                            buf = []
                            last_voice_t = None
                    else:
                        if buf and last_voice_t and (now - last_voice_t) >= silence_hang_sec:
                            audio_np = np.concatenate(buf, axis=0).flatten()
                            dur = len(audio_np) / SAMPLE_RATE
                            if dur >= min_chunk_sec:
                                text = transcribe_numpy(model, audio_np)
                                if text:
                                    spk = "Speaker_1"
                                    if ref_embs is not None and ref_embs.size > 0:
                                        emb = embedder.embed_waveform(audio_np)
                                        idx = cosine_argmax(emb, ref_embs)
                                        spk = f"Speaker_{idx+1}"
                                    print(f"{spk}: {text}")
                                    utterances.append(Utterance(spk, start=now - dur - start_t, end=now - start_t, text=text))
                            buf = []
                            last_voice_t = None
            except KeyboardInterrupt:
                print("\n[实时] 停止。")
    else:
        # 使用 pyaudio 主动读流（int16）
        p = pa.PyAudio()
        stream = p.open(format=pa.paInt16, channels=CHANNELS, rate=SAMPLE_RATE, input=True, frames_per_buffer=1024)
        buf = b""
        last_voice_t = None
        start_t = time.time()
        int16_energy_thresh = 500  # 简单阈值

        try:
            while True:
                data = stream.read(1024)
                s = np.frombuffer(data, dtype=np.int16).astype(np.float32)
                rms = float(np.sqrt(np.mean(s ** 2)))
                now = time.time()

                if rms > int16_energy_thresh:
                    buf += data
                    last_voice_t = now
                    dur = len(buf) / 2 / SAMPLE_RATE  # 2字节/int16
                    if dur >= max_chunk_sec:
                        audio_np = (np.frombuffer(buf, dtype=np.int16).astype(np.float32) / 32768.0)
                        text = transcribe_numpy(model, audio_np)
                        if text:
                            spk = "Speaker_1"
                            if ref_embs is not None and ref_embs.size > 0:
                                emb = embedder.embed_waveform(audio_np)
                                idx = cosine_argmax(emb, ref_embs)
                                spk = f"Speaker_{idx+1}"
                            print(f"{spk}: {text}")
                            utterances.append(Utterance(spk, start=now - dur - start_t, end=now - start_t, text=text))
                        buf = b""
                        last_voice_t = None
                else:
                    if buf and last_voice_t and (now - last_voice_t) >= 0.35:
                        audio_np = (np.frombuffer(buf, dtype=np.int16).astype(np.float32) / 32768.0)
                        dur = len(audio_np) / SAMPLE_RATE
                        if dur >= min_chunk_sec:
                            text = transcribe_numpy(model, audio_np)
                            if text:
                                spk = "Speaker_1"
                                if ref_embs is not None and ref_embs.size > 0:
                                    emb = embedder.embed_waveform(audio_np)
                                    idx = cosine_argmax(emb, ref_embs)
                                    spk = f"Speaker_{idx+1}"
                                print(f"{spk}: {text}")
                                utterances.append(Utterance(spk, start=now - dur - start_t, end=now - start_t, text=text))
                        buf = b""
                        last_voice_t = None
        except KeyboardInterrupt:
            print("\n[实时] 停止。")
        finally:
            stream.stop_stream()
            stream.close()
            p.terminate()

    # 保存这次实时会话
    utterances.sort(key=lambda u: u.start)
    save_transcript_txt_json(utterances, out_dir=out_dir, base_name="transcript_live")
    print("[完成] 实时会话保存完成。输出目录：", out_dir)

# -----------------------
# 主入口
# -----------------------
def main():
    try:
        n = int(input("请输入玩家/说话者人数: ").strip() or "2")
    except Exception:
        n = 2
    mode = input("选择模式: 输入 '1' 表示实时录音转写，输入 '2' 表示分析已有音频文件: ").strip()
    if mode == "2":
        process_offline(n)
    elif mode == "1":
        process_realtime(n)
    else:
        print("无效选择。")

if __name__ == "__main__":
    main()
