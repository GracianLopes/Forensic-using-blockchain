import * as crypto from 'crypto';
import * as fs from 'fs';
import { promisify } from 'util';
import logger from '../utils/logger';

const readFile = promisify(fs.readFile);

/**
 * Service for cryptographic hashing operations
 */
export class HashService {
  /**
   * Generate SHA-256 hash of a buffer
   */
  hashBuffer(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate SHA-256 hash of a string
   */
  hashString(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  /**
   * Generate SHA-256 hash of a file
   */
  async hashFile(filePath: string): Promise<string> {
    try {
      const fileBuffer = await readFile(filePath);
      return this.hashBuffer(fileBuffer);
    } catch (error) {
      logger.error(`Failed to hash file: ${filePath}`, { error });
      throw new Error(`Failed to hash file: ${error}`);
    }
  }

  /**
   * Generate hash stream for large files (memory efficient)
   */
  async hashFileStream(filePath: string): Promise<string> {
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
      stream.on('error', (err) => {
        logger.error('Stream hashing error', { error: err });
        reject(err);
      });
    });
  }

  /**
   * Verify data against a provided hash
   */
  verifyHash(data: Buffer, expectedHash: string): boolean {
    const computedHash = this.hashBuffer(data);
    return computedHash.toLowerCase() === expectedHash.toLowerCase();
  }

  /**
   * Verify file against a provided hash
   */
  async verifyFileHash(filePath: string, expectedHash: string): Promise<boolean> {
    const computedHash = await this.hashFile(filePath);
    return computedHash.toLowerCase() === expectedHash.toLowerCase();
  }

  /**
   * Generate Merkle root from array of hashes
   */
  generateMerkleRoot(hashes: string[]): string {
    if (hashes.length === 0) {
      return this.hashString('');
    }

    if (hashes.length === 1) {
      return hashes[0];
    }

    let level = [...hashes];

    while (level.length > 1) {
      const nextLevel: string[] = [];

      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = i + 1 < level.length ? level[i + 1] : left;
        const combined = this.hashString(left + right);
        nextLevel.push(combined);
      }

      level = nextLevel;
    }

    return level[0];
  }
}

export default new HashService();
