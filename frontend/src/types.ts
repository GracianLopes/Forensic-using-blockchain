export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

export type HealthResponse = {
  success: boolean;
  status: string;
  timestamp: string;
  message?: string;
};

export type EvidenceStatus =
  | 'SUBMITTED'
  | 'VERIFIED'
  | 'UNDER_REVIEW'
  | 'ADMITTED'
  | 'REJECTED'
  | 'ARCHIVED';

export type AuditEntry = {
  timestamp: string;
  action: string;
  performedBy: string;
  details?: string;
  transactionId?: string;
};

export type EvidenceRecord = {
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
};

export type SubmitEvidenceResult = {
  evidenceId: string;
  hash: string;
  transactionId: string;
  timestamp: string;
};

export type VerifyEvidenceResult = {
  evidenceId: string;
  isValid: boolean;
  storedHash: string;
  computedHash: string;
  message: string;
  verifiedAt: string;
};
