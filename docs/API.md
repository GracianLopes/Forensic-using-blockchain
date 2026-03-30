# API Documentation

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently, the API uses Hyperledger Fabric's MSP (Membership Service Provider) for identity management. In development mode, requests can be made without explicit authentication headers.

---

## Endpoints

### Health Check

#### `GET /api/health`

Check API health status.

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-03-28T10:00:00.000Z"
}
```

#### `GET /api/health/blockchain`

Check blockchain connection status.

**Response (Connected):**
```json
{
  "success": true,
  "status": "connected",
  "mode": "fabric",
  "timestamp": "2026-03-28T10:00:00.000Z"
}
```

**Response (Disconnected):**
```json
{
  "success": false,
  "status": "disconnected",
  "mode": "mock",
  "message": "Blockchain connection not established",
  "timestamp": "2026-03-28T10:00:00.000Z"
}
```

---

### Evidence Management

#### `POST /api/evidence`

Submit new evidence to the blockchain.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: Evidence file (binary)
  - `metadata`: JSON string with evidence metadata
  - `submittedBy`: Identity of submitter (optional)

**Metadata Schema:**
```json
{
  "caseId": "CASE-001",
  "type": "document|image|video|audio|other",
  "description": "Optional description",
  "collectionDate": "2026-03-28",
  "location": "Optional location"
}
```

**Example (curl):**
```bash
curl -X POST http://localhost:3000/api/evidence \
  -F "file=@evidence.pdf" \
  -F 'metadata={"caseId":"CASE-001","type":"document","description":"Contract agreement"}' \
  -F "submittedBy=investigator@example.com"
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "evidenceId": "550e8400-e29b-41d4-a716-446655440000",
    "hash": "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
    "transactionId": "tx_abc123...",
    "timestamp": "2026-03-28T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing file or invalid metadata
- `500 Internal Server Error`: Blockchain submission failed

---

#### `GET /api/evidence/:id`

Retrieve evidence record from blockchain.

**Parameters:**
- `id`: Evidence UUID

**Example:**
```bash
curl http://localhost:3000/api/evidence/550e8400-e29b-41d4-a716-446655440000
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "evidenceId": "550e8400-e29b-41d4-a716-446655440000",
    "hash": "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
    "originalFileName": "evidence.pdf",
    "fileSize": 1024567,
    "mimeType": "application/pdf",
    "storagePath": "/app/storage/evidence/550e8400-e29b-41d4-a716-446655440000",
    "metadata": {
      "caseId": "CASE-001",
      "type": "document",
      "description": "Contract agreement"
    },
    "status": "SUBMITTED",
    "submittedAt": "2026-03-28T10:00:00.000Z",
    "submittedBy": "investigator@example.com",
    "auditTrail": [
      {
        "timestamp": "2026-03-28T10:00:00.000Z",
        "action": "EVIDENCE_SUBMITTED",
        "performedBy": "investigator@example.com",
        "details": "Evidence submitted to blockchain"
      }
    ]
  }
}
```

**Error Responses:**
- `404 Not Found`: Evidence ID does not exist

---

#### `GET /api/evidence/:id/verify`

Verify evidence integrity by comparing file hash with blockchain record.

**Parameters:**
- `id`: Evidence UUID
- `hash` (optional query): Hash value to compare against computed file hash. If omitted, stored hash is used.

**Example:**
```bash
curl http://localhost:3000/api/evidence/550e8400-e29b-41d4-a716-446655440000/verify
```

**Example (verify against provided hash):**
```bash
curl "http://localhost:3000/api/evidence/550e8400-e29b-41d4-a716-446655440000/verify?hash=provided_hash_value"
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "evidenceId": "550e8400-e29b-41d4-a716-446655440000",
    "isValid": true,
    "storedHash": "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
    "computedHash": "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
    "message": "Evidence integrity verified - hashes match",
    "verifiedAt": "2026-03-28T10:05:00.000Z"
  }
}
```

**Tampered Evidence Response:**
```json
{
  "success": true,
  "data": {
    "evidenceId": "550e8400-e29b-41d4-a716-446655440000",
    "isValid": false,
    "storedHash": "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
    "computedHash": "different_hash_value...",
    "message": "Evidence integrity check failed - hash mismatch",
    "verifiedAt": "2026-03-28T10:05:00.000Z"
  }
}
```

---

#### `GET /api/evidence/:id/history`

Get complete audit trail for an evidence item.

**Parameters:**
- `id`: Evidence UUID

**Example:**
```bash
curl http://localhost:3000/api/evidence/550e8400-e29b-41d4-a716-446655440000/history
```

**Success Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2026-03-28T10:00:00.000Z",
      "action": "EVIDENCE_SUBMITTED",
      "performedBy": "investigator@example.com",
      "details": "Evidence submitted to blockchain",
      "transactionId": "tx_abc123..."
    },
    {
      "timestamp": "2026-03-28T11:00:00.000Z",
      "action": "STATUS_UPDATED",
      "performedBy": "supervisor@example.com",
      "details": "Status changed to VERIFIED",
      "transactionId": "tx_def456..."
    }
  ]
}
```

---

#### `GET /api/evidence/:id/file`

Download the evidence file.

**Parameters:**
- `id`: Evidence UUID

**Example:**
```bash
curl -O -J http://localhost:3000/api/evidence/550e8400-e29b-41d4-a716-446655440000/file
```

**Response:** Binary file download

---

#### `PUT /api/evidence/:id/status`

Update evidence status in the workflow.

**Parameters:**
- `id`: Evidence UUID

**Body:**
```json
{
  "status": "VERIFIED",
  "updatedBy": "supervisor@example.com",
  "details": "Evidence verified and admissible"
}
```

**Valid Status Values:**
- `SUBMITTED` - Initial state
- `VERIFIED` - Integrity verified
- `UNDER_REVIEW` - Being reviewed
- `ADMITTED` - Admitted as evidence
- `REJECTED` - Rejected
- `ARCHIVED` - Archived

**Example:**
```bash
curl -X PUT http://localhost:3000/api/evidence/550e8400-e29b-41d4-a716-446655440000/status \
  -H "Content-Type: application/json" \
  -d '{"status":"VERIFIED","updatedBy":"supervisor@example.com","details":"Hash verified"}'
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "tx_ghi789...",
    "timestamp": "2026-03-28T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid status or missing fields
- `404 Not Found`: Evidence ID does not exist
- `409 Conflict`: Evidence is already in the requested status (no-op update blocked)

---

## Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "statusCode": 400
  }
}
```

### Common Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request - Invalid input |
| 404 | Not Found - Resource doesn't exist |
| 401 | Unauthorized - Authentication required |
| 500 | Internal Server Error |
| 503 | Service Unavailable - Blockchain disconnected |

---

## Rate Limiting

Currently, no rate limiting is implemented. For production use, consider adding rate limiting middleware.

## CORS

CORS is enabled for all origins in development. For production, configure `CORS_ORIGIN` environment variable.
