const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define absolute paths for upload directories
const baseUploadPath = path.join(__dirname, '..', '..', 'uploads');
const uploadPaths = {
  original: path.join(baseUploadPath, 'original'),
  signed: path.join(baseUploadPath, 'signed'),
  temp: path.join(baseUploadPath, 'temp')
};

// Ensure upload directories exist
Object.values(uploadPaths).forEach(dirPath => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created directory: ${dirPath}`);
  }
});

// Configure storage for original PDFs
const pdfStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPaths.original);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'pdf-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure storage for signature images
const signatureStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPaths.temp);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'signature-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter for PDFs
const pdfFileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

// File filter for images
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Create upload instances
const uploadPdf = multer({
  storage: pdfStorage,
  fileFilter: pdfFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

const uploadSignature = multer({
  storage: signatureStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

module.exports = {
  uploadPdf,
  uploadSignature,
  uploadPaths // Export for debugging/testing
};  