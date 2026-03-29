import * as crypto from 'crypto';
import * as fs from 'fs';

/**
 * Generate SHA-256 hash of data
 */
export function generateHash(data: Buffer | string): string {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Generate SHA-256 hash of a file
 */
export async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => {
      if (typeof chunk === 'string') {
        hash.update(chunk, 'utf8');
        return;
      }

      hash.update(chunk);
    });
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Generate a unique evidence ID
 */
export function generateEvidenceId(): string {
  return crypto.randomUUID();
}

/**
 * Generate digital signature
 */
export function signData(data: string, privateKey: string): string {
  const sign = crypto.createSign('SHA256');
  sign.update(data);
  sign.end();
  return sign.sign(privateKey, 'hex');
}

/**
 * Verify digital signature
 */
export function verifySignature(data: string, signature: string, publicKey: string): boolean {
  const verify = crypto.createVerify('SHA256');
  verify.update(data);
  verify.end();
  return verify.verify(publicKey, signature, 'hex');
}

/**
 * Generate HMAC for data integrity
 */
export function generateHMAC(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}
