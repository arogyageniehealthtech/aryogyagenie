import rateLimit from "express-rate-limit";

/**
 * General API Rate Limiter
 * 300 requests per 15 minutes per IP.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX ?? "300", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests from this IP, please try again after 15 minutes.",
  },
  skip: (req) => req.path === "/api/health" || req.path === "/api/healthz" || req.path === "/api/health/ready",
});

/**
 * Strict AI Rate Limiter
 * Protects LLM quota & CPU from automated spam or excessive queries.
 * 30 requests per 15 minutes per IP.
 */
export const strictAiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: parseInt(process.env.RATE_LIMIT_AI_MAX ?? "30", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "AI rate limit reached. You have made too many AI requests. Please wait a few minutes before trying again.",
  },
});
