import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import evidenceService from '../../services/evidence.service';
import { EvidenceMetadata, EvidenceStatus } from '../../models/evidence';
import logger from '../../utils/logger';

const router = express.Router();

// Configure multer for file uploads
const uploadDir = path.resolve(__dirname, '../../../storage/temp');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept all file types for evidence
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

/**
 * POST /api/evidence
 * Submit new evidence
 */
router.post('/', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    let metadata: EvidenceMetadata;
    try {
      metadata = typeof req.body.metadata === 'string'
        ? JSON.parse(req.body.metadata)
        : req.body.metadata;
    } catch (e) {
      res.status(400).json({ error: 'Invalid metadata format' });
      return;
    }

    // Validate required metadata fields
    if (!metadata.caseId || !metadata.type) {
      res.status(400).json({ error: 'Missing required metadata fields: caseId, type' });
      return;
    }

    const submittedBy = req.body.submittedBy || 'anonymous';

    logger.info('Evidence submission request', {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      caseId: metadata.caseId
    });

    const result = await evidenceService.submitEvidence({
      file: req.file,
      metadata,
      submittedBy
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Evidence submission failed', { error });
    next(error);
  }
});

/**
 * GET /api/evidence/:id
 * Retrieve evidence record
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    logger.info('Evidence retrieval request', { evidenceId: id });

    const evidence = await evidenceService.getEvidence(id);

    res.json({
      success: true,
      data: evidence
    });
  } catch (error) {
    logger.error('Evidence retrieval failed', { error, evidenceId: req.params.id });
    next(error);
  }
});

/**
 * GET /api/evidence/:id/verify
 * Verify evidence integrity
 */
router.get('/:id/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const hashToVerify = typeof req.query?.hash === 'string' ? req.query.hash : undefined;

    logger.info('Evidence verification request', { evidenceId: id });

    const result = await evidenceService.verifyEvidence(id, undefined, hashToVerify);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Evidence verification failed', { error, evidenceId: req.params.id });
    next(error);
  }
});

/**
 * GET /api/evidence/:id/history
 * Get evidence audit trail
 */
router.get('/:id/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    logger.info('Evidence history request', { evidenceId: id });

    const history = await evidenceService.getEvidenceHistory(id);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error('Evidence history retrieval failed', { error, evidenceId: req.params.id });
    next(error);
  }
});

/**
 * GET /api/evidence/:id/file
 * Download evidence file
 */
router.get('/:id/file', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    logger.info('Evidence file download request', { evidenceId: id });

    // Get evidence record first to verify it exists
    await evidenceService.getEvidence(id);

    const fileBuffer = evidenceService.getEvidenceFile(id);
    const evidence = await evidenceService.getEvidence(id);

    res.setHeader('Content-Type', evidence.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${evidence.originalFileName || id}"`);

    res.send(fileBuffer);
  } catch (error) {
    logger.error('Evidence file download failed', { error, evidenceId: req.params.id });
    next(error);
  }
});

/**
 * PUT /api/evidence/:id/status
 * Update evidence status
 */
router.put('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, updatedBy, details } = req.body;

    if (!status || !updatedBy) {
      res.status(400).json({ error: 'Missing required fields: status, updatedBy' });
      return;
    }

    // Validate status value
    const validStatuses = Object.values(EvidenceStatus);
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
      return;
    }

    logger.info('Evidence status update request', {
      evidenceId: id,
      status,
      updatedBy
    });

    const result = await evidenceService.updateEvidenceStatus(
      id,
      status as EvidenceStatus,
      updatedBy,
      details
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Evidence status update failed', { error, evidenceId: req.params.id });
    next(error);
  }
});

export default router;
export { upload };
