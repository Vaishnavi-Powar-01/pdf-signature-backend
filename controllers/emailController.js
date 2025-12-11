const EmailService = require('../services/emailService');
const PdfService = require('../services/pdfService');
const AuditTrail = require('../models/AuditTrail');

class EmailController {
  // Send PDF via email
  static async sendPdfEmail(req, res) {
    try {
      const { documentId, recipient, subject, message } = req.body;

      if (!documentId || !recipient) {
        return res.status(400).json({
          success: false,
          error: 'Document ID and recipient email are required'
        });
      }

      const result = await EmailService.sendPdfEmail(
        documentId,
        recipient,
        subject || 'Signed PDF Document',
        message || 'Please find attached the signed PDF document.'
      );

      res.status(200).json(result);
    } catch (error) {
      console.error('Email sending error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Send test email
  static async sendTestEmail(req, res) {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return res.status(400).json({
          success: false,
          error: 'SMTP configuration not found in environment variables'
        });
      }

      const result = await EmailService.sendTestEmail();
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Verify SMTP configuration
  static async verifySMTP(req, res) {
    try {
      const result = await EmailService.verifySMTP();
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get email audit trail for a document
  static async getEmailAudit(req, res) {
    try {
      const { id } = req.params;

      const auditTrails = await AuditTrail.find({
        documentId: id,
        action: 'email'
      }).sort({ timestamp: -1 });

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
}

module.exports = EmailController;