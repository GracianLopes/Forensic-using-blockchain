import {
  generateHash,
  hashFile,
  generateEvidenceId,
  signData,
  verifySignature,
  generateHMAC
} from '../../src/utils/crypto';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('Crypto Utilities', () => {
  describe('generateHash', () => {
    it('should generate SHA-256 hash for string', () => {
      const hash = generateHash('Hello, World!');
      expect(hash).toHaveLength(64);
      expect(hash).toBe('dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f');
    });

    it('should generate SHA-256 hash for buffer', () => {
      const buffer = Buffer.from('test data');
      const hash = generateHash(buffer);
      expect(hash).toHaveLength(64);
    });

    it('should produce consistent hashes', () => {
      const data = 'consistent test';
      const hash1 = generateHash(data);
      const hash2 = generateHash(data);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = generateHash('input1');
      const hash2 = generateHash('input2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateEvidenceId', () => {
    it('should generate a valid UUID', () => {
      const id = generateEvidenceId();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
    });

    it('should generate unique IDs', () => {
      const id1 = generateEvidenceId();
      const id2 = generateEvidenceId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('hashFile', () => {
    it('should hash file contents', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-utils-'));
      const filePath = path.join(tempDir, 'evidence.txt');
      fs.writeFileSync(filePath, 'Hello, World!');

      await expect(hashFile(filePath)).resolves.toBe(
        'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f'
      );

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('digital signatures', () => {
    it('should sign and verify data', () => {
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048
      });
      const payload = 'signed evidence payload';
      const signature = signData(payload, privateKey.export({ type: 'pkcs1', format: 'pem' }).toString());

      expect(signature).toBeTruthy();
      expect(verifySignature(
        payload,
        signature,
        publicKey.export({ type: 'pkcs1', format: 'pem' }).toString()
      )).toBe(true);
      expect(verifySignature(
        'tampered payload',
        signature,
        publicKey.export({ type: 'pkcs1', format: 'pem' }).toString()
      )).toBe(false);
    });
  });

  describe('generateHMAC', () => {
    const secret = 'test-secret';

    it('should generate HMAC for data', () => {
      const hmac = generateHMAC('test data', secret);
      expect(hmac).toHaveLength(64);
    });

    it('should produce consistent HMACs', () => {
      const data = 'test data';
      const hmac1 = generateHMAC(data, secret);
      const hmac2 = generateHMAC(data, secret);
      expect(hmac1).toBe(hmac2);
    });

    it('should produce different HMACs for different secrets', () => {
      const data = 'test data';
      const hmac1 = generateHMAC(data, 'secret1');
      const hmac2 = generateHMAC(data, 'secret2');
      expect(hmac1).not.toBe(hmac2);
    });
  });
});
