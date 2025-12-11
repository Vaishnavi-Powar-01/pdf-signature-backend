const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['signature', 'text', 'date', 'radio', 'image', 'checkbox'],
    required: true
  },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  size: {
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  value: String,
  page: { type: Number, default: 1 },
  scale: { type: Number, default: 1 },
  metadata: {
    fontSize: Number,
    color: String,
    required: Boolean
  }
});

const pdfDocumentSchema = new mongoose.Schema({
  originalFileName: {
    type: String,
    required: true
  },
  originalFilePath: {
    type: String,
    required: true
  },
  signedFilePath: String,
  originalHash: {
    type: String,
    required: true
  },
  signedHash: String,
  fields: [fieldSchema],
  status: {
    type: String,
    enum: ['pending', 'processing', 'signed', 'failed'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  signedAt: Date,
  pageCount: Number,
  metadata: {
    author: String,
    title: String,
    subject: String
  }
}, {
  timestamps: true
});

// Index for faster queries
pdfDocumentSchema.index({ createdAt: -1 });
pdfDocumentSchema.index({ status: 1 });
pdfDocumentSchema.index({ originalHash: 1 });

// Check if model already exists before creating it
const PdfDocument = mongoose.models.PdfDocument || mongoose.model('PdfDocument', pdfDocumentSchema);

module.exports = PdfDocument;