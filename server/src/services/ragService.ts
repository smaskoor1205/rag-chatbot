import { ChatOpenAI } from "@langchain/openai";
import type { BaseMessage } from "@langchain/core/messages";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { env } from "../config/env.js";
import type { Citation } from "../types.js";
import { VectorStoreService } from "./vectorStoreService.js";

export class RagService {
  private model = env.OPENAI_API_KEY
    ? new ChatOpenAI({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_CHAT_MODEL, temperature: 0.2, streaming: true })
    : undefined;

  constructor(private vectors = new VectorStoreService()) {}

  async retrieve(question: string): Promise<Citation[]> {
    const citations = await this.vectors.search("rag_documents", question, 6);
    const terms = new Set(question.toLowerCase().split(/\W+/).filter((term) => term.length > 3));
    return citations
      .map((citation) => ({
        ...citation,
        score: citation.score + citation.excerpt.toLowerCase().split(/\W+/).filter((term) => terms.has(term)).length * 0.03
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  async *answer(input: { question: string; history: Array<{ role: string; content: string }>; citations: Citation[] }): AsyncGenerator<string> {
    if (!this.model) {
      yield "OpenAI is not configured. Add OPENAI_API_KEY to enable grounded generation.";
      return;
    }
    const context = input.citations.map((c, i) => `[${i + 1}] ${c.documentName} (${c.chunkId})\n${c.excerpt}`).join("\n\n");
    const messages: BaseMessage[] = [
      new SystemMessage(
        "You are an enterprise RAG assistant. Answer with concise, grounded language. Use only supplied context when it is relevant. Cite sources inline as [1], [2]. If evidence is missing, say what is missing."
      ),
      new SystemMessage(`Retrieved context:\n${context || "No context retrieved."}`),
      ...input.history.slice(-8).map((message) => (message.role === "assistant" ? new AIMessage(message.content) : new HumanMessage(message.content))),
      new HumanMessage(input.question)
    ];
    const stream = await this.model.stream(messages);
    for await (const chunk of stream) {
      const text = typeof chunk.content === "string" ? chunk.content : "";
      if (text) yield text;
    }
  }
}
