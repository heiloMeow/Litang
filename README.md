# Dungeon Scribe: AI Dungeon Master Memory Engine

An offline tool that records and transcribes RPG sessions, automatically organizing key narrative elements into a searchable memory system for Dungeon Masters.

## Overview

Dungeon Scribe solves campaign continuity problems by capturing game sessions, filtering out irrelevant chatter, and structuring events, NPCs, locations, and quests into a persistent memory graph. Dungeon Masters can browse timelines, query campaign details, and retrieve summaries while maintaining full creative control.

## Key Features

- **Local Recording & Transcription**: Speech-to-text conversion using Whisper with speaker identification
- **Intelligent Filtering**: Distinguishes narrative content from dice rolls and rule discussions
- **Memory Graph**: Organizes events, characters, locations, and quests into searchable structures
- **Web Interface**: Timeline browsing, content filtering, and graph visualization
- **Privacy-First**: Fully offline operation with local data storage

## Technology Stack

- **Audio Processing**: Pyannote.audio + OpenAI Whisper
- **Database**: SQLite + Chroma vector store
- **NLP**: Transformers + Local LLM for event recognition
- **Frontend**: React + Vite with Cytoscape.js for visualization

## Team

**Team Litang** - University of Queensland DECO3801 Project
- Yutong Wu, Yuxin Qin - Web Development
- Boyu Chen, Shicheng Zhou - Audio Processing  
- Qiao Xu - Natural Language Processing
- Chang Guo - Database Architecture