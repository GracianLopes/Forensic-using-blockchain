# Setup Guide

## Prerequisites

Before setting up the Blockchain Digital Forensics System, ensure you have the following:

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18+ | Backend runtime |
| npm | 9+ | Package management |
| Docker | 20+ | Containerization |
| Docker Compose | 2.0+ | Multi-container orchestration |
| Git | 2.30+ | Version control |

### Optional (for chaincode development)

| Software | Version | Purpose |
|----------|---------|---------|
| fabric-samples | 2.5+ | Fabric samples and tools |
| Go | 1.20+ | For building Fabric tools |

---

## Quick Start

### 1. Clone/Initialize Repository

```bash
cd /home/pluto/Desktop/BTproject
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Start the Fabric Network

```bash
# From project root
./blockchain/scripts/setup-network.sh setup
```

### 4. Deploy Chaincode

```bash
./blockchain/scripts/deploy-chaincode.sh all
```

### 5. Start Backend API

```bash
cd backend
npm run dev
```

### 6. Verify Setup

```bash
# Check API health
curl http://localhost:3000/api/health

# Check blockchain connection
curl http://localhost:3000/api/health/blockchain
```

---

## Detailed Setup Instructions

### Step 1: Directory Structure

The setup script creates the following directories:

```
BTproject/
├── docker/fabric/
│   ├── ca-org1/        # CA certificates
│   ├── orderer/        # Orderer data
│   ├── peer0.org1/     # Peer data
│   └── wallet/         # User identities
├── blockchain/crypto-config/
├── backend/storage/
│   ├── temp/           # Temporary uploads
│   └── evidence/       # Stored evidence files
└── backend/logs/
```

### Step 2: Environment Configuration

Create a `.env` file in the `backend` directory:

```env
# Server configuration
NODE_ENV=development
PORT=3000

# CORS configuration
CORS_ORIGIN=*

# Fabric configuration
FABRIC_CHANNEL=forensic-channel
FABRIC_CHAINCODE=evidence-chaincode
FABRIC_ORG_MSP=Org1MSP
FABRIC_CCP_PATH=./blockchain/config/connection-org1.json
FABRIC_WALLET_PATH=./wallet

# Storage configuration
EVIDENCE_STORAGE_PATH=./storage/evidence

# Logging
LOG_LEVEL=info

# Blockchain connection (set to true for development without Fabric)
SKIP_BLOCKCHAIN_CONNECT=false
```

### Step 3: Fabric Network Configuration

The connection profile (`blockchain/config/connection-org1.json`) defines:

- Organization MSP ID
- Peer endpoints
- Certificate Authority details
- TLS configuration

### Step 4: User Enrollment

For production, enroll users using the Fabric CA:

```bash
# Register user
fabric-ca-client register --id.name appUser --id.secret appUserpw --id.type client

# Enroll user
fabric-ca-client enroll -u https://appUser:appUserpw@localhost:7054 -M wallet/appUser
```

---

## Development Mode (Without Full Fabric)

For development without running the full Fabric network:

1. Set `SKIP_BLOCKCHAIN_CONNECT=true` in your `.env`

2. The API will start in limited mode with mocked blockchain responses

3. Use this mode for:
   - API development
   - Frontend integration
   - Unit testing

---

## Production Deployment

### Security Considerations

1. **TLS Configuration**: Enable TLS for all Fabric components
2. **Private Keys**: Store securely, never commit to version control
3. **Access Control**: Implement proper authentication middleware
4. **Rate Limiting**: Add rate limiting for API endpoints
5. **Logging**: Configure appropriate log levels and retention

### Docker Production Setup

```bash
# Build production images
docker-compose -f docker-compose.prod.yaml build

# Start with production config
docker-compose -f docker-compose.prod.yaml up -d
```

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://your-domain.com

# Fabric TLS
FABRIC_TLS_ENABLED=true

# Database
COUCHDB_USER=secure_user
COUCHDB_PASSWORD=secure_password
```

---

## Troubleshooting

### Common Issues

#### 1. "Cannot connect to Docker"

```bash
# Check Docker daemon
docker ps

# Restart Docker if needed
sudo systemctl restart docker
```

#### 2. "Blockchain connection failed"

- Verify Fabric containers are running: `docker-compose ps`
- Check peer logs: `docker-compose logs peer0.org1`
- Verify connection profile paths

#### 3. "Chaincode deployment failed"

- Ensure chaincode builds: `cd blockchain/chaincode/evidence && npm build`
- Check peer logs for detailed errors
- Verify channel exists

#### 4. "File upload fails"

- Check storage directory permissions
- Verify `EVIDENCE_STORAGE_PATH` exists
- Check file size limits in multer configuration

### Viewing Logs

```bash
# All containers
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f peer0.org1

# Application logs
tail -f backend/logs/combined.log
tail -f backend/logs/error.log
```

### Resetting the Network

```bash
# Stop and remove all data
./blockchain/scripts/setup-network.sh clean

# Restart fresh
./blockchain/scripts/setup-network.sh setup
```

---

## Testing

### Run Unit Tests

```bash
cd backend
npm run test:unit
```

### Run Integration Tests

```bash
cd backend
npm run test:integration
```

### Manual API Testing

```bash
# Submit evidence
curl -X POST http://localhost:3000/api/evidence \
  -F "file=@test.txt" \
  -F 'metadata={"caseId":"TEST-001","type":"document"}'

# Verify evidence
curl http://localhost:3000/api/evidence/{id}/verify

# Get history
curl http://localhost:3000/api/evidence/{id}/history
```

---

## Architecture Overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client    │────▶│  Node.js/TS API  │────▶│ Hyperledger     │
│   (UI/CLI)  │◀────│   Express.js     │◀────│ Fabric          │
└─────────────┘     └──────────────────┘     └─────────────────┘
                           │
                           ▼
                    ┌──────────────────┐
                    │  File Storage    │
                    │  (Evidence)      │
                    └──────────────────┘
```

### Components

| Component | Port | Purpose |
|-----------|------|---------|
| API Server | 3000 | REST API |
| Fabric Peer | 7051 | Blockchain peer |
| Fabric CA | 7054 | Certificate Authority |
| Orderer | 7050 | Transaction ordering |
| CouchDB | 5984 | State database |

---

## Next Steps

1. Review [API Documentation](./API.md)
2. Implement frontend interface
3. Configure production deployment
4. Set up monitoring and alerting
