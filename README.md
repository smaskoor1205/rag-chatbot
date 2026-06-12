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
