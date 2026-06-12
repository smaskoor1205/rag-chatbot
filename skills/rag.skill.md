# RAG Skill

- Chunking strategy: normalize documents, split by semantic boundaries, then enforce token-aware chunk size and overlap.
- Embedding strategy: OpenAI `text-embedding-3-small` with deterministic metadata and idempotent chunk identifiers.
- Retrieval strategy: query ChromaDB with embedding similarity and filter by tenant/user-accessible document metadata.
- Re-ranking: score retrieved chunks by similarity and query term overlap before prompt assembly.
- Prompt engineering: concise system prompts, grounded context blocks, and direct citation instructions.
- Hallucination prevention: answer only from retrieved context when sources exist and acknowledge insufficient evidence.
- Citations: attach document name, chunk id, source type, and excerpt references to every grounded response.
