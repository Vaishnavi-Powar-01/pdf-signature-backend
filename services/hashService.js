const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class HashService {
  // Calculate SHA-256 hash of a file
  static async calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => {
        hash.update(data);
      });
      
      stream.on('end', () => {
        const fileHash = hash.digest('hex');
        resolve(fileHash);
      });
      
      stream.on('error', (err) => {
        reject(err);
      });
    });
  }

  // Calculate hash of PDF buffer
  static calculateBufferHash(buffer) {
    const hash = crypto.createHash('sha256');
    hash.update(buffer);
    return hash.digest('hex');
  }

  // Verify document integrity
  static async verifyDocumentIntegrity(originalHash, currentFilePath) {
    try {
      const currentHash = await this.calculateFileHash(currentFilePath);
      return {
        isVerified: originalHash === currentHash,
        originalHash,
        currentHash,
        changed: originalHash !== currentHash
      };
    } catch (error) {
      throw new Error(`Failed to verify document integrity: ${error.message}`);
    }
  }

  // Generate audit hash for trail
  static generateAuditHash(data) {
    const hash = crypto.createHash('sha256');
    const dataString = JSON.stringify(data);
    hash.update(dataString);
    return hash.digest('hex');
  }
}

module.exports = HashService;