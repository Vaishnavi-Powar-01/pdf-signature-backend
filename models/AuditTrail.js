const mongoose = require('mongoose');

const auditTrailSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PdfDocument',
    required: true
  },
  action: {
    type: String,
    enum: ['upload', 'sign', 'view', 'download', 'modify', 'email'],
    required: true
  },
  originalHash: String,
  newHash: String,
  ipAddress: String,
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  details: {
    fieldCount: Number,
    pageNumber: Number,
    signatureType: String,
    userId: String,
    recipient: String,
    subject: String,
    messageId: String,
    emailSent: Boolean
  }
}, {
  timestamps: true
});

// Index for faster queries
auditTrailSchema.index({ documentId: 1, timestamp: -1 });
auditTrailSchema.index({ action: 1 });
auditTrailSchema.index({ timestamp: -1 });

// Check if model already exists before creating it
const AuditTrail = mongoose.models.AuditTrail || mongoose.model('AuditTrail', auditTrailSchema);

module.exports = AuditTrail;