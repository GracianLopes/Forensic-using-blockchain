import evidenceRouter from '../../src/api/routes/evidence';
import healthRouter from '../../src/api/routes/health';
import evidenceService from '../../src/services/evidence.service';
import blockchainService from '../../src/services/blockchain.service';
import { EvidenceStatus } from '../../src/models/evidence';

jest.mock('../../src/services/evidence.service', () => ({
  __esModule: true,
  default: {
    submitEvidence: jest.fn(),
    getEvidence: jest.fn(),
    verifyEvidence: jest.fn(),
    getEvidenceHistory: jest.fn(),
    getEvidenceFile: jest.fn(),
    updateEvidenceStatus: jest.fn()
  }
}));

jest.mock('../../src/services/blockchain.service', () => ({
  __esModule: true,
  default: {
    isConnectionActive: jest.fn(),
    isMockModeEnabled: jest.fn()
  }
}));

type MockResponse = {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  status: jest.Mock;
  json: jest.Mock;
  setHeader: jest.Mock;
  send: jest.Mock;
};

function createResponse(): MockResponse {
  const response: MockResponse = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
    send: jest.fn()
  };

  response.status.mockImplementation((code: number) => {
    response.statusCode = code;
    return response;
  });

  response.json.mockImplementation((body: unknown) => {
    response.body = body;
    return response;
  });

  response.setHeader.mockImplementation((name: string, value: string) => {
    response.headers[name] = value;
    return response;
  });

  response.send.mockImplementation((body: unknown) => {
    response.body = body;
    return response;
  });

  return response;
}

function getRouteHandler(router: unknown, method: string, routePath: string): Function {
  const layer = (router as any).stack.find((entry: any) => (
    entry.route?.path === routePath && entry.route.methods?.[method]
  ));

  if (!layer) {
    throw new Error(`Route not found: ${method.toUpperCase()} ${routePath}`);
  }

  return layer.route.stack[layer.route.stack.length - 1].handle;
}

describe('API route handlers', () => {
  const mockEvidenceService = evidenceService as jest.Mocked<typeof evidenceService>;
  const mockBlockchainService = blockchainService as jest.Mocked<typeof blockchainService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBlockchainService.isConnectionActive.mockReturnValue(true);
    mockBlockchainService.isMockModeEnabled.mockReturnValue(false);
  });

  describe('health routes', () => {
    it('returns a healthy status', async () => {
      const handler = getRouteHandler(healthRouter, 'get', '/');
      const response = createResponse();

      handler({} as any, response);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        success: true,
        status: 'healthy'
      }));
    });

    it('reports blockchain connectivity', async () => {
      const handler = getRouteHandler(healthRouter, 'get', '/blockchain');
      const response = createResponse();

      await handler({} as any, response);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        success: true,
        status: 'connected'
      }));
    });

    it('returns a disconnected status when blockchain is unavailable', async () => {
      const handler = getRouteHandler(healthRouter, 'get', '/blockchain');
      const response = createResponse();
      mockBlockchainService.isConnectionActive.mockReturnValue(false);

      await handler({} as any, response);

      expect(response.statusCode).toBe(503);
      expect(response.body).toEqual(expect.objectContaining({
        success: false,
        status: 'disconnected'
      }));
    });
  });

  describe('evidence routes', () => {
    it('submits evidence successfully', async () => {
      const handler = getRouteHandler(evidenceRouter, 'post', '/');
      const response = createResponse();
      const next = jest.fn();
      const request = {
        file: {
          path: '/tmp/test-file.txt',
          originalname: 'test.txt',
          size: 128,
          mimetype: 'text/plain'
        },
        body: {
          metadata: JSON.stringify({
            caseId: 'CASE-001',
            type: 'document',
            description: 'Test evidence'
          }),
          submittedBy: 'investigator@example.com'
        }
      };

      mockEvidenceService.submitEvidence.mockResolvedValue({
        evidenceId: 'evidence-1',
        hash: 'hash-1',
        transactionId: 'tx-1',
        timestamp: '2026-03-28T00:00:00.000Z'
      });

      await handler(request as any, response, next);

      expect(mockEvidenceService.submitEvidence).toHaveBeenCalledWith({
        file: request.file,
        metadata: {
          caseId: 'CASE-001',
          type: 'document',
          description: 'Test evidence'
        },
        submittedBy: 'investigator@example.com'
      });
      expect(response.statusCode).toBe(201);
      expect(response.body).toEqual({
        success: true,
        data: {
          evidenceId: 'evidence-1',
          hash: 'hash-1',
          transactionId: 'tx-1',
          timestamp: '2026-03-28T00:00:00.000Z'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects a submission without a file', async () => {
      const handler = getRouteHandler(evidenceRouter, 'post', '/');
      const response = createResponse();

      await handler({
        body: {
          metadata: JSON.stringify({ caseId: 'CASE-001', type: 'document' })
        }
      } as any, response, jest.fn());

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: 'No file provided' });
    });

    it('rejects invalid metadata', async () => {
      const handler = getRouteHandler(evidenceRouter, 'post', '/');
      const response = createResponse();

      await handler({
        file: {
          path: '/tmp/test-file.txt',
          originalname: 'test.txt',
          size: 128,
          mimetype: 'text/plain'
        },
        body: {
          metadata: 'not-json'
        }
      } as any, response, jest.fn());

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid metadata format' });
    });

    it('rejects missing required metadata fields', async () => {
      const handler = getRouteHandler(evidenceRouter, 'post', '/');
      const response = createResponse();

      await handler({
        file: {
          path: '/tmp/test-file.txt',
          originalname: 'test.txt',
          size: 128,
          mimetype: 'text/plain'
        },
        body: {
          metadata: JSON.stringify({ caseId: 'CASE-001' })
        }
      } as any, response, jest.fn());

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: 'Missing required metadata fields: caseId, type'
      });
    });

    it('retrieves evidence', async () => {
      const handler = getRouteHandler(evidenceRouter, 'get', '/:id');
      const response = createResponse();
      mockEvidenceService.getEvidence.mockResolvedValue({
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
      });

      await handler({ params: { id: 'evidence-1' } } as any, response, jest.fn());

      expect(mockEvidenceService.getEvidence).toHaveBeenCalledWith('evidence-1');
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        success: true
      }));
    });

    it('verifies evidence', async () => {
      const handler = getRouteHandler(evidenceRouter, 'get', '/:id/verify');
      const response = createResponse();
      mockEvidenceService.verifyEvidence.mockResolvedValue({
        evidenceId: 'evidence-1',
        isValid: true,
        storedHash: 'stored-hash',
        computedHash: 'stored-hash',
        message: 'Evidence integrity verified successfully',
        verifiedAt: '2026-03-28T00:00:00.000Z'
      });

      await handler({ params: { id: 'evidence-1' } } as any, response, jest.fn());

      expect(mockEvidenceService.verifyEvidence).toHaveBeenCalledWith('evidence-1', undefined, undefined);
      expect(response.body).toEqual(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          isValid: true
        })
      }));
    });

    it('verifies evidence using provided hash from query string', async () => {
      const handler = getRouteHandler(evidenceRouter, 'get', '/:id/verify');
      const response = createResponse();
      mockEvidenceService.verifyEvidence.mockResolvedValue({
        evidenceId: 'evidence-1',
        isValid: false,
        storedHash: 'stored-hash',
        computedHash: 'computed-hash',
        message: 'Evidence integrity check failed - hash mismatch',
        verifiedAt: '2026-03-28T00:00:00.000Z'
      });

      await handler(
        { params: { id: 'evidence-1' }, query: { hash: 'different-hash' } } as any,
        response,
        jest.fn()
      );

      expect(mockEvidenceService.verifyEvidence).toHaveBeenCalledWith(
        'evidence-1',
        undefined,
        'different-hash'
      );
      expect(response.body).toEqual(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          isValid: false
        })
      }));
    });

    it('returns evidence history', async () => {
      const handler = getRouteHandler(evidenceRouter, 'get', '/:id/history');
      const response = createResponse();
      mockEvidenceService.getEvidenceHistory.mockResolvedValue([
        {
          timestamp: '2026-03-28T00:00:00.000Z',
          action: 'EVIDENCE_SUBMITTED',
          performedBy: 'investigator@example.com'
        }
      ]);

      await handler({ params: { id: 'evidence-1' } } as any, response, jest.fn());

      expect(mockEvidenceService.getEvidenceHistory).toHaveBeenCalledWith('evidence-1');
      expect(response.body).toEqual(expect.objectContaining({
        success: true,
        data: expect.any(Array)
      }));
    });

    it('returns an evidence file download', async () => {
      const handler = getRouteHandler(evidenceRouter, 'get', '/:id/file');
      const response = createResponse();
      const fileBuffer = Buffer.from('file-content');

      mockEvidenceService.getEvidence.mockResolvedValue({
        evidenceId: 'evidence-1',
        hash: 'hash-1',
        originalFileName: 'report.txt',
        mimeType: 'text/plain',
        storagePath: '/tmp/evidence-1',
        metadata: {
          caseId: 'CASE-001',
          type: 'document'
        },
        status: EvidenceStatus.SUBMITTED,
        submittedAt: '2026-03-28T00:00:00.000Z',
        submittedBy: 'investigator@example.com',
        auditTrail: []
      });
      mockEvidenceService.getEvidenceFile.mockReturnValue(fileBuffer);

      await handler({ params: { id: 'evidence-1' } } as any, response, jest.fn());

      expect(mockEvidenceService.getEvidenceFile).toHaveBeenCalledWith('evidence-1');
      expect(response.headers['Content-Type']).toBe('text/plain');
      expect(response.headers['Content-Disposition']).toBe('attachment; filename="report.txt"');
      expect(response.body).toBe(fileBuffer);
    });

    it('updates evidence status', async () => {
      const handler = getRouteHandler(evidenceRouter, 'put', '/:id/status');
      const response = createResponse();
      mockEvidenceService.updateEvidenceStatus.mockResolvedValue({
        transactionId: 'tx-2',
        timestamp: '2026-03-28T00:00:00.000Z'
      });

      await handler({
        params: { id: 'evidence-1' },
        body: {
          status: EvidenceStatus.VERIFIED,
          updatedBy: 'reviewer@example.com',
          details: 'Validated'
        }
      } as any, response, jest.fn());

      expect(mockEvidenceService.updateEvidenceStatus).toHaveBeenCalledWith(
        'evidence-1',
        EvidenceStatus.VERIFIED,
        'reviewer@example.com',
        'Validated'
      );
      expect(response.body).toEqual({
        success: true,
        data: {
          transactionId: 'tx-2',
          timestamp: '2026-03-28T00:00:00.000Z'
        }
      });
    });

    it('rejects invalid statuses', async () => {
      const handler = getRouteHandler(evidenceRouter, 'put', '/:id/status');
      const response = createResponse();

      await handler({
        params: { id: 'evidence-1' },
        body: {
          status: 'INVALID_STATUS',
          updatedBy: 'reviewer@example.com'
        }
      } as any, response, jest.fn());

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: `Invalid status. Must be one of: ${Object.values(EvidenceStatus).join(', ')}`
      });
    });

    it('rejects missing status update fields', async () => {
      const handler = getRouteHandler(evidenceRouter, 'put', '/:id/status');
      const response = createResponse();

      await handler({
        params: { id: 'evidence-1' },
        body: {
          status: EvidenceStatus.VERIFIED
        }
      } as any, response, jest.fn());

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: 'Missing required fields: status, updatedBy'
      });
    });

    it('passes service errors to next()', async () => {
      const handler = getRouteHandler(evidenceRouter, 'get', '/:id');
      const response = createResponse();
      const next = jest.fn();
      const failure = new Error('lookup failed');
      mockEvidenceService.getEvidence.mockRejectedValue(failure);

      await handler({ params: { id: 'evidence-1' } } as any, response, next);

      expect(next).toHaveBeenCalledWith(failure);
    });
  });
});
