import axios from 'axios';
import type {
  ApiEnvelope,
  AuditEntry,
  EvidenceRecord,
  HealthResponse,
  SubmitEvidenceResult,
  VerifyEvidenceResult,
  EvidenceStatus
} from './types';

function resolveApiBaseUrl(): string {
  const queryOverride = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('apiBase')?.trim()
    : undefined;
  if (queryOverride) {
    return queryOverride.replace(/\/$/, '');
  }

  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!configured) {
    return '/api';
  }

  return configured.replace(/\/$/, '');
}

export const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000
});

export async function fetchHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/health');
  return data;
}

export async function fetchBlockchainHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/health/blockchain');
  return data;
}

export async function submitEvidence(payload: {
  file: File;
  caseId: string;
  type: string;
  description?: string;
  collectionDate?: string;
  location?: string;
  submittedBy?: string;
}): Promise<SubmitEvidenceResult> {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append(
    'metadata',
    JSON.stringify({
      caseId: payload.caseId,
      type: payload.type,
      description: payload.description,
      collectionDate: payload.collectionDate,
      location: payload.location
    })
  );
  if (payload.submittedBy) {
    formData.append('submittedBy', payload.submittedBy);
  }

  const { data } = await api.post<ApiEnvelope<SubmitEvidenceResult>>('/evidence', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data.data;
}

export async function getEvidenceById(evidenceId: string): Promise<EvidenceRecord> {
  const { data } = await api.get<ApiEnvelope<EvidenceRecord>>(`/evidence/${evidenceId}`);
  return data.data;
}

export async function verifyEvidenceById(evidenceId: string, hashToVerify?: string): Promise<VerifyEvidenceResult> {
  const { data } = await api.get<ApiEnvelope<VerifyEvidenceResult>>(`/evidence/${evidenceId}/verify`, {
    params: hashToVerify ? { hash: hashToVerify } : undefined
  });
  return data.data;
}

export async function getEvidenceHistory(evidenceId: string): Promise<AuditEntry[]> {
  const { data } = await api.get<ApiEnvelope<AuditEntry[]>>(`/evidence/${evidenceId}/history`);
  return data.data;
}

export async function updateEvidenceStatus(payload: {
  evidenceId: string;
  status: EvidenceStatus;
  updatedBy: string;
  details?: string;
}): Promise<{ transactionId: string; timestamp: string }> {
  const { data } = await api.put<ApiEnvelope<{ transactionId: string; timestamp: string }>>(
    `/evidence/${payload.evidenceId}/status`,
    {
      status: payload.status,
      updatedBy: payload.updatedBy,
      details: payload.details
    }
  );
  return data.data;
}

export function normalizeApiError(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return 'Unexpected error occurred';
  }

  const responseData = error.response?.data as
    | {
        error?: string | { message?: string };
        message?: string;
        errorDescription?: string;
      }
    | undefined;

  if (typeof responseData?.error === 'string') {
    return responseData.error;
  }

  if (
    responseData?.error &&
    typeof responseData.error === 'object' &&
    typeof responseData.error.message === 'string'
  ) {
    return responseData.error.message;
  }

  return (
    responseData?.message ||
    responseData?.errorDescription ||
    error.message ||
    'Request failed'
  );
}
