import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BlockchainService } from '../../src/services/blockchain.service';
import { EvidenceStatus } from '../../src/models/evidence';

describe('BlockchainService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses mock mode when blockchain connection is skipped', async () => {
    process.env.SKIP_BLOCKCHAIN_CONNECT = 'true';

    const service = new BlockchainService();
    await service.connect();

    expect(service.isConnectionActive()).toBe(true);
    expect(service.isMockModeEnabled()).toBe(true);

    await service.disconnect();

    expect(service.isConnectionActive()).toBe(false);
    expect(service.isMockModeEnabled()).toBe(false);
  });

  it('stores, verifies, retrieves history, and updates evidence in mock mode', async () => {
    process.env.SKIP_BLOCKCHAIN_CONNECT = 'true';

    const service = new BlockchainService();
    const metadata = JSON.stringify({
      caseId: 'CASE-001',
      type: 'document',
      storagePath: '/tmp/evidence-1',
      originalFileName: 'report.txt',
      fileSize: 128,
      mimeType: 'text/plain'
    });

    const submitResult = await service.submitEvidence(
      'evidence-1',
      'hash-1',
      metadata,
      'investigator@example.com'
    );
    const evidence = await service.getEvidence('evidence-1');
    const verified = await service.verifyEvidence('evidence-1', 'hash-1');
    const rejected = await service.verifyEvidence('evidence-1', 'different-hash');
    const historyBeforeUpdate = await service.getEvidenceHistory('evidence-1');

    expect(submitResult.transactionId).toBeDefined();
    expect(evidence).toEqual(expect.objectContaining({
      evidenceId: 'evidence-1',
      hash: 'hash-1',
      status: EvidenceStatus.SUBMITTED
    }));
    expect(verified).toEqual(expect.objectContaining({
      isValid: true,
      storedHash: 'hash-1'
    }));
    expect(rejected).toEqual(expect.objectContaining({
      isValid: false
    }));
    expect(historyBeforeUpdate).toHaveLength(1);

    const updateResult = await service.updateEvidenceStatus(
      'evidence-1',
      EvidenceStatus.VERIFIED,
      'reviewer@example.com',
      'Validated'
    );
    const updatedEvidence = await service.getEvidence('evidence-1');

    expect(updateResult.transactionId).toBeDefined();
    expect(updatedEvidence.status).toBe(EvidenceStatus.VERIFIED);
    expect(updatedEvidence.auditTrail).toHaveLength(2);
  });

  it('throws for missing mock evidence', async () => {
    process.env.SKIP_BLOCKCHAIN_CONNECT = 'true';

    const service = new BlockchainService();

    await expect(service.getEvidence('missing-id')).rejects.toThrow('does not exist');
    await expect(service.getEvidenceHistory('missing-id')).rejects.toThrow('does not exist');
  });

  it('falls back to mock mode when the Fabric configuration cannot be loaded', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blockchain-service-'));
    process.env.SKIP_BLOCKCHAIN_CONNECT = 'false';
    process.env.FABRIC_CCP_PATH = path.join(tempRoot, 'missing-connection.json');
    process.env.FABRIC_WALLET_PATH = path.join(tempRoot, 'wallet');

    const service = new BlockchainService();
    await service.connect();

    expect(service.isConnectionActive()).toBe(true);
    expect(service.isMockModeEnabled()).toBe(true);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
});
