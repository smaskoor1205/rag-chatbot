# Architecture

## Layers

- Client: React components, hooks, typed API client, Tailwind UI.
- Routes: Express routers define HTTP boundaries.
- Middleware: auth, upload validation, logging, rate limiting, error handling.
- Services: authentication, ingestion, chunking, vector storage, RAG, chat orchestration.
- Repositories: SQLite persistence for users, documents, chunks, conversations, and messages.
- Infrastructure: ChromaDB for vectors, OpenAI for embeddings and generation, Docker for runtime.

## Patterns

- Service Layer Pattern keeps business logic outside routes.
- Repository Pattern isolates SQLite queries.
- SOLID-oriented classes use constructor dependencies for testability.
- Strict TypeScript is enabled in both client and server.

## RAG Flow

1. User uploads a supported document.
2. Server parses text and normalizes content.
3. Chunk service creates overlapping chunks.
4. Chunks are stored in SQLite and embedded with `text-embedding-3-small`.
5. Embeddings are upserted to ChromaDB with citation metadata.
6. Chat queries retrieve relevant chunks, lightly re-rank them, and stream a GPT-4o-mini answer with citations.
