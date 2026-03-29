import 'dotenv/config';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'http';
import * as path from 'path';
import * as fs from 'fs';

import logger from './utils/logger';
import { errorHandler, notFoundHandler } from './api/middleware/errorHandler';
import evidenceRoutes from './api/routes/evidence';
import healthRoutes from './api/routes/health';
import blockchainService from './services/blockchain.service';

// Environment configuration
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Ensure required directories exist
const requiredDirs = [
  path.resolve(__dirname, '../../storage/temp'),
  path.resolve(__dirname, '../../storage/evidence'),
  path.resolve(__dirname, '../logs')
];

requiredDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info('Created directory', { path: dir });
  }
});

let server: Server | null = null;

export function createApp(): Application {
  const app: Application = express();

  // Security middleware
  app.use(helmet());

  // CORS configuration
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req, res, next) => {
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip
    });
    next();
  });

  // API Routes
  app.use('/api/health', healthRoutes);
  app.use('/api/evidence', evidenceRoutes);

  const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
  const frontendIndexPath = path.join(frontendDistPath, 'index.html');

  if (fs.existsSync(frontendIndexPath)) {
    app.use(express.static(frontendDistPath));
    app.get('/', (req, res) => {
      res.sendFile(frontendIndexPath);
    });
  } else {
    // Root endpoint fallback when frontend is not built yet
    app.get('/', (req, res) => {
      res.json({
        name: 'Blockchain Digital Forensics API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          health: '/api/health',
          blockchain: '/api/health/blockchain',
          evidence: '/api/evidence'
        }
      });
    });
  }

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();

// Start server
export async function startServer(): Promise<Server> {
  try {
    if (server) {
      return server;
    }

    // Attempt to connect to blockchain (optional in dev mode)
    if (process.env.SKIP_BLOCKCHAIN_CONNECT !== 'true') {
      try {
        await blockchainService.connect();
        if (blockchainService.isMockModeEnabled()) {
          logger.warn('Blockchain not available - running in mock mode');
        } else {
          logger.info('Blockchain connection established');
        }
      } catch (error) {
        logger.warn('Blockchain connection failed - API will run in limited mode', {
          error: error instanceof Error ? error.message : error
        });
      }
    } else {
      logger.info('SKIP_BLOCKCHAIN_CONNECT=true, skipping Fabric connection');
    }

    return await new Promise<Server>((resolve, reject) => {
      const listeningServer = app.listen(PORT, () => {
        server = listeningServer;

        logger.info('Server started', {
          port: PORT,
          environment: NODE_ENV
        });
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║     Blockchain Digital Forensics API                      ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                              ║
║  Environment: ${NODE_ENV}                                     ║
║                                                           ║
║  Endpoints:                                               ║
║    GET  /           - API info                            ║
║    GET  /api/health - Health check                        ║
║    POST /api/evidence - Submit evidence                   ║
║    GET  /api/evidence/:id - Get evidence                  ║
║    GET  /api/evidence/:id/verify - Verify evidence        ║
║    GET  /api/evidence/:id/history - Get audit trail       ║
╚═══════════════════════════════════════════════════════════╝
      `);

        resolve(listeningServer);
      });

      listeningServer.on('error', (error) => {
        server = null;
        reject(error);
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    server = null;
  }

  await blockchainService.disconnect();
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await shutdown();
  process.exit(0);
});

if (require.main === module) {
  void startServer();
}

export default app;
