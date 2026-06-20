# Architecture

## Current Main App

The main application is `app.py`, a local-first Streamlit document Q&A app.

## Components

- Streamlit UI: upload documents, configure local model path, ask questions, inspect retrieved sections.
- Document extraction: `PyMuPDF4LLM` for PDFs, `python-docx` for DOCX, BeautifulSoup for HTML, plain text for TXT/MD.
- Sectioning: Markdown headings are used to split content into meaningful sections.
- Retrieval: local lexical scoring selects the most relevant sections for the question.
- Generation: `llama-cpp-python` runs a local GGUF model through llama.cpp.
- Persistence: SQLite stores documents, sections, conversations, and messages.
- Quality checks: Ruff, pytest, mypy, and pre-commit validate Python code.

## Flow

```text
Upload document
-> Extract structured text
-> Split into sections
-> Store sections in SQLite
-> Ask question
-> Retrieve matching sections
-> Send context to local GGUF model
-> Show answer and citations
```

## Local-first Design

- No OpenAI key required.
- No Docker required.
- No login required.
- No cloud vector database required.
- Documents and indexes stay on the local machine.

The older React + Node implementation remains in `client/` and `server/` for reference, but the active app is the Streamlit workflow.
