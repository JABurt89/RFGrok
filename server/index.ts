import express, { type Request, Response, NextFunction } from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { setupAuth } from "./auth";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createServer } from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Essential middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS settings for development
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,UPDATE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
    next();
  });
}

// Basic request logging
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`, {
    headers: req.headers,
    cookies: req.cookies,
    session: req.session
  });
  next();
});

// Basic error handling
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error('Server error:', err);

  if (!res.headersSent) {
    res.status(status).json({ message });
  }
});

async function main() {
  try {
    const httpServer = await registerRoutes(app);

    if (process.env.NODE_ENV === "production") {
      log("Production mode detected, serving static files");
      serveStatic(app);
    } else {
      log("Development mode detected, setting up Vite");
      await setupVite(app, httpServer);
    }

    const port = 5000;
    httpServer.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      console.log(`Server started on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();