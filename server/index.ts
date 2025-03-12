import express from 'express';
import { registerRoutes } from './routes';
import { storage } from './storage';
import { setupVite } from './vite';
import { createServer as createHttpServer, type Server } from 'http';

const app = express();
app.use(express.json());

async function main() {
  let server: Server | null = null;

  try {
    console.log('[Startup] Starting server initialization...');

    // Create the server first
    console.log('[Startup] Creating HTTP server...');
    server = createHttpServer(app);

    // Add health check endpoint
    app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok', message: 'Server is running' });
    });

    // Handle server errors with detailed logging
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port 5000 is already in use. This could be due to:
1. Another instance of the server is already running
2. The Vite development server is running separately
3. Another service is using port 5000

Error details:
- Code: ${error.code}
- Message: ${error.message}
- Stack: ${error.stack}
`);
        process.exit(1);
      } else {
        console.error('Server error:', {
          code: error.code,
          message: error.message,
          stack: error.stack
        });
        process.exit(1);
      }
    });

    // Setup Vite first in development mode
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Startup] Setting up Vite middleware...');
      try {
        await setupVite(app, server);
        console.log('[Startup] Vite middleware setup complete');
      } catch (error) {
        console.error('[Error] Failed to setup Vite:', error);
        process.exit(1);
      }
    }

    // Now attempt to bind to port 5000
    console.log('[Startup] Attempting to bind to port 5000');
    server.listen({ port: 5000, host: '0.0.0.0' }, () => {
      console.log('[Startup] Server bound successfully to port 5000');
      console.log('[Startup] Server initialization complete');
    });

    // Handle process termination signals
    const cleanup = async () => {
      if (!server) return;

      console.log('\n[Shutdown] Initiating graceful shutdown...');
      await new Promise<void>((resolve) => {
        console.log('[Shutdown] Closing HTTP server...');
        server!.close(() => {
          console.log('[Shutdown] HTTP server closed.');
          resolve();
        });
      });
      console.log('[Shutdown] Cleanup complete. Exiting...');
      process.exit(0);
    };

    // Ensure proper cleanup on various signals
    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGUSR2', cleanup); // For nodemon restarts

    // Catch uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('[Error] Uncaught Exception:', error);
      cleanup().catch(() => process.exit(1));
    });

    // Catch unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[Error] Unhandled Rejection at:', promise, 'reason:', reason);
      cleanup().catch(() => process.exit(1));
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    if (server) {
      server.close();
    }
    process.exit(1);
  }
}

main();