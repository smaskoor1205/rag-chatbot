# Streamlit / Local-first Deployment

This repository includes a Streamlit app in `app.py`, but the current workflow is local-first and uses llama.cpp with a local GGUF model.

## Required Files

- `app.py`
- `requirements.txt`
- `.streamlit/config.toml`

## Local Run Recommended

```bash
pip install -r requirements.txt
streamlit run app.py
```

Place a GGUF model under `models/`, then set the model path in the sidebar.

## Streamlit Cloud Note

Streamlit Cloud is not ideal for this local-first version because GGUF model files are large and llama.cpp inference needs local CPU/RAM resources. Use local Streamlit, Docker, Codespaces, or a VM where you can store the model file.

Optional secrets:

```toml
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "ChangeMe123!"
LLAMA_MODEL_PATH = "models/qwen2.5-7b-instruct-q4_k_m.gguf"
LLAMA_N_CTX = "8192"
LLAMA_N_THREADS = "8"
```

The app stores SQLite data and uploaded files under `local_rag_data/`.
