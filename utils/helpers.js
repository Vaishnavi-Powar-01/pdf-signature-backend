const path = require('path');
const fs = require('fs').promises;

class Helpers {
  // Format file size
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Generate secure filename
  static generateSecureFilename(originalName) {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = path.extname(originalName);
    const name = path.basename(originalName, extension);
    
    // Remove special characters and limit length
    const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
    
    return `${safeName}_${timestamp}_${randomString}${extension}`;
  }

  // Validate PDF file
  static async validatePdfFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      
      if (stats.size === 0) {
        throw new Error('File is empty');
      }
      
      if (stats.size > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('File size exceeds 10MB limit');
      }
      
      // Basic PDF validation by checking magic number
      const buffer = await fs.readFile(filePath, { length: 5 });
      const header = buffer.toString('ascii', 0, 5);
      
      if (header !== '%PDF-') {
        throw new Error('Invalid PDF file format');
      }
      
      return true;
    } catch (error) {
      throw new Error(`PDF validation failed: ${error.message}`);
    }
  }

  // Extract metadata from file path
  static extractMetadata(filePath) {
    const stats = fs.statSync(filePath);
    
    return {
      fileSize: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isFile: stats.isFile()
    };
  }

  // Generate unique ID
  static generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Sanitize user input
  static sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // Parse coordinates from string
  static parseCoordinates(coordsString) {
    if (!coordsString) return null;
    
    const coords = coordsString.split(',');
    if (coords.length !== 4) return null;
    
    return {
      x: parseFloat(coords[0]),
      y: parseFloat(coords[1]),
      width: parseFloat(coords[2]),
      height: parseFloat(coords[3])
    };
  }

  // Generate response object
  static createResponse(success, data = null, message = '', error = null) {
    return {
      success,
      data,
      message,
      error: error ? error.message || error : null,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = Helpers;