import express from 'express';
import { registerRoutes } from './routes';
import { storage } from './storage';
import { setupVite } from './vite';

const app = express();
app.use(express.json());

async function main() {
  try {
    // Create the server
    const server = await registerRoutes(app);

    // Setup Vite middleware in development
    if (process.env.NODE_ENV !== 'production') {
      await setupVite(app, server);
    }

    // Start listening on port 5000 as required
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();