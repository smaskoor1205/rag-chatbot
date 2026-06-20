# Application Interface

The current app is a Streamlit application, so it does not expose a separate HTTP API.

Main entry point:

```text
app.py
```

Run locally:

```bash
streamlit run app.py
```

The UI provides:

- Document upload
- Local extraction and indexing
- Model path configuration
- Chat input
- Retrieved-section citations
- Local SQLite-backed chat history

The older React + Express API still exists under `client/` and `server/`, but it is not the primary app workflow.
