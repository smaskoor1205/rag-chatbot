import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { DocumentRepository } from "../repositories/documentRepository.js";
import { UserRepository } from "../repositories/userRepository.js";
import { ConversationRepository } from "../repositories/conversationRepository.js";

const router = Router();
const users = new UserRepository();
const documents = new DocumentRepository();
const conversations = new ConversationRepository();

router.get("/stats", requireAuth, requireAdmin, (_req, res) => {
  res.json({
    users: users.count(),
    documents: documents.count(),
    messages: conversations.countMessages(),
    status: "operational"
  });
});

export { router as adminRoutes };
