# Deployment

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Services:

- `app`: Express server serving the built React client and API.
- `chroma`: ChromaDB vector database.

Persistent volumes are mounted for SQLite data, uploads, vector data, and logs.

## Production Checklist

- Replace `JWT_SECRET` with a long random value.
- Set `OPENAI_API_KEY`.
- Change `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
- Restrict `CLIENT_ORIGIN` to the deployed UI URL.
- Back up `data/`, `uploads/`, and `vectorstore/` together.
- Put TLS, request size limits, and WAF/CDN controls in front of the service.
- Review logs and health endpoints in your monitoring system.
