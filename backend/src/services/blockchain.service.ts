import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { EvidenceRecord, AuditEntry, EvidenceStatus } from '../models/evidence';

// Mock types for when Fabric is not available
type MockEvidenceStore = Map<string, EvidenceRecord>;
type FabricContractLike = {
  submitTransaction(transactionName: string, ...args: string[]): Promise<Uint8Array>;
  evaluateTransaction(transactionName: string, ...args: string[]): Promise<Uint8Array>;
};
type FabricGatewayLike = {
  disconnect(): void;
};

/**
 * Service for Hyperledger Fabric blockchain operations
 * Falls back to in-memory storage when Fabric is unavailable
 */
export class BlockchainService {
  private isConnected: boolean = false;
  private isMockMode: boolean = false;
  private gateway: FabricGatewayLike | null = null;
  private contract: FabricContractLike | null = null;

  // Mock storage for development mode
  private mockStore: MockEvidenceStore = new Map();

  private readonly ccpPath: string;
  private readonly walletPath: string;
  private readonly channelName: string;
  private readonly chaincodeName: string;
  private readonly orgMSP: string;
  private readonly skipConnect: boolean;

  constructor() {
    this.ccpPath = process.env.FABRIC_CCP_PATH || path.resolve(__dirname, '../../../blockchain/config/connection-org1.json');
    this.walletPath = process.env.FABRIC_WALLET_PATH || path.resolve(__dirname, '../../wallet');
    this.channelName = process.env.FABRIC_CHANNEL || 'forensic-channel';
    this.chaincodeName = process.env.FABRIC_CHAINCODE || 'evidence-chaincode';
    this.orgMSP = process.env.FABRIC_ORG_MSP || 'Org1MSP';
    this.skipConnect = process.env.SKIP_BLOCKCHAIN_CONNECT === 'true';
  }

  /**
   * Initialize connection to Fabric network
   * Falls back to mock mode if Fabric is unavailable
   */
  async connect(): Promise<void> {
    // If skip connect is enabled, start in mock mode
    if (this.skipConnect) {
      this.enableMockMode();
      return;
    }

    logger.info('Connecting to Fabric network...', {
      channel: this.channelName,
      chaincode: this.chaincodeName
    });

    try {
      // Dynamically import fabric-network to avoid errors when not installed
      const { Gateway, Wallets } = await import('fabric-network');

      // Create wallet
      const wallet = await Wallets.newFileSystemWallet(this.walletPath);
      logger.info(`Wallet path: ${this.walletPath}`);

      // Load connection profile
      const ccp = await this.loadConnectionProfile();

      // Check if identity exists
      const userId = 'appUser';
      const identity = await wallet.get(userId);

      if (!identity) {
        logger.warn('Identity not found. Please enroll user first.');
        throw new Error('User identity not found. Run enrollment script first.');
      }

      // Set gateway options
      const options = {
        wallet,
        identity: userId,
        discovery: { enabled: true, asLocalhost: true },
        eventHandlerOptions: {
          commitTimeout: 300,
          strategyTimeout: 15
        }
      };

      // Connect to gateway
      const gateway = new Gateway();
      await gateway.connect(ccp, options);
      logger.info('Connected to gateway');

      // Get network and contract
      const network = await gateway.getNetwork(this.channelName);
      logger.info(`Connected to channel: ${this.channelName}`);

      this.gateway = gateway as FabricGatewayLike;
      this.contract = network.getContract(this.chaincodeName) as FabricContractLike;
      logger.info(`Connected to chaincode: ${this.chaincodeName}`);

      this.isMockMode = false;
      this.isConnected = true;
      logger.info('Successfully connected to Fabric network');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const logContext = { error };

      if (errorMessage.includes('User identity not found')) {
        logger.warn('Fabric identity missing - cannot connect to real network', logContext);
      } else {
        logger.error('Failed to connect to Fabric network', logContext);
      }
      logger.warn('Starting in mock mode - blockchain operations will be simulated');
      this.enableMockMode();
    }
  }

  /**
   * Enable mock mode for development without Fabric
   */
  private enableMockMode(): void {
    this.isMockMode = true;
    this.isConnected = true; // Consider "connected" for mock mode
    this.gateway = null;
    this.contract = null;
    logger.info('Mock mode enabled - using in-memory storage');
  }

  /**
   * Disconnect from Fabric network
   */
  async disconnect(): Promise<void> {
    try {
      if (this.gateway) {
        this.gateway.disconnect();
      }

      if (this.isConnected || this.isMockMode) {
        this.gateway = null;
        this.contract = null;
        this.isConnected = false;
        this.isMockMode = false;
        logger.info('Disconnected from Fabric network');
      }
    } catch (error) {
      logger.error('Error disconnecting from Fabric', { error });
    }
  }

  /**
   * Submit evidence to blockchain
   */
  async submitEvidence(
    evidenceId: string,
    hash: string,
    metadata: string,
    submittedBy: string
  ): Promise<{ transactionId: string; timestamp: string }> {
    await this.ensureConnected();
    const timestamp = new Date().toISOString();

    if (this.isMockMode) {
      return this.mockSubmitEvidence(evidenceId, hash, metadata, submittedBy, timestamp);
    }

    logger.info('Submitting evidence to blockchain', { evidenceId, submittedBy });

    const transactionId = await this.getContract().submitTransaction(
      'SubmitEvidence',
      evidenceId,
      hash,
      metadata,
      submittedBy,
      timestamp
    );

    logger.info('Evidence submitted successfully', { transactionId });

    return {
      transactionId: transactionId.toString(),
      timestamp
    };
  }

  /**
   * Mock implementation of submitEvidence for development
   */
  private mockSubmitEvidence(
    evidenceId: string,
    hash: string,
    metadata: string,
    submittedBy: string,
    timestamp: string
  ): { transactionId: string; timestamp: string } {
    const parsedMetadata = JSON.parse(metadata);
    const transactionId = uuidv4();

    const auditEntry: AuditEntry = {
      timestamp,
      action: 'EVIDENCE_SUBMITTED',
      performedBy: submittedBy,
      details: 'Evidence submitted (mock mode)',
      transactionId
    };

    const evidence: EvidenceRecord = {
      evidenceId,
      hash,
      storagePath: parsedMetadata.storagePath || '',
      originalFileName: parsedMetadata.originalFileName,
      fileSize: parsedMetadata.fileSize ? parseInt(parsedMetadata.fileSize) : undefined,
      mimeType: parsedMetadata.mimeType,
      metadata: parsedMetadata,
      status: EvidenceStatus.SUBMITTED,
      submittedAt: timestamp,
      submittedBy,
      auditTrail: [auditEntry]
    };

    this.mockStore.set(evidenceId, evidence);
    logger.info('Evidence submitted (mock mode)', { evidenceId, transactionId });

    return { transactionId, timestamp };
  }

  /**
   * Get evidence record from blockchain
   */
  async getEvidence(evidenceId: string): Promise<EvidenceRecord> {
    await this.ensureConnected();

    if (this.isMockMode) {
      return this.mockGetEvidence(evidenceId);
    }

    logger.info('Retrieving evidence from blockchain', { evidenceId });

    const result = await this.getContract().evaluateTransaction('GetEvidence', evidenceId);
    return JSON.parse(result.toString()) as EvidenceRecord;
  }

  /**
   * Mock implementation of getEvidence for development
   */
  private mockGetEvidence(evidenceId: string): EvidenceRecord {
    const evidence = this.mockStore.get(evidenceId);
    if (!evidence) {
      throw new Error(`Evidence ${evidenceId} does not exist`);
    }
    return evidence;
  }

  /**
   * Verify evidence hash against blockchain record
   */
  async verifyEvidence(evidenceId: string, providedHash: string): Promise<{
    isValid: boolean;
    storedHash: string;
    message: string;
  }> {
    await this.ensureConnected();

    if (this.isMockMode) {
      return this.mockVerifyEvidence(evidenceId, providedHash);
    }

    logger.info('Verifying evidence', { evidenceId });

    const result = await this.getContract().evaluateTransaction('VerifyEvidence', evidenceId, providedHash);
    const verification = JSON.parse(result.toString());

    return {
      isValid: verification.isValid,
      storedHash: verification.storedHash,
      message: verification.message
    };
  }

  /**
   * Mock implementation of verifyEvidence for development
   */
  private mockVerifyEvidence(evidenceId: string, providedHash: string): {
    isValid: boolean;
    storedHash: string;
    message: string;
  } {
    const evidence = this.mockStore.get(evidenceId);
    if (!evidence) {
      throw new Error(`Evidence ${evidenceId} does not exist`);
    }

    const storedHash = evidence.hash.toLowerCase();
    const submittedHash = providedHash.toLowerCase();
    const isValid = storedHash === submittedHash;

    return {
      isValid,
      storedHash,
      message: isValid
        ? 'Evidence integrity verified - hashes match'
        : 'Evidence integrity check failed - hash mismatch'
    };
  }

  /**
   * Get evidence audit history
   */
  async getEvidenceHistory(evidenceId: string): Promise<AuditEntry[]> {
    await this.ensureConnected();

    if (this.isMockMode) {
      return this.mockGetEvidenceHistory(evidenceId);
    }

    logger.info('Retrieving evidence history', { evidenceId });

    const result = await this.getContract().evaluateTransaction('GetEvidenceHistory', evidenceId);
    return JSON.parse(result.toString()) as AuditEntry[];
  }

  /**
   * Mock implementation of getEvidenceHistory for development
   */
  private mockGetEvidenceHistory(evidenceId: string): AuditEntry[] {
    const evidence = this.mockStore.get(evidenceId);
    if (!evidence) {
      throw new Error(`Evidence ${evidenceId} does not exist`);
    }
    return evidence.auditTrail;
  }

  /**
   * Update evidence status
   */
  async updateEvidenceStatus(
    evidenceId: string,
    status: string,
    updatedBy: string,
    details?: string
  ): Promise<{ transactionId: string; timestamp: string }> {
    await this.ensureConnected();
    const timestamp = new Date().toISOString();

    if (this.isMockMode) {
      return this.mockUpdateEvidenceStatus(evidenceId, status, updatedBy, timestamp, details);
    }

    logger.info('Updating evidence status', { evidenceId, status, updatedBy });

    const transactionId = await this.getContract().submitTransaction(
      'UpdateEvidenceStatus',
      evidenceId,
      status,
      updatedBy,
      timestamp,
      details || ''
    );

    return {
      transactionId: transactionId.toString(),
      timestamp
    };
  }

  /**
   * Mock implementation of updateEvidenceStatus for development
   */
  private mockUpdateEvidenceStatus(
    evidenceId: string,
    status: string,
    updatedBy: string,
    timestamp: string,
    details?: string
  ): { transactionId: string; timestamp: string } {
    const evidence = this.mockStore.get(evidenceId);
    if (!evidence) {
      throw new Error(`Evidence ${evidenceId} does not exist`);
    }

    if (evidence.status === status) {
      throw new Error(`Evidence is already in status ${status}`);
    }

    const transactionId = uuidv4();
    evidence.status = status as EvidenceStatus;

    const auditEntry: AuditEntry = {
      timestamp,
      action: 'STATUS_UPDATED',
      performedBy: updatedBy,
      details: details || `Status changed to ${status}`,
      transactionId
    };

    evidence.auditTrail.push(auditEntry);
    this.mockStore.set(evidenceId, evidence);

    logger.info('Evidence status updated (mock mode)', { evidenceId, status });

    return { transactionId, timestamp };
  }

  /**
   * Ensure blockchain connection is active
   */
  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  /**
   * Get the active Fabric contract
   */
  private getContract(): FabricContractLike {
    if (!this.contract) {
      throw new Error('Fabric contract not initialized');
    }

    return this.contract;
  }

  /**
   * Load connection profile from file
   */
  private async loadConnectionProfile(): Promise<Record<string, unknown>> {
    try {
      const ccpContent = await fs.promises.readFile(this.ccpPath, 'utf8');
      const ccp = JSON.parse(ccpContent) as Record<string, unknown>;

      this.normalizeConnectionProfilePaths(ccp);

      return ccp;
    } catch (error) {
      logger.error('Failed to load connection profile', { error, path: this.ccpPath });
      throw new Error(`Failed to load connection profile: ${error}`);
    }
  }

  /**
   * Resolve relative tlsCACerts paths in the connection profile
   */
  private normalizeConnectionProfilePaths(ccp: Record<string, unknown>): void {
    const ccpDir = path.dirname(this.ccpPath);

    const peers = ccp.peers as Record<string, { tlsCACerts?: { path?: string } }> | undefined;
    const cas = ccp.certificateAuthorities as Record<string, { tlsCACerts?: { path?: string } }> | undefined;

    if (peers) {
      Object.values(peers).forEach((peer) => {
        if (peer?.tlsCACerts?.path) {
          peer.tlsCACerts.path = this.resolveRelativePath(ccpDir, peer.tlsCACerts.path);
        }
      });
    }

    if (cas) {
      Object.values(cas).forEach((ca) => {
        if (ca?.tlsCACerts?.path) {
          ca.tlsCACerts.path = this.resolveRelativePath(ccpDir, ca.tlsCACerts.path);
        }
      });
    }
  }

  private resolveRelativePath(baseDir: string, targetPath: string): string {
    return path.isAbsolute(targetPath) ? targetPath : path.resolve(baseDir, targetPath);
  }

  /**
   * Check connection status
   */
  isConnectionActive(): boolean {
    return this.isConnected;
  }

  /**
   * Check if running in mock mode
   */
  isMockModeEnabled(): boolean {
    return this.isMockMode;
  }
}

export default new BlockchainService();
