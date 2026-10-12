import { Router } from "express";
import { generateDescriptionHandler } from "../controllers/aiController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// POST /ai/generate-description (Protected by JWT)
router.post("/generate-description", authenticate, generateDescriptionHandler);

export default router;
