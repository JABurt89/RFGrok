import express from 'express';
import { registerRoutes } from './routes';
import { storage } from './storage';
import { setupVite } from './vite';

const app = express();
app.use(express.json());

async function main() {
  try {
    console.log('[Startup] Starting server initialization...');

    // Create the server
    console.log('[Startup] Registering routes...');
    const server = await registerRoutes(app);

    // Temporarily disable Vite for debugging
    // if (process.env.NODE_ENV !== 'production') {
    //   console.log('[Startup] Setting up Vite middleware...');
    //   await setupVite(app, server);
    // }

    // Start listening on port 5000 as required
    const PORT = 5000; // Always use port 5000
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

    // Handle process termination
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM signal. Shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();