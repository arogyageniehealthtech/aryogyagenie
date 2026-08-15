import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { logger } from "./lib/logger";
import { globalRateLimiter } from "./middlewares/rateLimiter";
import healthRouter from "./routes/health";
import router from "./routes";

const app = express();

// Security Headers (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled to prevent breaking Clerk widgets/CDN scripts
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// CORS configuration (Strict Production Fail-Closed Policy)
const isProductionMode = process.env.NODE_ENV === "production";
const rawAllowedOrigins = process.env.ALLOWED_ORIGINS?.trim();

if (isProductionMode && !rawAllowedOrigins) {
  throw new Error(
    "FATAL CONFIGURATION ERROR: ALLOWED_ORIGINS environment variable must be explicitly defined in production mode."
  );
}

const allowedOrigins = rawAllowedOrigins
  ? rawAllowedOrigins.split(",").map((o) => o.trim()).filter(Boolean)
  : null;

if (isProductionMode && allowedOrigins && allowedOrigins.includes("*")) {
  throw new Error(
    "FATAL CONFIGURATION ERROR: Wildcard '*' CORS origin is forbidden in production when credentials are enabled."
  );
}

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      // Allow non-browser requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins) {
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS origin '${origin}' not allowed by policy`));
      }

      if (!isProductionMode) {
        // Default in dev: reflect request origin
        return callback(null, true);
      }

      return callback(new Error("CORS origin not allowed by policy"));
    },
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const rawPublishableKey =
  process.env.CLERK_PUBLISHABLE_KEY ||
  process.env.VITE_CLERK_PUBLISHABLE_KEY;

const isKeyValid = Boolean(
  rawPublishableKey &&
  !rawPublishableKey.includes("your_publishable_key_here") &&
  (rawPublishableKey.startsWith("pk_test_") || rawPublishableKey.startsWith("pk_live_"))
);

if (isKeyValid) {
  app.use(
    clerkMiddleware((req) => ({
      publishableKey:
        rawPublishableKey ||
        publishableKeyFromHost(
          getClerkProxyHost(req) ?? "",
        ),
    })),
  );
} else {
  logger.warn("Clerk publishable key is not configured or is a placeholder; auth middleware running in fallback mode.");
  app.use((req, _res, next) => {
    (req as any).auth = (req as any).auth || { userId: null };
    next();
  });
}

// Root Health Check Probes (/health, /healthz, /health/ready)
app.use(healthRouter);

// Apply Global API Rate Limiter
app.use("/api", globalRateLimiter);

app.use("/api", router);

// Global Error Handler — Prevents leaking stack traces or internal errors to clients
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled server error in API route");

  const statusCode = typeof err.status === "number" && err.status >= 400 && err.status < 600 ? err.status : 500;
  const isProduction = process.env.NODE_ENV === "production";

  const responseMessage = isProduction && statusCode === 500
    ? "Internal Server Error"
    : err.message || "An unexpected error occurred";

  res.status(statusCode).json({
    error: responseMessage,
  });
});

export default app;
