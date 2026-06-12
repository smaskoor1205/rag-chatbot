import { ChromaClient } from "chromadb";
import { OpenAIEmbeddings } from "@langchain/openai";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import type { Citation } from "../types.js";

interface StoredChunk {
  id: string;
  content: string;
  metadata: {
    documentId: string;
    documentName: string;
    chunkId: string;
    ownerId: string;
    sourceType: string;
  };
}

export class VectorStoreService {
  private client = new ChromaClient({ path: env.CHROMA_URL });
  private embeddings = env.OPENAI_API_KEY
    ? new OpenAIEmbeddings({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_EMBEDDING_MODEL })
    : undefined;

  async upsert(collectionName: string, chunks: StoredChunk[]): Promise<void> {
    if (!this.embeddings) {
      logger.warn("OPENAI_API_KEY is not configured; skipping vector upsert");
      return;
    }
    const collection = await this.client.getOrCreateCollection({ name: collectionName });
    const embeddings = await this.embeddings.embedDocuments(chunks.map((chunk) => chunk.content));
    await collection.upsert({
      ids: chunks.map((chunk) => chunk.id),
      documents: chunks.map((chunk) => chunk.content),
      embeddings,
      metadatas: chunks.map((chunk) => chunk.metadata)
    });
  }

  async search(collectionName: string, query: string, limit = 5): Promise<Citation[]> {
    if (!this.embeddings) return [];
    const collection = await this.client.getOrCreateCollection({ name: collectionName });
    const embedding = await this.embeddings.embedQuery(query);
    const result = await collection.query({ queryEmbeddings: [embedding], nResults: limit });
    const documents = result.documents?.[0] || [];
    const metadatas = result.metadatas?.[0] || [];
    const distances = result.distances?.[0] || [];
    return documents.map((doc, index) => {
      const meta = metadatas[index] as StoredChunk["metadata"];
      return {
        documentId: meta.documentId,
        documentName: meta.documentName,
        chunkId: meta.chunkId,
        excerpt: String(doc).slice(0, 500),
        score: 1 - Number(distances[index] || 0)
      };
    });
  }
}
