import express, { type Request, Response, NextFunction } from "express";
import { log } from "./vite";
import { setupVite, serveStatic } from "./vite";
import { registerRoutes } from "./routes";

const app = express();

// Record startup timing
const startupTiming: Record<string, number> = {
  start: Date.now()
};

// Basic health check that doesn't require auth or DB
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Essential middleware only
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

(async () => {
  try {
    // Verify critical environment variables
    const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET'];
    const missingVars = requiredEnvVars.filter(v => !process.env[v]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    startupTiming.envCheck = Date.now();
    log(`[${new Date().toISOString()}] Environment variables verified (${startupTiming.envCheck - startupTiming.start}ms)`);

    // Setup Vite/static file serving
    log(`[${new Date().toISOString()}] Setting up Vite...`);
    if (app.get("env") === "development") {
      await setupVite(app);
    } else {
      serveStatic(app);
    }
    startupTiming.vite = Date.now();
    log(`[${new Date().toISOString()}] Vite setup complete (${startupTiming.vite - startupTiming.envCheck}ms)`);

    // Setup API routes
    log(`[${new Date().toISOString()}] Setting up API routes...`);
    await registerRoutes(app);
    startupTiming.routes = Date.now();
    log(`[${new Date().toISOString()}] API routes setup complete (${startupTiming.routes - startupTiming.vite}ms)`);

    // Start server
    const port = 5000;
    const server = app.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      startupTiming.listen = Date.now();
      const totalDuration = startupTiming.listen - startupTiming.start;
      log(`[${new Date().toISOString()}] Server started on port ${port} (total startup: ${totalDuration}ms)`);
    });

    // Basic error handling
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error('Server error:', err);

      if (!res.headersSent) {
        res.status(status).json({ message });
      }
      log(`Error: ${message}`);
    });

  } catch (err) {
    log(`Failed to start server: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
})();