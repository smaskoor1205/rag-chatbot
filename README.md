# Local-first RAG Chatbot

A local-first Retrieval-Augmented Generation chatbot built with Streamlit, PyMuPDF4LLM, llama.cpp, SQLite, and local GGUF models. The older React + Node implementation is still present in `client/` and `server/`, but the main app is now `app.py`.

## Features

- No-login Streamlit UI
- PDF, DOCX, TXT, Markdown, and HTML document ingestion
- Structured extraction with PyMuPDF4LLM
- Heading-aware section splitting
- Local section retrieval
- Local llama.cpp GGUF model answers
- Source-style retrieved-section citations
- Conversation memory and chat history
- SQLite persistence
- Ruff, mypy, pytest, and pre-commit quality checks

## Quick Start

```bash
pip install -r requirements.txt
streamlit run app.py
```

Open the local Streamlit URL shown in the terminal. The app opens directly with no login.

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
pip install -r requirements.txt
streamlit run app.py
pip install -r requirements-dev.txt
pre-commit run --all-files
pytest
mypy app.py
```

## Environment

No OpenAI key is required for the local-first Streamlit workflow. Add a local `.gguf` model under `models/`, then set the model path in the app sidebar.
