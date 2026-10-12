import { generateTaskDescription } from "../services/aiService.js";

// In-memory sliding-window rate limiter (10 requests per 60 seconds per user)
const userRequestTimestamps = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;

/**
 * Handle AI Task Description Generation
 * POST /api/ai/generate-description
 */
export async function generateDescriptionHandler(req, res, next) {
  try {
    const userId = req.user?.id || req.user?._id || "anonymous";
    const now = Date.now();

    // 1. Check rate limit
    let timestamps = userRequestTimestamps.get(userId) || [];
    timestamps = timestamps.filter((time) => now - time < RATE_LIMIT_WINDOW_MS);

    if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      const oldest = timestamps[0];
      const retryAfterSeconds = Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000);
      return res.status(429).json({
        success: false,
        error: "Too Many Requests",
        message: `AI generation limit reached. Please wait ${retryAfterSeconds} seconds before requesting again.`,
        retryAfter: retryAfterSeconds,
      });
    }

    timestamps.push(now);
    userRequestTimestamps.set(userId, timestamps);

    // 2. Validate input
    const { title, priority, category } = req.body || {};

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: "Validation Error",
        message: "A task title is required to generate an AI description.",
      });
    }

    // 3. Generate description using service
    const { description, source } = await generateTaskDescription({
      title: title.trim(),
      priority: priority || "medium",
      category: category || "general",
    });

    return res.status(200).json({
      success: true,
      description,
      source,
      disclaimer: "AI-generated draft. Review and adjust before saving.",
    });
  } catch (error) {
    console.error("[AIController] Error generating description:", error);
    // Non-blocking fallback response if an unexpected error occurs
    return res.status(500).json({
      success: false,
      error: "Internal Error",
      message: "Failed to generate AI description. Please write manually.",
    });
  }
}
