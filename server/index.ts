import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  const startTime = Date.now();
  log(`[${new Date().toISOString()}] Starting server initialization...`);

  // First register API routes
  log(`[${new Date().toISOString()}] Registering API routes...`);
  const server = await registerRoutes(app);

  // Error handling middleware must be after routes but before static files
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (res.headersSent) {
      return;
    }

    res.status(status).json({ message });
    log(`Error: ${message}`);
    throw err;
  });

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client 
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    const duration = Date.now() - startTime;
    log(`[${new Date().toISOString()}] Server started and listening on port ${port} (startup took ${duration}ms)`);
  });
})().catch(err => {
  log(`Failed to start server: ${err.message}`);
  process.exit(1);
});