import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

function getUserOrIpKey(req: Request, _res: any): string {
  const userId = (req as any).userId;
  if (userId) return `user_${userId}`;
  
  // Extract IP from request and use ipKeyGenerator to properly handle IPv6
  const ip = req.ip || req.socket.remoteAddress || "anonymous";
  try {
    // ipKeyGenerator normalizes the IP (handles IPv6 subnet /64 normalization)
    return ipKeyGenerator(ip);
  } catch {
    // Fallback to raw IP if normalization fails
    return ip;
  }
}

/**
 * General API Rate Limiter
 * Defaults: 300 requests per 15 minutes per user/IP.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX ?? "300", 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getUserOrIpKey,
  message: {
    error: "Too many requests, please try again after 15 minutes.",
  },
  skip: (req) => req.path === "/health" || req.path === "/healthz" || req.path === "/health/ready",
  skipFailedRequests: true,
});

/**
 * Strict AI Rate Limiter
 * Protects Gemini LLM quota & server CPU from automated spam.
 * Defaults: 30 requests per 15 minutes per user/IP.
 */
export const strictAiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: parseInt(process.env.RATE_LIMIT_AI_MAX ?? "30", 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getUserOrIpKey,
  message: {
    error: "AI rate limit reached. You have made too many AI requests. Please wait a few minutes before trying again.",
  },
  skipFailedRequests: true,
});
