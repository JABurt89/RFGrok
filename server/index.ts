import express, { type Request, Response, NextFunction } from "express";
import { log } from "./vite";
import { setupVite } from "./vite";
import { registerRoutes } from "./routes";

const app = express();

// Essential middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Basic request logging
app.use((req, _res, next) => {
  log(`${req.method} ${req.path}`);
  next();
});

// Basic health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
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

// Start server with Vite integration
(async () => {
  try {
    // First create the HTTP server
    const port = 5000;
    const server = app.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      log(`Server started on port ${port}`);
    });

    // Setup essential routes
    await registerRoutes(app);
    log('API routes registered');

    // Setup Vite in development mode
    if (app.get("env") === "development") {
      log('Setting up Vite middleware...');
      await setupVite(app, server);
      log('Vite middleware setup complete');
    }
  } catch (err) {
    log(`Failed to start server: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
})();