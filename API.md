# API

Base URL: `http://localhost:4000`

## Authentication

`POST /api/auth/register`

```json
{ "email": "user@example.com", "name": "User", "password": "Password123!" }
```

`POST /api/auth/login`

```json
{ "email": "admin@example.com", "password": "ChangeMe123!" }
```

Responses include `{ "user": ..., "token": "..." }`. Send the token as `Authorization: Bearer <token>`.

## Documents

`GET /api/documents` returns indexed documents visible to the user.

`POST /api/documents` accepts multipart form field `file` for PDF, DOCX, TXT, Markdown, HTML, and HTM.

## Chat

`GET /api/chat/conversations` returns recent conversations.

`GET /api/chat/conversations/:id/messages` returns conversation messages.

`POST /api/chat/stream`

```json
{ "message": "What does the policy say?", "conversationId": "optional-uuid" }
```

Streams server-sent events:

- `token`: partial assistant text
- `done`: conversation id and citations

## Admin

`GET /api/admin/stats` returns user, document, message, and health counts for admins.

## Health

`GET /health` and `GET /health/ready`.
