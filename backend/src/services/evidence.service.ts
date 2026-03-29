import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import hashService from './hash.service';
import blockchainService from './blockchain.service';
import {
  EvidenceRecord,
  EvidenceStatus,
  SubmitEvidenceInput,
  SubmitEvidenceResponse,
  VerificationResult,
  AuditEntry
} from '../models/evidence';

/**
 * Service for evidence business logic
 */
export class EvidenceService {
  private readonly storagePath: string;

  constructor() {
    this.storagePath = process.env.EVIDENCE_STORAGE_PATH || path.resolve(__dirname, '../../../storage/evidence');
    this.ensureStorageExists();
  }

  /**
   * Ensure storage directory exists
   */
  private ensureStorageExists(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
      logger.info('Created evidence storage directory', { path: this.storagePath });
    }
  }

  /**
   * Submit new evidence to the system
   */
  async submitEvidence(input: SubmitEvidenceInput): Promise<SubmitEvidenceResponse> {
    const { file, metadata, submittedBy } = input;

    try {
      logger.info('Processing evidence submission', {
        fileName: file.originalname,
        caseId: metadata.caseId,
        submittedBy
      });

      // Generate unique evidence ID
      const evidenceId = uuidv4();

      // Compute file hash
      const hash = await hashService.hashFile(file.path);
      logger.info('Computed evidence hash', { evidenceId, hash });

      // Store file with evidence ID
      const storagePath = this.getEvidenceStoragePath(evidenceId);
      fs.renameSync(file.path, storagePath);
      logger.info('Stored evidence file', { evidenceId, storagePath });

      // Create audit trail entry
      const auditEntry: AuditEntry = {
        timestamp: new Date().toISOString(),
        action: 'EVIDENCE_SUBMITTED',
        performedBy: submittedBy,
        details: `Evidence submitted: ${file.originalname}`
      };

      // Prepare evidence record
      const evidenceRecord: Omit<EvidenceRecord, 'submittedAt'> = {
        evidenceId,
        hash,
        originalFileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        storagePath,
        metadata,
        status: EvidenceStatus.SUBMITTED,
        submittedBy,
        auditTrail: [auditEntry]
      };

      // Submit to blockchain
      const blockchainResult = await blockchainService.submitEvidence(
        evidenceId,
        hash,
        JSON.stringify(evidenceRecord),
        submittedBy
      );

      logger.info('Evidence submitted to blockchain', {
        evidenceId,
        transactionId: blockchainResult.transactionId
      });

      return {
        evidenceId,
        hash,
        transactionId: blockchainResult.transactionId,
        timestamp: blockchainResult.timestamp
      };
    } catch (error) {
      logger.error('Failed to submit evidence', { error });

      // Clean up file if it still exists
      if (input.file.path && fs.existsSync(input.file.path)) {
        fs.unlinkSync(input.file.path);
      }

      throw error;
    }
  }

  /**
   * Retrieve evidence record
   */
  async getEvidence(evidenceId: string): Promise<EvidenceRecord> {
    try {
      logger.info('Retrieving evidence', { evidenceId });

      const evidence = await blockchainService.getEvidence(evidenceId);
      return evidence;
    } catch (error) {
      logger.error('Failed to retrieve evidence', { error, evidenceId });
      throw error;
    }
  }

  /**
   * Verify evidence integrity
   */
  async verifyEvidence(evidenceId: string, filePath?: string): Promise<VerificationResult> {
    try {
      logger.info('Verifying evidence integrity', { evidenceId });

      // Get evidence from blockchain
      const evidence = await blockchainService.getEvidence(evidenceId);
      const storedHash = evidence.hash;

      // Compute hash of provided file or stored file
      let computedHash: string;

      if (filePath) {
        computedHash = await hashService.hashFile(filePath);
      } else {
        // Use stored file
        computedHash = await hashService.hashFile(evidence.storagePath);
      }

      const isValid = storedHash.toLowerCase() === computedHash.toLowerCase();

      logger.info('Evidence verification complete', {
        evidenceId,
        isValid,
        storedHash,
        computedHash
      });

      return {
        evidenceId,
        isValid,
        storedHash,
        computedHash,
        message: isValid
          ? 'Evidence integrity verified successfully'
          : 'Evidence integrity check failed - hash mismatch',
        verifiedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to verify evidence', { error, evidenceId });
      throw error;
    }
  }

  /**
   * Get evidence audit history
   */
  async getEvidenceHistory(evidenceId: string): Promise<AuditEntry[]> {
    try {
      logger.info('Retrieving evidence history', { evidenceId });

      const history = await blockchainService.getEvidenceHistory(evidenceId);
      return history;
    } catch (error) {
      logger.error('Failed to retrieve evidence history', { error, evidenceId });
      throw error;
    }
  }

  /**
   * Update evidence status
   */
  async updateEvidenceStatus(
    evidenceId: string,
    status: EvidenceStatus,
    updatedBy: string,
    details?: string
  ): Promise<{ transactionId: string; timestamp: string }> {
    try {
      logger.info('Updating evidence status', {
        evidenceId,
        status,
        updatedBy
      });

      const result = await blockchainService.updateEvidenceStatus(
        evidenceId,
        status,
        updatedBy,
        details
      );

      logger.info('Evidence status updated', {
        evidenceId,
        status,
        transactionId: result.transactionId
      });

      return result;
    } catch (error) {
      logger.error('Failed to update evidence status', { error, evidenceId });
      throw error;
    }
  }

  /**
   * Get storage path for evidence file
   */
  private getEvidenceStoragePath(evidenceId: string): string {
    return path.join(this.storagePath, evidenceId);
  }

  /**
   * Retrieve evidence file
   */
  getEvidenceFile(evidenceId: string): Buffer {
    const storagePath = this.getEvidenceStoragePath(evidenceId);

    if (!fs.existsSync(storagePath)) {
      throw new Error(`Evidence file not found: ${evidenceId}`);
    }

    return fs.readFileSync(storagePath);
  }

  /**
   * Check if evidence file exists
   */
  evidenceFileExists(evidenceId: string): boolean {
    const storagePath = this.getEvidenceStoragePath(evidenceId);
    return fs.existsSync(storagePath);
  }
}

export default new EvidenceService();
