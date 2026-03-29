import { Context, Contract, Info, Returns, Transaction } from 'fabric-contract-api';
import { EvidenceRecord, EvidenceStatus, AuditEntry } from './models/evidence';

/**
 * Evidence Chaincode
 *
 * Smart contract for managing digital evidence on Hyperledger Fabric
 */
@Info({
  title: 'Evidence Chaincode',
  description: 'Blockchain-based digital evidence management system'
})
export class EvidenceContract extends Contract {

  /**
   * Submit new evidence to the blockchain
   *
   * @param ctx - The transaction context
   * @param evidenceId - Unique identifier for the evidence
   * @param hash - SHA-256 hash of the evidence file
   * @param metadataJson - JSON string containing evidence metadata
   * @param submittedBy - Identity of the person submitting the evidence
   * @param timestamp - ISO timestamp of submission
   * @returns Transaction ID
   */
  @Transaction()
  public async SubmitEvidence(
    ctx: Context,
    evidenceId: string,
    hash: string,
    metadataJson: string,
    submittedBy: string,
    timestamp: string
  ): Promise<string> {
    // Validate inputs
    if (!evidenceId || evidenceId.trim() === '') {
      throw new Error('Evidence ID is required');
    }

    if (!hash || hash.trim() === '') {
      throw new Error('Evidence hash is required');
    }

    if (!submittedBy || submittedBy.trim() === '') {
      throw new Error('Submitter identity is required');
    }

    // Check if evidence already exists
    const exists = await this.EvidenceExists(ctx, evidenceId);
    if (exists) {
      throw new Error(`Evidence ${evidenceId} already exists`);
    }

    // Parse metadata
    let metadata: Record<string, string>;
    try {
      metadata = JSON.parse(metadataJson);
    } catch (error) {
      throw new Error('Invalid metadata JSON format');
    }

    // Create audit trail entry
    const auditEntry: AuditEntry = {
      timestamp,
      action: 'EVIDENCE_SUBMITTED',
      performedBy: submittedBy,
      details: 'Evidence submitted to blockchain',
      transactionId: ctx.stub.getTxID()
    };

    // Create evidence record
    const evidence: EvidenceRecord = {
      evidenceId,
      hash,
      storagePath: metadata.storagePath || '',
      originalFileName: metadata.originalFileName,
      fileSize: metadata.fileSize ? parseInt(metadata.fileSize as unknown as string) : undefined,
      mimeType: metadata.mimeType,
      metadata,
      status: EvidenceStatus.SUBMITTED,
      submittedAt: timestamp,
      submittedBy,
      auditTrail: [auditEntry]
    };

    // Save to state
    await ctx.stub.putState(evidenceId, Buffer.from(JSON.stringify(evidence)));

    // Emit event
    ctx.stub.setEvent('EvidenceSubmitted', Buffer.from(JSON.stringify({
      evidenceId,
      timestamp,
      submittedBy
    })));

    return ctx.stub.getTxID();
  }

  /**
   * Retrieve evidence record by ID
   *
   * @param ctx - The transaction context
   * @param evidenceId - Unique identifier for the evidence
   * @returns Evidence record
   */
  @Transaction(false)
  public async GetEvidence(ctx: Context, evidenceId: string): Promise<EvidenceRecord> {
    if (!evidenceId || evidenceId.trim() === '') {
      throw new Error('Evidence ID is required');
    }

    const exists = await this.EvidenceExists(ctx, evidenceId);
    if (!exists) {
      throw new Error(`Evidence ${evidenceId} does not exist`);
    }

    const data = await ctx.stub.getState(evidenceId);
    const evidence = JSON.parse(data.toString()) as EvidenceRecord;

    return evidence;
  }

  /**
   * Verify evidence hash against stored record
   *
   * @param ctx - The transaction context
   * @param evidenceId - Unique identifier for the evidence
   * @param providedHash - Hash to verify against stored hash
   * @returns Verification result
   */
  @Transaction(false)
  public async VerifyEvidence(
    ctx: Context,
    evidenceId: string,
    providedHash: string
  ): Promise<{ isValid: boolean; storedHash: string; message: string }> {
    const evidence = await this.GetEvidence(ctx, evidenceId);
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
   * Get the audit history of an evidence item
   *
   * @param ctx - The transaction context
   * @param evidenceId - Unique identifier for the evidence
   * @returns Array of audit entries
   */
  @Transaction(false)
  public async GetEvidenceHistory(ctx: Context, evidenceId: string): Promise<AuditEntry[]> {
    if (!evidenceId || evidenceId.trim() === '') {
      throw new Error('Evidence ID is required');
    }

    const exists = await this.EvidenceExists(ctx, evidenceId);
    if (!exists) {
      throw new Error(`Evidence ${evidenceId} does not exist`);
    }

    const evidence = await this.GetEvidence(ctx, evidenceId);
    return evidence.auditTrail;
  }

  /**
   * Update the status of an evidence item
   *
   * @param ctx - The transaction context
   * @param evidenceId - Unique identifier for the evidence
   * @param status - New status value
   * @param updatedBy - Identity of the person updating the status
   * @param timestamp - ISO timestamp of update
   * @param details - Optional details about the status change
   * @returns Transaction ID
   */
  @Transaction()
  public async UpdateEvidenceStatus(
    ctx: Context,
    evidenceId: string,
    status: string,
    updatedBy: string,
    timestamp: string,
    details: string
  ): Promise<string> {
    // Validate inputs
    if (!evidenceId || evidenceId.trim() === '') {
      throw new Error('Evidence ID is required');
    }

    if (!status || status.trim() === '') {
      throw new Error('Status is required');
    }

    if (!updatedBy || updatedBy.trim() === '') {
      throw new Error('Updater identity is required');
    }

    // Validate status value
    const validStatuses = Object.values(EvidenceStatus);
    if (!validStatuses.includes(status as EvidenceStatus)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Get existing evidence
    const evidence = await this.GetEvidence(ctx, evidenceId);

    // Update status
    evidence.status = status as EvidenceStatus;

    // Add audit entry
    const auditEntry: AuditEntry = {
      timestamp,
      action: 'STATUS_UPDATED',
      performedBy: updatedBy,
      details: details || `Status changed to ${status}`,
      transactionId: ctx.stub.getTxID()
    };

    evidence.auditTrail.push(auditEntry);

    // Save updated record
    await ctx.stub.putState(evidenceId, Buffer.from(JSON.stringify(evidence)));

    // Emit event
    ctx.stub.setEvent('EvidenceStatusUpdated', Buffer.from(JSON.stringify({
      evidenceId,
      status,
      timestamp,
      updatedBy
    })));

    return ctx.stub.getTxID();
  }

  /**
   * Query evidence by case ID
   *
   * @param ctx - The transaction context
   * @param caseId - Case ID to filter by
   * @returns Array of evidence records
   */
  @Transaction(false)
  public async GetEvidenceByCaseId(ctx: Context, caseId: string): Promise<EvidenceRecord[]> {
    if (!caseId || caseId.trim() === '') {
      throw new Error('Case ID is required');
    }

    const query = {
      selector: {
        'metadata.caseId': caseId
      }
    };

    const resultsIterator = await ctx.stub.getQueryResult(JSON.stringify(query));
    const results = await this.getAllResults(resultsIterator);

    return results as EvidenceRecord[];
  }

  /**
   * Query evidence by submitter
   *
   * @param ctx - The transaction context
   * @param submittedBy - Submitter identity to filter by
   * @returns Array of evidence records
   */
  @Transaction(false)
  public async GetEvidenceBySubmitter(ctx: Context, submittedBy: string): Promise<EvidenceRecord[]> {
    if (!submittedBy || submittedBy.trim() === '') {
      throw new Error('Submitter identity is required');
    }

    const query = {
      selector: {
        submittedBy
      }
    };

    const resultsIterator = await ctx.stub.getQueryResult(JSON.stringify(query));
    const results = await this.getAllResults(resultsIterator);

    return results as EvidenceRecord[];
  }

  /**
   * Query evidence by status
   *
   * @param ctx - The transaction context
   * @param status - Status to filter by
   * @returns Array of evidence records
   */
  @Transaction(false)
  public async GetEvidenceByStatus(ctx: Context, status: string): Promise<EvidenceRecord[]> {
    if (!status || status.trim() === '') {
      throw new Error('Status is required');
    }

    const query = {
      selector: {
        status
      }
    };

    const resultsIterator = await ctx.stub.getQueryResult(JSON.stringify(query));
    const results = await this.getAllResults(resultsIterator);

    return results as EvidenceRecord[];
  }

  /**
   * Check if an evidence record exists
   */
  private async EvidenceExists(ctx: Context, evidenceId: string): Promise<boolean> {
    const data = await ctx.stub.getState(evidenceId);
    return !!data && data.length > 0;
  }

  /**
   * Helper method to get all results from iterator
   */
  private async getAllResults(iterator: any): Promise<any[]> {
    const results: any[] = [];
    let result = await iterator.next();

    while (!result.done) {
      if (result.value) {
        const record = JSON.parse(result.value.value.toString('utf8'));
        results.push(record);
      }
      result = await iterator.next();
    }

    await iterator.close();
    return results;
  }
}
