# Streamlit Deployment

This repository includes a Streamlit version for Streamlit Cloud.

## Required Files

- `app.py`
- `requirements.txt`
- `.streamlit/config.toml`

## Local Run

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Streamlit Cloud

1. Push this repository to GitHub.
2. Open Streamlit Cloud.
3. Create a new app from `smaskoor1205/rag-chatbot`.
4. Set main file path to `app.py`.
5. Add these secrets:

```toml
OPENAI_API_KEY = "your-openai-api-key"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "ChangeMe123!"
```

6. Deploy.

The app stores SQLite data, uploaded files, and Chroma vectors under `streamlit_data/`.
