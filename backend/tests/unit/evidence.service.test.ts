import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import hashService from '../../src/services/hash.service';
import blockchainService from '../../src/services/blockchain.service';
import { EvidenceService } from '../../src/services/evidence.service';
import { EvidenceStatus } from '../../src/models/evidence';

jest.mock('../../src/services/hash.service', () => ({
  __esModule: true,
  default: {
    hashFile: jest.fn(),
    hashBuffer: jest.fn()
  }
}));

jest.mock('../../src/services/blockchain.service', () => ({
  __esModule: true,
  default: {
    submitEvidence: jest.fn(),
    getEvidence: jest.fn(),
    verifyEvidence: jest.fn(),
    getEvidenceHistory: jest.fn(),
    updateEvidenceStatus: jest.fn()
  }
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-evidence-id')
}));

describe('EvidenceService', () => {
  const mockHashService = hashService as jest.Mocked<typeof hashService>;
  const mockBlockchainService = blockchainService as jest.Mocked<typeof blockchainService>;
  let tempRoot: string;
  let service: EvidenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-service-'));
    process.env.EVIDENCE_STORAGE_PATH = path.join(tempRoot, 'evidence-store');
    service = new EvidenceService();
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.EVIDENCE_STORAGE_PATH;
  });

  it('submits evidence successfully and moves the file into storage', async () => {
    const uploadPath = path.join(tempRoot, 'upload.txt');
    fs.writeFileSync(uploadPath, 'evidence-content');

    mockHashService.hashFile.mockResolvedValue('hash-123');
    mockBlockchainService.submitEvidence.mockResolvedValue({
      transactionId: 'tx-123',
      timestamp: '2026-03-28T00:00:00.000Z'
    });

    const result = await service.submitEvidence({
      file: {
        path: uploadPath,
        originalname: 'upload.txt',
        size: 16,
        mimetype: 'text/plain'
      } as Express.Multer.File,
      metadata: {
        caseId: 'CASE-001',
        type: 'document'
      },
      submittedBy: 'investigator@example.com'
    });

    expect(result).toEqual({
      evidenceId: 'test-evidence-id',
      hash: 'hash-123',
      transactionId: 'tx-123',
      timestamp: '2026-03-28T00:00:00.000Z'
    });
    expect(fs.existsSync(path.join(process.env.EVIDENCE_STORAGE_PATH!, 'test-evidence-id'))).toBe(true);
    expect(mockBlockchainService.submitEvidence).toHaveBeenCalledWith(
      'test-evidence-id',
      'hash-123',
      expect.stringContaining('"originalFileName":"upload.txt"'),
      'investigator@example.com'
    );
  });

  it('cleans up the upload file when submission fails', async () => {
    const uploadPath = path.join(tempRoot, 'failed-upload.txt');
    fs.writeFileSync(uploadPath, 'evidence-content');
    mockHashService.hashFile.mockRejectedValue(new Error('hash failure'));

    await expect(service.submitEvidence({
      file: {
        path: uploadPath,
        originalname: 'failed-upload.txt',
        size: 16,
        mimetype: 'text/plain'
      } as Express.Multer.File,
      metadata: {
        caseId: 'CASE-001',
        type: 'document'
      },
      submittedBy: 'investigator@example.com'
    })).rejects.toThrow('hash failure');

    expect(fs.existsSync(uploadPath)).toBe(false);
  });

  it('retrieves evidence from blockchain storage', async () => {
    const evidence = {
      evidenceId: 'evidence-1',
      hash: 'hash-1',
      storagePath: '/tmp/evidence-1',
      metadata: {
        caseId: 'CASE-001',
        type: 'document'
      },
      status: EvidenceStatus.SUBMITTED,
      submittedAt: '2026-03-28T00:00:00.000Z',
      submittedBy: 'investigator@example.com',
      auditTrail: []
    };
    mockBlockchainService.getEvidence.mockResolvedValue(evidence);

    await expect(service.getEvidence('evidence-1')).resolves.toEqual(evidence);
    expect(mockBlockchainService.getEvidence).toHaveBeenCalledWith('evidence-1');
  });

  it('verifies evidence using an explicitly provided file path', async () => {
    mockBlockchainService.getEvidence.mockResolvedValue({
      evidenceId: 'evidence-1',
      hash: 'hash-1',
      storagePath: '/tmp/stored-evidence-1',
      metadata: {
        caseId: 'CASE-001',
        type: 'document'
      },
      status: EvidenceStatus.SUBMITTED,
      submittedAt: '2026-03-28T00:00:00.000Z',
      submittedBy: 'investigator@example.com',
      auditTrail: []
    });
    mockHashService.hashFile.mockResolvedValue('hash-1');

    const result = await service.verifyEvidence('evidence-1', '/tmp/provided-file');

    expect(mockHashService.hashFile).toHaveBeenCalledWith('/tmp/provided-file');
    expect(result).toEqual(expect.objectContaining({
      evidenceId: 'evidence-1',
      isValid: true,
      storedHash: 'hash-1',
      computedHash: 'hash-1'
    }));
  });

  it('verifies evidence using the stored file path when none is provided', async () => {
    mockBlockchainService.getEvidence.mockResolvedValue({
      evidenceId: 'evidence-1',
      hash: 'hash-1',
      storagePath: '/tmp/stored-evidence-1',
      metadata: {
        caseId: 'CASE-001',
        type: 'document'
      },
      status: EvidenceStatus.SUBMITTED,
      submittedAt: '2026-03-28T00:00:00.000Z',
      submittedBy: 'investigator@example.com',
      auditTrail: []
    });
    mockHashService.hashFile.mockResolvedValue('different-hash');

    const result = await service.verifyEvidence('evidence-1');

    expect(mockHashService.hashFile).toHaveBeenCalledWith('/tmp/stored-evidence-1');
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('hash mismatch');
  });

  it('returns evidence history and updates status through blockchain service', async () => {
    mockBlockchainService.getEvidenceHistory.mockResolvedValue([
      {
        timestamp: '2026-03-28T00:00:00.000Z',
        action: 'EVIDENCE_SUBMITTED',
        performedBy: 'investigator@example.com'
      }
    ]);
    mockBlockchainService.updateEvidenceStatus.mockResolvedValue({
      transactionId: 'tx-456',
      timestamp: '2026-03-28T01:00:00.000Z'
    });

    await expect(service.getEvidenceHistory('evidence-1')).resolves.toHaveLength(1);
    await expect(service.updateEvidenceStatus(
      'evidence-1',
      EvidenceStatus.VERIFIED,
      'reviewer@example.com',
      'Validated'
    )).resolves.toEqual({
      transactionId: 'tx-456',
      timestamp: '2026-03-28T01:00:00.000Z'
    });
  });

  it('reads stored evidence files and reports file presence', () => {
    const storedPath = path.join(process.env.EVIDENCE_STORAGE_PATH!, 'file-1');
    fs.mkdirSync(process.env.EVIDENCE_STORAGE_PATH!, { recursive: true });
    fs.writeFileSync(storedPath, 'stored-content');

    expect(service.evidenceFileExists('file-1')).toBe(true);
    expect(service.getEvidenceFile('file-1').toString()).toBe('stored-content');
    expect(service.evidenceFileExists('missing-file')).toBe(false);
    expect(() => service.getEvidenceFile('missing-file')).toThrow('Evidence file not found');
  });
});

describe('EvidenceStatus enum', () => {
  it('exposes the expected workflow values', () => {
    expect(EvidenceStatus.SUBMITTED).toBe('SUBMITTED');
    expect(EvidenceStatus.VERIFIED).toBe('VERIFIED');
    expect(EvidenceStatus.UNDER_REVIEW).toBe('UNDER_REVIEW');
    expect(EvidenceStatus.ADMITTED).toBe('ADMITTED');
    expect(EvidenceStatus.REJECTED).toBe('REJECTED');
    expect(EvidenceStatus.ARCHIVED).toBe('ARCHIVED');
  });
});
