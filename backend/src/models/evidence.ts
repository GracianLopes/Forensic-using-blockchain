/**
 * Evidence data models for the digital forensics system
 */

/**
 * Status of an evidence item in the forensic workflow
 */
export enum EvidenceStatus {
  SUBMITTED = 'SUBMITTED',
  VERIFIED = 'VERIFIED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  ADMITTED = 'ADMITTED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED'
}

/**
 * Metadata associated with an evidence submission
 */
export interface EvidenceMetadata {
  caseId: string;
  type: string;
  description?: string;
  submittedBy?: string;
  collectionDate?: string;
  location?: string;
  [key: string]: string | undefined;
}

/**
 * Represents a single entry in the evidence audit trail
 */
export interface AuditEntry {
  timestamp: string;
  action: string;
  performedBy: string;
  details?: string;
  transactionId?: string;
}

/**
 * Complete evidence record stored on the blockchain
 */
export interface EvidenceRecord {
  evidenceId: string;
  hash: string;
  originalFileName?: string;
  fileSize?: number;
  mimeType?: string;
  storagePath: string;
  metadata: EvidenceMetadata;
  status: EvidenceStatus;
  submittedAt: string;
  submittedBy: string;
  auditTrail: AuditEntry[];
}

/**
 * Input for submitting new evidence
 */
export interface SubmitEvidenceInput {
  file: Express.Multer.File;
  metadata: EvidenceMetadata;
  submittedBy: string;
}

/**
 * Response from evidence submission
 */
export interface SubmitEvidenceResponse {
  evidenceId: string;
  hash: string;
  transactionId: string;
  timestamp: string;
}

/**
 * Verification result for evidence integrity check
 */
export interface VerificationResult {
  evidenceId: string;
  isValid: boolean;
  storedHash: string;
  computedHash: string;
  message: string;
  verifiedAt: string;
}
