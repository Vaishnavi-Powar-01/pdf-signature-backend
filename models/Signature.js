const mongoose = require('mongoose');

const signatureSchema = new mongoose.Schema({
  userId: String,
  signatureData: {
    type: String, // Base64 encoded image
    required: true
  },
  signatureType: {
    type: String,
    enum: ['drawn', 'uploaded', 'digital'],
    default: 'drawn'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUsed: Date,
  metadata: {
    width: Number,
    height: Number,
    aspectRatio: Number,
    fileSize: Number
  }
}, {
  timestamps: true
});

// Check if model already exists before creating it
const Signature = mongoose.models.Signature || mongoose.model('Signature', signatureSchema);

module.exports = Signature;