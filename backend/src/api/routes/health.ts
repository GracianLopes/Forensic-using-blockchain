import express, { Request, Response } from 'express';
import blockchainService from '../../services/blockchain.service';
import logger from '../../utils/logger';

const router = express.Router();

/**
 * GET /api/health
 * Basic health check
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/health/blockchain
 * Check blockchain connection status
 */
router.get('/blockchain', async (req: Request, res: Response) => {
  try {
    const isConnected = blockchainService.isConnectionActive();

    if (isConnected) {
      res.json({
        success: true,
        status: 'connected',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        success: false,
        status: 'disconnected',
        message: 'Blockchain connection not established',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Blockchain health check failed', { error });
    res.status(503).json({
      success: false,
      status: 'error',
      message: 'Failed to check blockchain connection',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
