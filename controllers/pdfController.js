const PdfService = require('../services/pdfService');
const HashService = require('../services/hashService');
const Helpers = require('../utils/helpers');
const path = require('path');
const fs = require('fs').promises;

class PdfController {
  // Upload PDF
  static async uploadPdf(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No PDF file uploaded'
        });
      }

      const metadata = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        ...req.body
      };

      const result = await PdfService.uploadPdf(req.file, metadata);

      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Sign PDF
  static async signPdf(req, res) {
    try {
      const { documentId, fields, signatureData } = req.body;
      
      if (!documentId) {
        return res.status(400).json({
          success: false,
          error: 'Document ID is required'
        });
      }

      if (!fields || !Array.isArray(fields)) {
        return res.status(400).json({
          success: false,
          error: 'Fields array is required'
        });
      }

      const metadata = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.body.userId || 'anonymous'
      };

      const result = await PdfService.signPdf(
        documentId, 
        fields, 
        signatureData, 
        metadata
      );

      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get all documents
  static async getDocuments(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      
      const result = await PdfService.getAllDocuments(page, limit);
      
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get document by ID
  static async getDocument(req, res) {
    try {
      const { id } = req.params;
      
      const document = await PdfService.getDocument(id);
      
      res.status(200).json({
        success: true,
        data: document
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  // Download signed PDF
  static async downloadSignedPdf(req, res) {
    try {
      const { id } = req.params;
      
      const document = await PdfService.getDocument(id);
      
      if (!document.signedFilePath) {
        return res.status(404).json({
          success: false,
          error: 'Signed PDF not found'
        });
      }

      // Build absolute path from project root
      const filePath = path.join(process.cwd(), document.signedFilePath);
      
      // Verify file exists
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({
          success: false,
          error: 'File not found on server',
          path: document.signedFilePath
        });
      }

      // Set headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalFileName.replace('.pdf', '_signed.pdf')}"`);
      
      // Stream the file
      const fileStream = require('fs').createReadStream(filePath);
      fileStream.pipe(res);
      
      // Create download audit trail
      const AuditTrail = require('../models/AuditTrail');
      await AuditTrail.create({
        documentId: document._id,
        action: 'download',
        originalHash: document.originalHash,
        newHash: document.signedHash,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        details: {
          fileName: document.originalFileName
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Download original PDF
  static async downloadOriginalPdf(req, res) {
    try {
      const { id } = req.params;
      
      const document = await PdfService.getDocument(id);
      
      // Build absolute path from project root
      const filePath = path.join(process.cwd(), document.originalFilePath);
      
      // Verify file exists
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({
          success: false,
          error: 'File not found on server',
          path: document.originalFilePath
        });
      }

      // Set headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalFileName}"`);
      
      // Stream the file
      const fileStream = require('fs').createReadStream(filePath);
      fileStream.pipe(res);
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Verify document integrity
  static async verifyIntegrity(req, res) {
    try {
      const { id } = req.params;
      
      const document = await PdfService.getDocument(id);
      
      // Build absolute path from project root
      const filePath = path.join(process.cwd(), document.originalFilePath);
      
      const verification = await HashService.verifyDocumentIntegrity(
        document.originalHash,
        filePath
      );
      
      res.status(200).json({
        success: true,
        data: verification
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get audit trail
  static async getAuditTrail(req, res) {
    try {
      const { id } = req.params;
      
      const auditTrails = await PdfService.getAuditTrail(id);
      
      res.status(200).json({
        success: true,
        data: auditTrails
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Health check
  static async healthCheck(req, res) {
    try {
      const mongoose = require('mongoose');
      const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
      
      // Check disk space
      const checkDiskSpace = require('check-disk-space').default;
      const diskSpace = await checkDiskSpace(process.cwd());
      
      res.status(200).json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        diskSpace: {
          free: Helpers.formatFileSize(diskSpace.free),
          total: Helpers.formatFileSize(diskSpace.size),
          used: Helpers.formatFileSize(diskSpace.size - diskSpace.free)
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        workingDirectory: process.cwd()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: error.message
      });
    }
  }
}

module.exports = PdfController;