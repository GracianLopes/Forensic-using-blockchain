import { HashService } from '../../src/services/hash.service';
import * as fs from 'fs';
import * as path from 'path';

describe('HashService', () => {
  let hashService: HashService;
  const testContent = 'Hello, World!';
  const expectedHash = 'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f';

  beforeEach(() => {
    hashService = new HashService();
  });

  describe('hashBuffer', () => {
    it('should generate correct SHA-256 hash for buffer', () => {
      const buffer = Buffer.from(testContent);
      const hash = hashService.hashBuffer(buffer);

      expect(hash).toBe(expectedHash);
      expect(hash).toHaveLength(64); // SHA-256 produces 64 hex chars
    });
  });

  describe('hashString', () => {
    it('should generate correct SHA-256 hash for string', () => {
      const hash = hashService.hashString(testContent);
      expect(hash).toBe(expectedHash);
    });

    it('should handle empty string', () => {
      const hash = hashService.hashString('');
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });
  });

  describe('hashFile', () => {
    const testFilePath = path.join(__dirname, 'test-file.txt');

    beforeAll(() => {
      fs.writeFileSync(testFilePath, testContent);
    });

    afterAll(() => {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    });

    it('should generate correct hash for file', async () => {
      const hash = await hashService.hashFile(testFilePath);
      expect(hash).toBe(expectedHash);
    });

    it('should throw error for non-existent file', async () => {
      await expect(hashService.hashFile('/non/existent/file.txt'))
        .rejects
        .toThrow('Failed to hash file');
    });
  });

  describe('verifyHash', () => {
    it('should return true for matching hashes', () => {
      const buffer = Buffer.from(testContent);
      const result = hashService.verifyHash(buffer, expectedHash);
      expect(result).toBe(true);
    });

    it('should return false for non-matching hashes', () => {
      const buffer = Buffer.from(testContent);
      const wrongHash = 'wrong_hash_value';
      const result = hashService.verifyHash(buffer, wrongHash);
      expect(result).toBe(false);
    });

    it('should be case-insensitive', () => {
      const buffer = Buffer.from(testContent);
      const upperCaseHash = expectedHash.toUpperCase();
      const result = hashService.verifyHash(buffer, upperCaseHash);
      expect(result).toBe(true);
    });
  });

  describe('verifyFileHash', () => {
    const testFilePath = path.join(__dirname, 'test-file-verify.txt');

    beforeAll(() => {
      fs.writeFileSync(testFilePath, testContent);
    });

    afterAll(() => {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    });

    it('should verify file hash correctly', async () => {
      const result = await hashService.verifyFileHash(testFilePath, expectedHash);
      expect(result).toBe(true);
    });

    it('should return false for wrong hash', async () => {
      const result = await hashService.verifyFileHash(testFilePath, 'wrong_hash');
      expect(result).toBe(false);
    });
  });

  describe('hashFileStream', () => {
    const testFilePath = path.join(__dirname, 'test-file-stream.txt');

    beforeAll(() => {
      fs.writeFileSync(testFilePath, testContent);
    });

    afterAll(() => {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    });

    it('should generate the correct hash via a stream', async () => {
      await expect(hashService.hashFileStream(testFilePath)).resolves.toBe(expectedHash);
    });
  });

  describe('generateMerkleRoot', () => {
    it('should handle empty array', () => {
      const root = hashService.generateMerkleRoot([]);
      expect(root).toBe(hashService.hashString(''));
    });

    it('should handle single hash', () => {
      const hash = 'abc123';
      const root = hashService.generateMerkleRoot([hash]);
      expect(root).toBe(hash);
    });

    it('should generate consistent Merkle root for multiple hashes', () => {
      const hashes = [
        'hash1',
        'hash2',
        'hash3',
        'hash4'
      ];

      const root1 = hashService.generateMerkleRoot(hashes);
      const root2 = hashService.generateMerkleRoot(hashes);

      expect(root1).toBe(root2);
    });

    it('should produce different roots for different inputs', () => {
      const hashes1 = ['a', 'b', 'c', 'd'];
      const hashes2 = ['e', 'f', 'g', 'h'];

      const root1 = hashService.generateMerkleRoot(hashes1);
      const root2 = hashService.generateMerkleRoot(hashes2);

      expect(root1).not.toBe(root2);
    });
  });
});
