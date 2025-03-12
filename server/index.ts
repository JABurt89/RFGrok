import express, { type Request, Response, NextFunction } from "express";

const app = express();

// Essential middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Basic request logging
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Root route
app.get("/", (_req, res) => {
  res.json({ message: "Express server is running" });
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
});

// Start server
const port = 5000;
app.listen({
  port,
  host: "0.0.0.0",
}, () => {
  console.log(`Server started on port ${port}`);
});