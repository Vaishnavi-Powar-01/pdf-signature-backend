require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/database');
const pdfRoutes = require('./routes/pdfRoutes');
const PdfService = require('./services/pdfService');
const emailRoutes = require('./routes/emailRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure upload directories exist
const uploadDirs = ['uploads/original', 'uploads/signed', 'uploads/temp'];
uploadDirs.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created directory: ${dirPath}`);
  }
});

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['http://your-frontend-domain.com'] 
    : ['http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: process.env.UPLOAD_LIMIT || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.UPLOAD_LIMIT || '10mb' }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/pdf', pdfRoutes);
//Email Route
app.use('/api/email',emailRoutes);
// Welcome route
app.get('/', (req, res) => {
  res.json({
    message: '📄 PDF Signature API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      upload: 'POST /api/pdf/upload',
      sign: 'POST /api/pdf/sign',
      documents: 'GET /api/pdf/documents',
      download: 'GET /api/pdf/download/:id/signed',
      verify: 'GET /api/pdf/verify/:id',
      audit: 'GET /api/pdf/audit/:id',
      health: 'GET /api/pdf/health'
    },
    documentation: 'Check README.md for detailed API documentation'
  });
});
app.get('/', (req, res) => {
  res.json({
    message: '📄 PDF Signature API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      // ... existing endpoints ...
      email: {
        send: 'POST /api/email/send-pdf',
        test: 'POST /api/email/test-email',
        verify: 'GET /api/email/verify-smtp'
      }
    }
  });
});
// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '❌ Endpoint not found',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err);
  
  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File too large. Maximum size is 10MB'
    });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: 'Unexpected field in form data'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
const startServer = async () => {
  try {
    console.log('🚀 Starting PDF Signature Backend...');
    console.log(`⚙️  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔌 Port: ${PORT}`);
    
    // Connect to database
    await connectDB();
    
    // Start cleanup job (run every 6 hours)
    setInterval(() => {
      PdfService.cleanupTempFiles(24);
    }, 6 * 60 * 60 * 1000);
    
    // Initial cleanup
    PdfService.cleanupTempFiles(24);
    
    app.listen(PORT, () => {
      console.log(`✅ Server is running on: http://localhost:${PORT}`);
      console.log(`📚 API Base URL: http://localhost:${PORT}/api/pdf`);
      console.log(`📁 Upload directory: ${path.join(__dirname, '..', 'uploads')}`);
      console.log('🔄 Server ready!');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('💥 Unhandled Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});
// Email routes
app.get('/api/email/verify', async (req, res) => {
  try {
    const result = await EmailService.verifySMTP();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/email/test', async (req, res) => {
  try {
    const { recipient } = req.body;
    const result = await EmailService.sendTestEmail(recipient);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/email/send-pdf', async (req, res) => {
  try {
    const { documentId, recipient, subject, message } = req.body;
    const result = await EmailService.sendPdfEmail(documentId, recipient, subject, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

startServer();