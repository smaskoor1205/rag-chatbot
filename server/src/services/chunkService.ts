export interface TextChunk {
  content: string;
  tokenCount: number;
  index: number;
}

export class ChunkService {
  split(text: string, size = 900, overlap = 140): TextChunk[] {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks: TextChunk[] = [];
    let start = 0;
    while (start < words.length) {
      const slice = words.slice(start, start + size);
      chunks.push({ content: slice.join(" "), tokenCount: slice.length, index: chunks.length });
      if (start + size >= words.length) break;
      start += size - overlap;
    }
    return chunks;
  }
}
