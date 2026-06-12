import fs from "node:fs";
import { DocumentRepository } from "../repositories/documentRepository.js";
import { parseDocument } from "./documentParser.js";
import { ChunkService } from "./chunkService.js";
import { VectorStoreService } from "./vectorStoreService.js";

export class IngestionService {
  constructor(
    private documents = new DocumentRepository(),
    private chunks = new ChunkService(),
    private vectors = new VectorStoreService()
  ) {}

  async ingest(input: { ownerId: string; name: string; mimeType: string; path: string }) {
    if (!fs.existsSync(input.path)) throw new Error(`File does not exist: ${input.path}`);
    const document = this.documents.create(input);
    const text = await parseDocument(input.path, input.mimeType);
    const chunks = this.chunks.split(text).map((chunk) => ({
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      metadata: {
        documentId: document.id,
        documentName: document.name,
        ownerId: document.owner_id,
        sourceType: document.mime_type,
        index: chunk.index
      }
    }));
    const rows = this.documents.replaceChunks(document.id, chunks);
    await this.vectors.upsert(
      "rag_documents",
      rows.map((row) => ({
        id: row.id,
        content: row.content,
        metadata: {
          documentId: document.id,
          documentName: document.name,
          chunkId: row.id,
          ownerId: document.owner_id,
          sourceType: document.mime_type
        }
      }))
    );
    return { ...document, status: "indexed" as const, chunk_count: rows.length };
  }
}
