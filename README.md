# Enterprise RAG Chatbot

A production-oriented Retrieval-Augmented Generation chatbot built with React, Vite, TailwindCSS, Express, TypeScript, LangChain JS, OpenAI, ChromaDB, SQLite, JWT auth, Docker, and GitHub Actions.

## Features

- ChatGPT-style authenticated UI
- PDF, DOCX, TXT, Markdown, and HTML ingestion
- Chunking, embeddings, ChromaDB indexing, and retrieval
- GPT-4o-mini grounded responses with source citations
- Streaming chat responses over server-sent events
- Conversation memory and chat history
- Admin dashboard and operational health endpoints
- SQLite repositories, service layer, strict TypeScript
- Docker Compose deployment and CI pipeline

## Quick Start

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173` and sign in with the admin account from `.env`.

## Local-first Streamlit Version

The Python `app.py` now implements a local-first document Q&A workflow inspired by the Mozilla.ai lightweight RAG blueprint. It uses PyMuPDF4LLM for document extraction and llama.cpp for local GGUF model inference.

```bash
pip install -r requirements.txt
streamlit run app.py
```

Download a local `.gguf` model into `models/`, then set the model path in the app sidebar. See `LOCAL_FIRST_RAG.md`.

## Python Quality Checks

```bash
pip install -r requirements-dev.txt
pre-commit install
pre-commit run --all-files
ruff format app.py tests
ruff check app.py tests
mypy app.py
pytest
```

## Commands

```bash
npm install
npm run dev
npm run build
npm run test
npm run ingest -- -f ./docs/example.txt
docker compose up
```

## Environment

Set `OPENAI_API_KEY` for embeddings and generation. Without it, the application still runs and clearly reports that generation is disabled.
