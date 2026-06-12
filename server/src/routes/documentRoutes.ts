import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { DocumentRepository } from "../repositories/documentRepository.js";
import { IngestionService } from "../services/ingestionService.js";
import { AppError } from "../utils/errors.js";

const router = Router();
const documents = new DocumentRepository();
const ingestion = new IngestionService();

router.get("/", requireAuth, (req, res) => {
  res.json({ documents: documents.list(req.user!.id, req.user!.role) });
});

router.post("/", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, "File is required", "FILE_REQUIRED");
    const document = await ingestion.ingest({
      ownerId: req.user!.id,
      name: req.file.originalname,
      mimeType: req.file.mimetype,
      path: req.file.path
    });
    res.status(201).json({ document });
  } catch (error) {
    next(error);
  }
});

export { router as documentRoutes };
