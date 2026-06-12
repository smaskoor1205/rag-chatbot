import { ConversationRepository } from "../repositories/conversationRepository.js";
import { RagService } from "./ragService.js";

export class ChatService {
  constructor(
    private conversations = new ConversationRepository(),
    private rag = new RagService()
  ) {}

  async stream(input: { userId: string; message: string; conversationId?: string }, onToken: (token: string) => void) {
    const conversation = this.conversations.ensure(input.userId, input.conversationId, input.message.slice(0, 80));
    this.conversations.addMessage({ conversationId: conversation.id, role: "user", content: input.message });
    const history = this.conversations.messages(conversation.id, input.userId).map((message) => ({ role: message.role, content: message.content }));
    const citations = await this.rag.retrieve(input.message);
    let answer = "";
    for await (const token of this.rag.answer({ question: input.message, history, citations })) {
      answer += token;
      onToken(token);
    }
    this.conversations.addMessage({ conversationId: conversation.id, role: "assistant", content: answer, citations });
    return { conversationId: conversation.id, citations };
  }
}
