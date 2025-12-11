const PdfDocument = require('../models/PdfDocument');
const AuditTrail = require('../models/AuditTrail');
const HashService = require('./hashService');
const SignatureService = require('./signatureService');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

class PdfService {
  // Upload PDF
  static async uploadPdf(file, metadata) {
    try {
      // Calculate hash of original file - USE CORRECT METHOD NAME
      const originalHash = await HashService.calculateFileHash(file.path);
      // Get PDF metadata
      const pdfBytes = await fs.readFile(file.path);
      // In PdfService.js, when uploading:
const pdfDoc = await PDFDocument.load(pdfBytes);
const firstPage = pdfDoc.getPage(0);
const pdfDimensions = firstPage.getSize(); // {width, height}
      const pageCount = pdfDoc.getPageCount();
      
      // Store RELATIVE path from project root (not absolute path)
      const relativePath = path.relative(process.cwd(), file.path);
      
      // Create document record
      const document = await PdfDocument.create({
        originalFileName: file.originalname,
        originalFilePath: relativePath, // Store relative path
        originalHash: originalHash,
        pageCount: pageCount,
        status: 'pending',
        metadata: {
          ...metadata,
          uploadedAt: new Date()
        }
      });
      
      // Create audit trail
      await AuditTrail.create({
        documentId: document._id,
        action: 'upload',
        originalHash: originalHash,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        details: {
          fileName: file.originalname,
          fileSize: file.size,
          pageCount: pageCount
        }
      });
      
      return {
        success: true,
        message: 'PDF uploaded successfully',
        documentId: document._id, // Make sure to return this
        data: {
          documentId: document._id,
          fileName: document.originalFileName,
          pageCount: pageCount,
          uploadedAt: document.createdAt
        }
      };
      
    } catch (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  // Sign PDF
  static async signPdf(documentId, fields, signatureData, metadata) {
    try {
      // Get document
      const document = await PdfDocument.findById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }
      
      // Update status
      document.status = 'processing';
      await document.save();
      
      // Read original PDF using absolute path
      const absoluteOriginalPath = path.join(process.cwd(), document.originalFilePath);
      const pdfBuffer = await fs.readFile(absoluteOriginalPath);
      
      // Process signature overlay
      let signedPdfBuffer;
      if (signatureData) {
        // Old method - single signature
        const signatureCoordinates = fields[0]; // Assuming first field has coordinates
        signedPdfBuffer = await SignatureService.overlaySignatureOnPdf(
          pdfBuffer,
          signatureData,
          signatureCoordinates
        );
      } else {
        // New method - multiple fields
        signedPdfBuffer = await SignatureService.processFieldsOnPdf(pdfBuffer, fields);
      }
      
      // Generate unique filename for signed PDF
      const timestamp = Date.now();
      const signedFileName = `signed-${timestamp}-${document.originalFileName}`;
      const signedRelativePath = path.join('uploads', 'signed', signedFileName);
      const signedAbsolutePath = path.join(process.cwd(), signedRelativePath);
      
      // Ensure signed directory exists
      const signedDir = path.dirname(signedAbsolutePath);
      await fs.mkdir(signedDir, { recursive: true });
      
      // Write signed PDF
      await fs.writeFile(signedAbsolutePath, signedPdfBuffer);
      
      // Calculate hash of signed PDF - USE CORRECT METHOD NAME
      const signedHash = await HashService.calculateFileHash(signedAbsolutePath);
      
      // Update document
      document.signedFilePath = signedRelativePath; // Store relative path
      document.signedHash = signedHash;
      document.fields = fields;
      document.status = 'signed';
      document.signedAt = new Date();
      await document.save();
      
      // Create audit trail
      await AuditTrail.create({
        documentId: document._id,
        action: 'sign',
        originalHash: document.originalHash,
        newHash: signedHash,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        details: {
          fieldCount: fields.length,
          fieldsCount: fields.length,
          signedAt: new Date()
        }
      });
      
      return {
        success: true,
        message: 'PDF signed successfully',
        data: {
          documentId: document._id,
          signedFileName: signedFileName,
          signedHash: signedHash,
          downloadUrl: `/api/pdf/download/${document._id}/signed`
        }
      };
      
    } catch (error) {
      // Update status to failed
      try {
        const document = await PdfDocument.findById(documentId);
        if (document) {
          document.status = 'failed';
          await document.save();
        }
      } catch (updateError) {
        console.error('Failed to update document status:', updateError);
      }
      
      throw new Error(`Signing failed: ${error.message}`);
    }
  }

  // Get all documents
  static async getAllDocuments(page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      
      const documents = await PdfDocument.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v');
      
      const total = await PdfDocument.countDocuments();
      
      return {
        documents,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to get documents: ${error.message}`);
    }
  }

  // Get single document
  static async getDocument(id) {
    try {
      const document = await PdfDocument.findById(id);
      if (!document) {
        throw new Error('Document not found');
      }
      return document;
    } catch (error) {
      throw new Error(`Failed to get document: ${error.message}`);
    }
  }

  // Get audit trail
  static async getAuditTrail(documentId) {
    try {
      const auditTrails = await AuditTrail.find({ documentId })
        .sort({ timestamp: -1 });
      
      return auditTrails;
    } catch (error) {
      throw new Error(`Failed to get audit trail: ${error.message}`);
    }
  }

  // Clean up temporary files
  static async cleanupTempFiles(hoursOld = 24) {
    try {
      const tempDir = path.join(process.cwd(), 'uploads', 'temp');
      const files = await fs.readdir(tempDir);
      const now = Date.now();
      const maxAge = hoursOld * 60 * 60 * 1000;
      
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }
      
      console.log(`🧹 Cleaned up ${deletedCount} temporary files`);
      return deletedCount;
      
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
    }
  }
}

module.exports = PdfService;