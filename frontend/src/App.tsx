import { useDeferredValue, useEffect, useRef, useState, startTransition } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  fetchBlockchainHealth,
  fetchHealth,
  getEvidenceById,
  getEvidenceHistory,
  normalizeApiError,
  submitEvidence,
  updateEvidenceStatus,
  verifyEvidenceById
} from './api';
import type {
  AuditEntry,
  EvidenceRecord,
  EvidenceStatus,
  HealthResponse,
  SubmitEvidenceResult,
  VerifyEvidenceResult
} from './types';

const statusOptions: EvidenceStatus[] = [
  'SUBMITTED',
  'VERIFIED',
  'UNDER_REVIEW',
  'ADMITTED',
  'REJECTED',
  'ARCHIVED'
];

gsap.registerPlugin(ScrollTrigger);

export default function App() {
  const { scrollYProgress } = useScroll();
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  const workflowRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [blockchainHealth, setBlockchainHealth] = useState<HealthResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeAction, setActiveAction] = useState<string>('');

  const [file, setFile] = useState<File | null>(null);
  const [caseId, setCaseId] = useState('CASE-001');
  const [evidenceType, setEvidenceType] = useState('document');
  const [description, setDescription] = useState('');
  const [collectionDate, setCollectionDate] = useState('');
  const [location, setLocation] = useState('');
  const [submittedBy, setSubmittedBy] = useState('investigator@example.com');

  const [submitResult, setSubmitResult] = useState<SubmitEvidenceResult | null>(null);
  const [evidenceIdInput, setEvidenceIdInput] = useState('');
  const deferredEvidenceId = useDeferredValue(evidenceIdInput.trim());
  const [evidenceRecord, setEvidenceRecord] = useState<EvidenceRecord | null>(null);
  const [hashToVerify, setHashToVerify] = useState('');
  const [verifyResult, setVerifyResult] = useState<VerifyEvidenceResult | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);

  const [statusToSet, setStatusToSet] = useState<EvidenceStatus>('VERIFIED');
  const [statusUpdatedBy, setStatusUpdatedBy] = useState('supervisor@example.com');
  const [statusDetails, setStatusDetails] = useState('Verified after chain-of-custody review');
  const [statusUpdateResult, setStatusUpdateResult] = useState<{ transactionId: string; timestamp: string } | null>(null);
  const isNoStatusChange = Boolean(
    evidenceRecord && evidenceRecord.evidenceId === deferredEvidenceId && evidenceRecord.status === statusToSet
  );

  useEffect(() => {
    checkSystemStatus();
  }, []);

  useEffect(() => {
    const cards = workflowRef.current?.querySelectorAll<HTMLElement>('.workflow-card');
    if (!cards?.length) {
      return;
    }

    const animation = gsap.fromTo(
      cards,
      { y: 60, opacity: 0, rotateX: 10 },
      {
        y: 0,
        opacity: 1,
        rotateX: 0,
        stagger: 0.18,
        duration: 0.9,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: workflowRef.current,
          start: 'top 72%',
          once: true
        }
      }
    );

    return () => {
      animation.scrollTrigger?.kill();
      animation.kill();
    };
  }, []);

  async function checkSystemStatus() {
    setErrorMessage('');
    setActiveAction('status');

    try {
      const apiHealth = await fetchHealth();
      setHealth(apiHealth);
    } catch (error) {
      setErrorMessage(normalizeApiError(error));
    }

    try {
      const networkHealth = await fetchBlockchainHealth();
      setBlockchainHealth(networkHealth);
    } catch (error) {
      setBlockchainHealth({
        success: false,
        status: 'disconnected',
        message: normalizeApiError(error),
        timestamp: new Date().toISOString()
      });
    }

    setActiveAction('');
  }

  async function handleSubmitEvidence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setErrorMessage('Select a file before submitting evidence.');
      return;
    }

    setErrorMessage('');
    setActiveAction('submit');

    try {
      const result = await submitEvidence({
        file,
        caseId,
        type: evidenceType,
        description,
        collectionDate,
        location,
        submittedBy
      });

      setSubmitResult(result);
      setEvidenceIdInput(result.evidenceId);
      setHashToVerify(result.hash);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setErrorMessage(normalizeApiError(error));
    } finally {
      setActiveAction('');
    }
  }

  async function loadEvidence() {
    if (!deferredEvidenceId) {
      setErrorMessage('Enter an evidence ID first.');
      return;
    }

    setErrorMessage('');
    setActiveAction('lookup');

    try {
      const record = await getEvidenceById(deferredEvidenceId);
      setHashToVerify(record.hash);
      startTransition(() => {
        setEvidenceRecord(record);
      });
    } catch (error) {
      setErrorMessage(normalizeApiError(error));
    } finally {
      setActiveAction('');
    }
  }

  async function runVerification() {
    if (!deferredEvidenceId) {
      setErrorMessage('Enter an evidence ID first.');
      return;
    }

    setErrorMessage('');
    setActiveAction('verify');

    try {
      const hashOverride = hashToVerify.trim();
      const result = await verifyEvidenceById(deferredEvidenceId, hashOverride || undefined);
      setVerifyResult(result);
    } catch (error) {
      setErrorMessage(normalizeApiError(error));
    } finally {
      setActiveAction('');
    }
  }

  async function loadHistory() {
    if (!deferredEvidenceId) {
      setErrorMessage('Enter an evidence ID first.');
      return;
    }

    setErrorMessage('');
    setActiveAction('history');

    try {
      const entries = await getEvidenceHistory(deferredEvidenceId);
      startTransition(() => {
        setHistory(entries);
      });
    } catch (error) {
      setErrorMessage(normalizeApiError(error));
    } finally {
      setActiveAction('');
    }
  }

  async function handleStatusUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deferredEvidenceId) {
      setErrorMessage('Enter an evidence ID first.');
      return;
    }

    if (isNoStatusChange) {
      setErrorMessage('Evidence is already in the selected status.');
      return;
    }

    setErrorMessage('');
    setActiveAction('status-update');

    try {
      const result = await updateEvidenceStatus({
        evidenceId: deferredEvidenceId,
        status: statusToSet,
        updatedBy: statusUpdatedBy,
        details: statusDetails
      });
      setStatusUpdateResult(result);
      if (evidenceRecord && evidenceRecord.evidenceId === deferredEvidenceId) {
        setEvidenceRecord({
          ...evidenceRecord,
          status: statusToSet
        });
      }
    } catch (error) {
      setErrorMessage(normalizeApiError(error));
    } finally {
      setActiveAction('');
    }
  }

  return (
    <div className="app-shell">
      <motion.div className="scroll-progress" style={{ width: progressWidth }} />

      <div className="ambient-layer">
        <div className="orb orb-one" />
        <div className="orb orb-two" />
        <div className="grid-overlay" />
      </div>

      <header className="top-nav">
        <span className="brand">Forensics Control Center</span>
        <button className="ghost-btn" type="button" onClick={checkSystemStatus}>
          {activeAction === 'status' ? 'Refreshing...' : 'Refresh Status'}
        </button>
      </header>

      <motion.section
        className="hero"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <p className="eyebrow">Blockchain-backed Digital Evidence Platform</p>
        <h1>Investigate Faster, Preserve Better, Verify Continuously.</h1>
        <p className="lead">
          This React UI wraps your forensic API with animated workflows, fast evidence lookups, and live
          blockchain status visibility.
        </p>
        <div className="hero-cta">
          <a href="#submit-section" className="cta-primary">
            Submit Evidence
          </a>
          <a href="#explorer-section" className="cta-secondary">
            Explore Records
          </a>
        </div>
      </motion.section>

      <motion.section
        className="status-strip"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5 }}
      >
        <StatusCard
          title="API"
          value={health?.status ?? 'unknown'}
          timestamp={health?.timestamp}
          tone={health?.success ? 'good' : 'warn'}
        />
        <StatusCard
          title="Blockchain"
          value={blockchainHealth?.status ?? 'unknown'}
          timestamp={blockchainHealth?.timestamp}
          tone={blockchainHealth?.success ? 'good' : 'warn'}
        />
        <StatusCard
          title="Mode"
          value={blockchainHealth?.status === 'connected' ? 'Fabric live' : 'Mock fallback'}
          timestamp={new Date().toISOString()}
          tone={blockchainHealth?.status === 'connected' ? 'good' : 'warn'}
        />
      </motion.section>

      {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}

      <main className="main-grid">
        <motion.section
          id="submit-section"
          className="panel panel-submit"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.5 }}
        >
          <h2>Submit New Evidence</h2>
          <p>Upload a file, attach case metadata, and anchor the hash on-chain.</p>

          <form onSubmit={handleSubmitEvidence} className="form-grid">
            <label>
              Evidence File
              <input
                ref={fileInputRef}
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required
              />
            </label>

            <label>
              Case ID
              <input value={caseId} onChange={(event) => setCaseId(event.target.value)} required />
            </label>

            <label>
              Evidence Type
              <select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value)}>
                <option value="document">Document</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label>
              Submitted By
              <input value={submittedBy} onChange={(event) => setSubmittedBy(event.target.value)} />
            </label>

            <label>
              Collection Date
              <input type="date" value={collectionDate} onChange={(event) => setCollectionDate(event.target.value)} />
            </label>

            <label>
              Location
              <input value={location} onChange={(event) => setLocation(event.target.value)} />
            </label>

            <label className="full-width">
              Description
              <textarea
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Short forensic context"
              />
            </label>

            <button className="cta-primary" type="submit" disabled={activeAction === 'submit'}>
              {activeAction === 'submit' ? 'Submitting...' : 'Submit To Ledger'}
            </button>
          </form>

          {submitResult ? (
            <ResultCard title="Submission Result">
              <KeyValue label="Evidence ID" value={submitResult.evidenceId} />
              <KeyValue label="Hash" value={submitResult.hash} />
              <KeyValue label="Transaction ID" value={submitResult.transactionId} />
              <KeyValue label="Timestamp" value={new Date(submitResult.timestamp).toLocaleString()} />
            </ResultCard>
          ) : null}
        </motion.section>

        <motion.section
          id="explorer-section"
          className="panel panel-explorer"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          <h2>Evidence Explorer</h2>
          <p>Inspect record details, verify integrity, and track full chain-of-custody history.</p>

          <div className="quick-bar">
            <input
              value={evidenceIdInput}
              onChange={(event) => setEvidenceIdInput(event.target.value)}
              placeholder="Paste evidence ID"
            />
            <button type="button" className="ghost-btn" onClick={loadEvidence} disabled={activeAction === 'lookup'}>
              {activeAction === 'lookup' ? 'Loading...' : 'Fetch Record'}
            </button>
            <button type="button" className="ghost-btn" onClick={runVerification} disabled={activeAction === 'verify'}>
              {activeAction === 'verify' ? 'Verifying...' : 'Verify'}
            </button>
            <button type="button" className="ghost-btn" onClick={loadHistory} disabled={activeAction === 'history'}>
              {activeAction === 'history' ? 'Loading...' : 'History'}
            </button>
          </div>

          <label>
            Hash To Verify
            <input
              value={hashToVerify}
              onChange={(event) => setHashToVerify(event.target.value)}
              placeholder="Load a record or paste hash manually"
            />
          </label>

          {evidenceRecord ? (
            <ResultCard title="Evidence Record">
              <KeyValue label="ID" value={evidenceRecord.evidenceId} />
              <KeyValue label="Case" value={evidenceRecord.metadata.caseId} />
              <KeyValue label="Type" value={evidenceRecord.metadata.type} />
              <KeyValue label="Status" value={evidenceRecord.status} />
              <KeyValue label="Submitted By" value={evidenceRecord.submittedBy} />
              <KeyValue label="Stored Hash" value={evidenceRecord.hash} />
            </ResultCard>
          ) : null}

          {verifyResult ? (
            <ResultCard title="Verification">
              <KeyValue label="Integrity" value={verifyResult.isValid ? 'VALID' : 'INVALID'} />
              <KeyValue label="Message" value={verifyResult.message} />
              <KeyValue label="Stored Hash" value={verifyResult.storedHash} />
              <KeyValue label="Computed Hash" value={verifyResult.computedHash} />
            </ResultCard>
          ) : null}

          {history.length ? (
            <ResultCard title="Audit Trail">
              <ul className="history-list">
                {history.map((entry, index) => (
                  <li key={`${entry.timestamp}-${index}`}>
                    <div className="history-head">
                      <strong>{entry.action}</strong>
                      <span>{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    <p>By: {entry.performedBy}</p>
                    {entry.details ? <p>{entry.details}</p> : null}
                  </li>
                ))}
              </ul>
            </ResultCard>
          ) : null}

          <form className="status-form" onSubmit={handleStatusUpdate}>
            <h3>Update Status</h3>
            <label>
              New Status
              <select value={statusToSet} onChange={(event) => setStatusToSet(event.target.value as EvidenceStatus)}>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Updated By
              <input value={statusUpdatedBy} onChange={(event) => setStatusUpdatedBy(event.target.value)} />
            </label>

            <label>
              Details
              <input value={statusDetails} onChange={(event) => setStatusDetails(event.target.value)} />
            </label>

            <button
              className="cta-primary"
              type="submit"
              disabled={
                activeAction === 'status-update' || isNoStatusChange
              }
            >
              {activeAction === 'status-update'
                ? 'Updating...'
                : isNoStatusChange
                  ? 'No Status Change'
                  : 'Commit Status'}
            </button>
          </form>

          {statusUpdateResult ? (
            <ResultCard title="Status Update Result">
              <KeyValue label="Transaction ID" value={statusUpdateResult.transactionId} />
              <KeyValue label="Timestamp" value={new Date(statusUpdateResult.timestamp).toLocaleString()} />
            </ResultCard>
          ) : null}
        </motion.section>
      </main>

      <section className="workflow" ref={workflowRef}>
        <h2>Animated Evidence Workflow</h2>
        <p>Each step stays auditable from intake to courtroom-ready verification.</p>
        <div className="workflow-grid">
          <article className="workflow-card">
            <h3>1. Intake</h3>
            <p>Capture file + case metadata and compute SHA-256 fingerprint.</p>
          </article>
          <article className="workflow-card">
            <h3>2. Anchor</h3>
            <p>Persist immutable reference in blockchain transaction history.</p>
          </article>
          <article className="workflow-card">
            <h3>3. Verify</h3>
            <p>Cross-check stored and computed hashes against tampering.</p>
          </article>
          <article className="workflow-card">
            <h3>4. Trace</h3>
            <p>Review complete chain-of-custody timeline in one forensic view.</p>
          </article>
        </div>
      </section>
    </div>
  );
}

function StatusCard(props: { title: string; value: string; timestamp?: string; tone: 'good' | 'warn' }) {
  return (
    <article className={`status-card ${props.tone}`}>
      <p className="status-title">{props.title}</p>
      <h3>{props.value}</h3>
      <span>{props.timestamp ? new Date(props.timestamp).toLocaleTimeString() : 'n/a'}</span>
    </article>
  );
}

function ResultCard(props: { title: string; children: React.ReactNode }) {
  return (
    <motion.article
      className="result-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <h3>{props.title}</h3>
      {props.children}
    </motion.article>
  );
}

function KeyValue(props: { label: string; value: string }) {
  return (
    <div className="kv-row">
      <span>{props.label}</span>
      <code>{props.value}</code>
    </div>
  );
}
