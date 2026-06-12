import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { ChatService } from "../services/chatService.js";
import { ConversationRepository } from "../repositories/conversationRepository.js";

const router = Router();
const chat = new ChatService();
const conversations = new ConversationRepository();
const chatSchema = z.object({ message: z.string().min(1).max(8000), conversationId: z.string().uuid().optional() });

router.get("/conversations", requireAuth, (req, res) => {
  res.json({ conversations: conversations.list(req.user!.id) });
});

router.get("/conversations/:id/messages", requireAuth, (req, res) => {
  res.json({ messages: conversations.messages(String(req.params.id), req.user!.id) });
});

router.post("/stream", requireAuth, async (req, res, next) => {
  try {
    const body = chatSchema.parse(req.body);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    const result = await chat.stream({ userId: req.user!.id, message: body.message, conversationId: body.conversationId }, (token) => {
      res.write(`event: token\ndata: ${JSON.stringify({ token })}\n\n`);
    });
    res.write(`event: done\ndata: ${JSON.stringify(result)}\n\n`);
    res.end();
  } catch (error) {
    next(error);
  }
});

export { router as chatRoutes };
