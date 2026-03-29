# Blockchain-Based Digital Forensics System

Status: Work in progress. The project is under active development and may have incomplete features, evolving APIs, and unfinished deployment steps.

A Hyperledger Fabric-based framework for secure, immutable, and verifiable digital evidence management.

## Overview

This system addresses critical challenges in digital forensics:
- **Data Tampering**: Evidence hashes are immutably stored on blockchain
- **Chain-of-Custody**: Complete audit trail of evidence handling
- **Transparency**: All transactions are verifiable and traceable
- **Decentralization**: No single point of failure or control

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client    │────▶│  Node.js/TS API  │────▶│ Hyperledger     │
│   (UI/CLI)  │     │   Backend        │     │ Fabric          │
└─────────────┘     └──────────────────┘     └─────────────────┘
                           │
                           ▼
                    ┌──────────────────┐
                    │  IPFS/File Store │
                    │  (Evidence)      │
                    └──────────────────┘
```

## Features

- **Evidence Submission**: Secure hashing and blockchain anchoring
- **Integrity Verification**: Verify evidence against blockchain records
- **Audit Trail**: Complete history of evidence handling
- **Access Control**: Role-based permissions via Fabric MSP

## Tech Stack

| Component | Technology |
|-----------|------------|
| Blockchain | Hyperledger Fabric 2.5+ |
| Backend | Node.js 18+, TypeScript 5+ |
| API | Express.js 4+ |
| Smart Contract | TypeScript (Fabric Chaincode) |
| Containerization | Docker & Docker Compose |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone repository
cd /home/pluto/Desktop/BTproject

# Install backend dependencies
cd backend && npm install

# Start Fabric network
docker-compose up -d

# Deploy chaincode
./blockchain/scripts/deploy-chaincode.sh

# Start backend API
cd backend && npm run dev

# Start frontend UI (new terminal)
cd ../frontend && npm install && npm run dev
```

Frontend runs on `http://localhost:5173` and proxies API requests to backend on `http://localhost:3000`.

To serve the React UI directly from backend root (`http://localhost:3000`), build frontend once:

```bash
cd frontend
npm run build
```

### API Usage

```bash
# Submit evidence
curl -X POST http://localhost:3000/api/evidence \
  -F "file=@evidence.txt" \
  -F "metadata={\"caseId\":\"CASE001\",\"type\":\"document\"}"

# Verify evidence
curl http://localhost:3000/api/evidence/{evidenceId}/verify

# Get evidence history
curl http://localhost:3000/api/evidence/{evidenceId}/history
```

## Project Structure

```
BTproject/
├── blockchain/          # Hyperledger Fabric components
│   ├── chaincode/       # Smart contracts
│   ├── config/          # Network configuration
│   └── scripts/         # Deployment scripts
├── backend/             # Node.js/TypeScript API
│   ├── src/
│   │   ├── api/         # Routes and middleware
│   │   ├── services/    # Business logic
│   │   ├── models/      # TypeScript interfaces
│   │   └── utils/       # Utilities
│   └── tests/
├── docker/              # Docker configurations
├── docs/                # Documentation
└── docker-compose.yaml  # Full stack orchestration
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/evidence` | Submit new evidence |
| GET | `/api/evidence/:id` | Retrieve evidence record |
| GET | `/api/evidence/:id/verify` | Verify evidence integrity |
| GET | `/api/evidence/:id/history` | Get audit trail |
| POST | `/api/evidence/batch` | Batch submit evidence |

## Security Considerations

1. **Evidence Integrity**: SHA-256 hashes stored on blockchain
2. **Access Control**: Fabric MSP for identity management
3. **Data Privacy**: Only hashes on-chain; files stored off-chain
4. **Non-repudiation**: Digital signatures for submissions

## Documentation

- [API Documentation](docs/API.md)
- [Setup Guide](docs/SETUP.md)

## License

MIT
