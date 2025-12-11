const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const PdfDocument = require('../models/PdfDocument');

class EmailService {
  // Create reusable transporter with debugging
  static createTransporter() {
    try {
      console.log('📧 Creating SMTP transporter...');
      
      // Validate required environment variables
      const required = ['SMTP_USER', 'SMTP_PASS'];
      for (const req of required) {
        if (!process.env[req]) {
          throw new Error(`Missing environment variable: ${req}`);
        }
      }

      // Use Gmail service for simplicity
      const config = {
        service: 'gmail', // This automatically sets host and port for Gmail
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        // Optional: Add timeouts to prevent hanging
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
        // For Gmail specifically
        secure: true,
        tls: {
          rejectUnauthorized: false // For development only, remove in production
        }
      };

      console.log('✅ SMTP Configuration Loaded:');
      console.log('- Service: Gmail');
      console.log('- User:', process.env.SMTP_USER);
      console.log('- Password configured:', process.env.SMTP_PASS ? 'Yes' : 'No');

      return nodemailer.createTransport(config);
    } catch (error) {
      console.error('❌ Failed to create email transporter:', error.message);
      throw error;
    }
  }

  // Send PDF via email
  static async sendPdfEmail(documentId, recipient, subject, message) {
    let transporter;
    
    try {
      console.log(`\n📤 Starting email process...`);
      console.log(`- Document ID: ${documentId}`);
      console.log(`- Recipient: ${recipient}`);
      
      // Step 1: Validate recipient email
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(recipient)) {
        throw new Error(`Invalid email address format: ${recipient}`);
      }

      // Step 2: Get document from database
      console.log('🔍 Fetching document from database...');
      const document = await PdfDocument.findById(documentId);
      if (!document) {
        throw new Error(`Document not found with ID: ${documentId}`);
      }

      if (!document.signedFilePath) {
        throw new Error('Document has not been signed yet. Please sign the document first.');
      }

      console.log(`📄 Document found: ${document.originalFileName}`);
      console.log(`📁 Signed file path: ${document.signedFilePath}`);

      // Step 3: Locate and read PDF file
      console.log('📂 Reading PDF file...');
      
      let filePath;
      let pdfBuffer;
      
      // Handle different path scenarios
      if (document.signedFilePath.startsWith('/')) {
        // Absolute path
        filePath = document.signedFilePath;
      } else if (document.signedFilePath.includes('uploads/')) {
        // Relative path with uploads folder
        filePath = path.join(process.cwd(), document.signedFilePath);
      } else {
        // Default: assume it's in uploads folder
        filePath = path.join(process.cwd(), 'uploads', 'signed', document.signedFilePath);
      }
      
      console.log(`📍 Full file path: ${filePath}`);
      
      // Check if file exists
      try {
        await fs.access(filePath);
        pdfBuffer = await fs.readFile(filePath);
        console.log(`✅ PDF loaded successfully (${pdfBuffer.length} bytes)`);
      } catch (err) {
        // Try alternative paths
        console.log('⚠️ First path failed, trying alternatives...');
        
        // Alternative 1: Check in current working directory
        const altPath1 = path.join(process.cwd(), document.signedFilePath);
        try {
          await fs.access(altPath1);
          filePath = altPath1;
          pdfBuffer = await fs.readFile(filePath);
          console.log(`✅ PDF found at alternative path: ${filePath}`);
        } catch {
          // Alternative 2: Check uploads directory
          const altPath2 = path.join(__dirname, '../../uploads', document.signedFilePath);
          try {
            await fs.access(altPath2);
            filePath = altPath2;
            pdfBuffer = await fs.readFile(filePath);
            console.log(`✅ PDF found at: ${filePath}`);
          } catch (error2) {
            throw new Error(`PDF file not found. Tried:\n1. ${filePath}\n2. ${altPath1}\n3. ${altPath2}\nError: ${error2.message}`);
          }
        }
      }

      // Step 4: Create email transporter
      console.log('🔗 Creating email transporter...');
      transporter = this.createTransporter();

      // Step 5: Prepare email content
      console.log('📝 Preparing email content...');
      
      const mailOptions = {
        from: process.env.SMTP_FROM || `"PDF Signature App" <${process.env.SMTP_USER}>`,
        to: recipient,
        subject: subject || 'Signed PDF Document',
        text: message || 'Please find attached the signed PDF document.',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; }
              .details { background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0; }
              .footer { color: #6b7280; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0;">Signed PDF Document</h1>
            </div>
            <div class="content">
              <p>${(message || 'Please find attached the signed PDF document.').replace(/\n/g, '<br>')}</p>
              
              <div class="details">
                <h3 style="margin-top: 0; color: #374151;">Document Details:</h3>
                <ul style="margin-bottom: 0;">
                  <li><strong>File Name:</strong> ${document.originalFileName}</li>
                  <li><strong>Processed Date:</strong> ${new Date(document.signedAt || document.createdAt).toLocaleDateString()}</li>
                  <li><strong>Total Pages:</strong> ${document.totalPages || 'N/A'}</li>
                  <li><strong>Document ID:</strong> ${documentId}</li>
                </ul>
              </div>
              
              <p>The attached PDF has been digitally processed and is ready for your records.</p>
              
              <div class="footer">
                <p>This email was automatically sent from the PDF Signature Application.</p>
                <p>If you did not expect this email, please ignore it or contact the sender.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        attachments: [
          {
            filename: `signed_${document.originalFileName.replace('.pdf', '')}_${Date.now()}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
            encoding: 'base64'
          }
        ]
      };

      // Step 6: Send email
      console.log('🚀 Sending email...');
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent successfully!`);
      console.log(`📨 Message ID: ${info.messageId}`);
      console.log(`👤 To: ${recipient}`);

      // Step 7: Create audit trail
      console.log('📊 Creating audit trail...');
      try {
        const AuditTrail = require('../models/AuditTrail');
        await AuditTrail.create({
          documentId: document._id,
          action: 'email_sent',
          user: 'system', // You might want to pass user info
          details: {
            recipient: recipient,
            subject: subject,
            messageId: info.messageId,
            emailSent: true,
            timestamp: new Date(),
            fileSize: pdfBuffer.length,
            fileName: document.originalFileName
          }
        });
        console.log('✅ Audit trail created');
      } catch (auditError) {
        console.warn('⚠️ Failed to create audit trail (non-critical):', auditError.message);
      }

      // Step 8: Update document status
      try {
        document.emailSent = true;
        document.emailRecipients = document.emailRecipients || [];
        document.emailRecipients.push({
          email: recipient,
          sentAt: new Date(),
          messageId: info.messageId
        });
        await document.save();
        console.log('✅ Document status updated');
      } catch (updateError) {
        console.warn('⚠️ Failed to update document status (non-critical):', updateError.message);
      }

      return {
        success: true,
        messageId: info.messageId,
        recipient: recipient,
        documentId: documentId,
        fileName: document.originalFileName,
        message: 'Email sent successfully',
        timestamp: new Date()
      };

    } catch (error) {
      console.error('\n❌ EMAIL SENDING FAILED:');
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
      
      // Create error audit trail
      try {
        const AuditTrail = require('../models/AuditTrail');
        await AuditTrail.create({
          documentId: documentId,
          action: 'email_failed',
          details: {
            recipient: recipient,
            error: error.message,
            timestamp: new Date(),
            success: false
          }
        });
      } catch (auditError) {
        console.error('Failed to create error audit:', auditError.message);
      }
      
      // Provide user-friendly error message
      let userMessage = 'Failed to send email. ';
      
      if (error.message.includes('Invalid login') || error.message.includes('EAUTH')) {
        userMessage += 'Email authentication failed. Please check your email settings in the .env file.';
      } else if (error.message.includes('ENOENT') || error.message.includes('not found')) {
        userMessage += 'PDF file not found. The document may have been moved or deleted.';
      } else if (error.message.includes('ECONNECTION')) {
        userMessage += 'Cannot connect to email server. Check your internet connection and SMTP settings.';
      } else if (error.message.includes('Invalid email')) {
        userMessage += 'Invalid email address format. Please check the recipient email.';
      } else {
        userMessage += `Error: ${error.message}`;
      }
      
      throw new Error(userMessage);
    } finally {
      // Close transporter if it exists
      if (transporter) {
        transporter.close();
      }
    }
  }

  // Send test email (for configuration testing)
  static async sendTestEmail(recipient = null) {
    let transporter;
    
    try {
      console.log('\n🧪 Sending test email...');
      
      transporter = this.createTransporter();
      
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: recipient || process.env.SMTP_USER,
        subject: '✅ Test Email: PDF Signature App',
        text: 'This is a test email to verify SMTP configuration is working correctly.',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f0f9ff; border-radius: 8px;">
            <h2 style="color: #0369a1;">✅ Test Email Successful!</h2>
            <p>This email confirms that your PDF Signature App email configuration is working correctly.</p>
            <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #10b981;">
              <p><strong>Configuration Details:</strong></p>
              <ul>
                <li><strong>Service:</strong> ${process.env.SMTP_SERVICE || 'Gmail'}</li>
                <li><strong>User:</strong> ${process.env.SMTP_USER}</li>
                <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
                <li><strong>Status:</strong> <span style="color: #10b981;">Working ✓</span></li>
              </ul>
            </div>
            <p style="color: #6b7280; font-size: 14px;">You can now send signed PDF documents via email from your application.</p>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      
      console.log('✅ Test email sent successfully!');
      console.log(`📨 Message ID: ${info.messageId}`);
      console.log(`👤 Sent to: ${recipient || process.env.SMTP_USER}`);
      
      return {
        success: true,
        messageId: info.messageId,
        recipient: recipient || process.env.SMTP_USER,
        message: 'Test email sent successfully',
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('❌ Test email failed:', error.message);
      
      // Detailed error analysis
      let detailedError = error.message;
      
      if (error.code === 'EAUTH') {
        detailedError = 'Authentication failed. Check:\n1. SMTP_USER and SMTP_PASS in .env file\n2. If using Gmail, use App Password not regular password\n3. Ensure 2FA is enabled on Google account';
      } else if (error.code === 'ECONNECTION') {
        detailedError = 'Connection failed. Check:\n1. Internet connection\n2. SMTP_HOST and SMTP_PORT\n3. Firewall settings';
      }
      
      throw new Error(`Test email failed: ${detailedError}`);
    } finally {
      if (transporter) {
        transporter.close();
      }
    }
  }

  // Verify SMTP configuration
  static async verifySMTP() {
    let transporter;
    
    try {
      console.log('\n🔍 Verifying SMTP configuration...');
      
      // Check environment variables
      console.log('📋 Checking environment variables:');
      console.log('- SMTP_USER:', process.env.SMTP_USER ? '✓ Set' : '✗ Missing');
      console.log('- SMTP_PASS:', process.env.SMTP_PASS ? '✓ Set (' + process.env.SMTP_PASS.length + ' chars)' : '✗ Missing');
      console.log('- SMTP_HOST:', process.env.SMTP_HOST || 'Default (smtp.gmail.com)');
      console.log('- SMTP_PORT:', process.env.SMTP_PORT || 'Default (587)');
      
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return {
          success: false,
          message: 'Missing required environment variables: SMTP_USER and SMTP_PASS',
          details: {
            userSet: !!process.env.SMTP_USER,
            passSet: !!process.env.SMTP_PASS
          }
        };
      }
      
      // Create transporter
      transporter = this.createTransporter();
      
      // Verify connection
      console.log('🔗 Testing SMTP connection...');
      await transporter.verify();
      
      console.log('✅ SMTP configuration is valid and ready to use!');
      
      return {
        success: true,
        message: 'SMTP configuration is valid',
        details: {
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: process.env.SMTP_PORT || 587,
          user: process.env.SMTP_USER,
          secure: process.env.SMTP_SECURE === 'true'
        }
      };
      
    } catch (error) {
      console.error('❌ SMTP verification failed:', error.message);
      
      return {
        success: false,
        error: error.message,
        message: 'SMTP configuration is invalid. Please check your .env file.',
        code: error.code,
        solution: this.getSMTPErrorSolution(error)
      };
    } finally {
      if (transporter) {
        transporter.close();
      }
    }
  }

  // Get solution for SMTP errors
  static getSMTPErrorSolution(error) {
    const solutions = {
      'EAUTH': '1. Enable 2FA on Google Account\n2. Generate App Password\n3. Use App Password in SMTP_PASS\n4. Check username is correct',
      'ECONNECTION': '1. Check internet connection\n2. Verify SMTP_HOST and SMTP_PORT\n3. Try SMTP_PORT 465 with secure: true\n4. Check firewall/antivirus',
      'ETIMEDOUT': '1. Increase timeout settings\n2. Check network stability\n3. Try different SMTP port',
      'ENOTFOUND': '1. SMTP_HOST is incorrect\n2. DNS resolution failed\n3. Check spelling of hostname',
      'Invalid login': '1. Use App Password, not regular password\n2. Ensure 2FA is enabled\n3. Regenerate App Password if needed'
    };
    
    for (const [key, solution] of Object.entries(solutions)) {
      if (error.message.includes(key) || error.code === key) {
        return solution;
      }
    }
    
    return '1. Check .env file\n2. Verify email credentials\n3. Ensure required ports are open\n4. Try using Gmail App Password';
  }

  // Bulk email sending (for multiple recipients)
  static async sendBulkEmails(documentId, recipients, subject, message) {
    const results = [];
    
    for (const recipient of recipients) {
      try {
        const result = await this.sendPdfEmail(documentId, recipient, subject, message);
        results.push({
          recipient,
          success: true,
          messageId: result.messageId
        });
      } catch (error) {
        results.push({
          recipient,
          success: false,
          error: error.message
        });
      }
    }
    
    return {
      total: recipients.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results: results
    };
  }
}

module.exports = EmailService;

