import express from 'express';
import { registerRoutes } from './routes';
import { storage } from './storage';
import { setupVite } from './vite';

const app = express();
app.use(express.json());

async function testPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const { createServer } = await import('http'); // Use dynamic import instead of require
    const testServer = createServer();
    testServer.once('error', () => {
      resolve(false);
    });
    testServer.once('listening', () => {
      testServer.close(() => resolve(true));
    });
    testServer.listen(port);
  });
}

async function main() {
  try {
    console.log('[Startup] Starting server initialization...');

    // Check if port is available
    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
    console.log('[Startup] Testing port availability:', PORT);

    const portAvailable = await testPort(PORT);
    if (!portAvailable) {
      console.error(`[Error] Port ${PORT} is already in use. Unable to start server.`);
      process.exit(1);
    }

    // Add test endpoint
    app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok', message: 'Server is running' });
    });

    // Create the server with minimal configuration
    console.log('[Startup] Creating HTTP server...');
    const { createServer } = await import('http');
    const server = createServer(app);

    // Enable Vite for development
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Startup] Setting up Vite middleware...');
      await setupVite(app, server);
    }

    console.log('[Startup] Attempting to bind to port', PORT);
    server.listen({ port: PORT, host: '0.0.0.0' }, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please ensure no other instances are running.`);
        process.exit(1);
      } else {
        console.error('Server error:', error);
        process.exit(1);
      }
    });

    // Handle process termination signals
    const cleanup = async () => {
      console.log('\n[Shutdown] Initiating graceful shutdown...');

      // Close the HTTP server first
      await new Promise<void>((resolve) => {
        console.log('[Shutdown] Closing HTTP server...');
        server.close(() => {
          console.log('[Shutdown] HTTP server closed.');
          resolve();
        });
      });

      // Additional cleanup if needed
      console.log('[Shutdown] Cleanup complete. Exiting...');
      process.exit(0);
    };

    // Handle various termination signals
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
    process.exit(1);
  }
}

main();