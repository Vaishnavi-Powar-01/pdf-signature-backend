const express = require('express');
const router = express.Router();
const PdfController = require('../controllers/pdfController');
const { uploadPdf, uploadSignature } = require('../middleware/upload');
const { validateSignPdf } = require('../middleware/validation');

// Test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'PDF API is working',
    timestamp: new Date().toISOString()
  });
});

// Health check
router.get('/health', PdfController.healthCheck);

// Upload PDF (using same pattern as first example)
router.post('/upload', uploadPdf.single('pdf'), PdfController.uploadPdf);

// Sign PDF (optionally add signature image upload)
router.post('/sign', 
  uploadSignature.single('signatureImage'), // Optional signature image
  validateSignPdf, 
  PdfController.signPdf
);
// Add this route to help debug
router.get('/debug-upload', (req, res) => {
  const { uploadPaths } = require('../middleware/upload');
  res.json({
    uploadPaths: uploadPaths,
    cwd: process.cwd(),
    __dirname: __dirname
  });
});

// Get all documents
router.get('/documents', PdfController.getDocuments);

// Get specific document
router.get('/document/:id', PdfController.getDocument);

// Download signed PDF
router.get('/download/:id/signed', PdfController.downloadSignedPdf);

// Download original PDF
router.get('/download/:id/original', PdfController.downloadOriginalPdf);

// Verify document integrity
router.get('/verify/:id', PdfController.verifyIntegrity);

// Get audit trail
router.get('/audit/:id', PdfController.getAuditTrail);

module.exports = router;