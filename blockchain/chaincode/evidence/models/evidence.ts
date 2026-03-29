/**
 * Evidence data model for chaincode
 */

export enum EvidenceStatus {
  SUBMITTED = 'SUBMITTED',
  VERIFIED = 'VERIFIED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  ADMITTED = 'ADMITTED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED'
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  performedBy: string;
  details?: string;
  transactionId?: string;
}

export interface EvidenceRecord {
  evidenceId: string;
  hash: string;
  originalFileName?: string;
  fileSize?: number;
  mimeType?: string;
  storagePath: string;
  metadata: Record<string, string>;
  status: EvidenceStatus;
  submittedAt: string;
  submittedBy: string;
  auditTrail: AuditEntry[];
}
