const express = require('express');
const router = express.Router();
const EmailController = require('../controllers/emailController');

// Send PDF via email
router.post('/send-pdf', EmailController.sendPdfEmail);

// Send test email
router.post('/test-email', EmailController.sendTestEmail);

// Verify SMTP configuration
router.get('/verify-smtp', EmailController.verifySMTP);

// Get email audit trail
router.get('/audit/:id/emails', EmailController.getEmailAudit);

module.exports = router;