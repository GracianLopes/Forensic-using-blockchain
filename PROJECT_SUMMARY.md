# Blockchain-Based Digital Forensics System

Status: Work in progress. Core blockchain, backend, and frontend components are present, but the project is still being refined and validated end to end.

## Project Summary

This project implements a **blockchain-based digital forensics framework** using Hyperledger Fabric to ensure the integrity, transparency, and traceability of digital evidence throughout its lifecycle.

---

## Problem Addressed

Traditional digital forensic systems face critical challenges:
- **Data Tampering**: Evidence logs can be altered by malicious actors
- **Chain-of-Custody Issues**: Difficult to maintain verifiable handling records
- **Centralized Storage**: Single point of failure and vulnerability
- **Lack of Transparency**: Limited auditability of forensic processes

---

## Solution Overview

A decentralized framework leveraging Hyperledger Fabric's properties:
- **Immutability**: Evidence hashes stored on blockchain cannot be altered
- **Transparency**: All transactions are recorded and auditable
- **Traceability**: Complete audit trail for each evidence item
- **Decentralization**: No single point of control or failure

---

## Project Structure

```
BTproject/
├── blockchain/
│   ├── chaincode/evidence/        # Smart contract (TypeScript)
│   │   ├── evidence.ts            # Main chaincode implementation
│   │   ├── models/evidence.ts     # Data models
│   │   ├── index.ts               # Contract exports
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── config/
│   │   └── connection-org1.json   # Fabric connection profile
│   └── scripts/
│       ├── deploy-chaincode.sh    # Deployment script
│       └── setup-network.sh       # Network setup script
│
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── evidence.ts    # Evidence endpoints
│   │   │   │   └── health.ts      # Health check endpoints
│   │   │   └── middleware/
│   │   │       └── errorHandler.ts # Error handling
│   │   ├── services/
│   │   │   ├── evidence.service.ts # Business logic
│   │   │   ├── blockchain.service.ts # Fabric integration
│   │   │   └── hash.service.ts    # Cryptographic hashing
│   │   ├── models/
│   │   │   └── evidence.ts        # TypeScript interfaces
│   │   ├── utils/
│   │   │   ├── logger.ts          # Winston logger
│   │   │   └── crypto.ts          # Crypto utilities
│   │   └── index.ts               # Application entry
│   ├── tests/
│   │   ├── unit/                  # Unit tests
│   │   └── integration/           # API integration tests
│   ├── package.json
│   ├── tsconfig.json
│   └── jest.config.js
│
├── docker/
│   ├── Dockerfile.backend         # Backend container image
│   └── fabric/                    # Fabric data directories
│
├── docs/
│   ├── API.md                     # API documentation
│   └── SETUP.md                   # Setup guide
│
├── docker-compose.yaml            # Full stack orchestration
├── README.md                      # Project overview
└── .gitignore
```

---

## Key Components

### 1. Smart Contract (Chaincode)

**File**: `blockchain/chaincode/evidence/evidence.ts`

Implements blockchain transactions:
- `SubmitEvidence` - Record new evidence with hash
- `GetEvidence` - Retrieve evidence record
- `VerifyEvidence` - Verify hash integrity
- `GetEvidenceHistory` - Get audit trail
- `UpdateEvidenceStatus` - Update workflow status
- `GetEvidenceByCaseId` - Query by case
- `GetEvidenceByStatus` - Query by status

### 2. Backend API

**File**: `backend/src/index.ts`

Express.js REST API with endpoints:
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/evidence` | Submit evidence |
| GET | `/api/evidence/:id` | Get evidence |
| GET | `/api/evidence/:id/verify` | Verify integrity |
| GET | `/api/evidence/:id/history` | Get audit trail |
| GET | `/api/evidence/:id/file` | Download file |
| PUT | `/api/evidence/:id/status` | Update status |

### 3. Services

| Service | Purpose |
|---------|---------|
| `EvidenceService` | Business logic orchestration |
| `BlockchainService` | Hyperledger Fabric SDK integration |
| `HashService` | SHA-256 hashing, Merkle trees |

### 4. Data Models

**EvidenceRecord**:
```typescript
{
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
```

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Blockchain | Hyperledger Fabric 2.5+ |
| Smart Contract | TypeScript (fabric-contract-api) |
| Backend Runtime | Node.js 18+ |
| Backend Language | TypeScript 5+ |
| API Framework | Express.js 4+ |
| Blockchain SDK | fabric-network, fabric-ca-client |
| Hashing | Node.js crypto (SHA-256) |
| Logging | Winston |
| Containerization | Docker, Docker Compose |
| Testing | Jest, Supertest |

---

## Evidence Workflow

```
1. SUBMISSION
   ┌──────────────┐
   │ Investigator │
   └──────┬───────┘
          │ Submit evidence file + metadata
          ▼
   ┌──────────────────┐
   │  Compute SHA-256 │
   │  Hash of file    │
   └──────┬───────────┘
          │
          ▼
   ┌──────────────────┐
   │  Store hash on   │
   │  Blockchain      │
   └──────┬───────────┘
          │
          ▼
   ┌──────────────────┐
   │  Status:         │
   │  SUBMITTED       │
   └──────────────────┘

2. VERIFICATION
   ┌──────────────┐
   │   System     │
   └──────┬───────┘
          │ Compare stored hash
          │ with file hash
          ▼
   ┌──────────────────┐
   │  Hash Match?     │
   └──────┬───────────┘
          │
     ┌────┴────┐
     │         │
    Yes       No
     │         │
     ▼         ▼
  VERIFIED  REJECTED

3. AUDIT TRAIL
   Every action recorded on blockchain:
   - Timestamp
   - Actor identity
   - Action type
   - Transaction ID
```

---

## Security Features

1. **Evidence Integrity**: SHA-256 hashes immutably stored
2. **Access Control**: Fabric MSP for identity management
3. **Data Privacy**: Only hashes on-chain; files off-chain
4. **Non-repudiation**: Digital signatures for submissions
5. **Audit Trail**: Complete, tamper-proof history

---

## Getting Started

### Prerequisites
- Node.js 18+
- Docker & Docker Compose

### Installation

```bash
# Install backend dependencies
cd backend
npm install

# Start Fabric network
cd ..
./blockchain/scripts/setup-network.sh setup

# Deploy chaincode
./blockchain/scripts/deploy-chaincode.sh

# Start API
cd backend
npm run dev
```

### Test the API

```bash
# Health check
curl http://localhost:3000/api/health

# Submit evidence
curl -X POST http://localhost:3000/api/evidence \
  -F "file=@sample.txt" \
  -F 'metadata={"caseId":"CASE-001","type":"document"}'

# Verify evidence
curl http://localhost:3000/api/evidence/{id}/verify
```

---

## API Documentation

See [docs/API.md](./docs/API.md) for complete API documentation.

## Setup Guide

See [docs/SETUP.md](./docs/SETUP.md) for detailed setup instructions.

---

## Testing

```bash
# Unit tests
cd backend
npm run test:unit

# Integration tests
npm run test:integration

# All tests with coverage
npm test
```

---

## Future Enhancements

1. **Frontend UI**: Web interface for evidence management
2. **IPFS Integration**: Decentralized file storage
3. **Multi-Org Support**: Multiple forensic organizations
4. **Advanced Queries**: Full-text search, date ranges
5. **Batch Operations**: Bulk evidence submission
6. **Mobile App**: Field evidence collection

---

## License

MIT License

---

## Contact

For questions or contributions, please refer to the project repository.
