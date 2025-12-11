const sharp = require('sharp');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
// const fs = require('fs'); // Not used in class methods but useful for testing
// const path = require('path'); // Not used in class methods but useful for testing

class SignatureService {
    // --- Utility Methods (Optimized for robustness) ---

    // Process signature image while preserving aspect ratio
    static async processSignatureImage(imageBuffer, targetWidth, targetHeight) {
        try {
            const metadata = await sharp(imageBuffer).metadata();
            const originalWidth = metadata.width;
            const originalHeight = metadata.height;
            const originalAspectRatio = originalWidth / originalHeight;
            const targetAspectRatio = targetWidth / targetHeight;
            
            let resizeWidth, resizeHeight;
            let offsetX = 0, offsetY = 0;
            
            // Calculate resize dimensions to maintain aspect ratio (fit logic)
            if (originalAspectRatio > targetAspectRatio) {
                resizeWidth = targetWidth;
                resizeHeight = Math.round(targetWidth / originalAspectRatio);
                offsetY = Math.round((targetHeight - resizeHeight) / 2);
            } else {
                resizeHeight = targetHeight;
                resizeWidth = Math.round(targetHeight * originalAspectRatio);
                offsetX = Math.round((targetWidth - resizeWidth) / 2);
            }
            
            // Create a canvas with a transparent background to hold the resized image
            const processedImage = await sharp({
                create: {
                    width: targetWidth,
                    height: targetHeight,
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
                }
            })
            .composite([
                {
                    input: await sharp(imageBuffer)
                        .resize(resizeWidth, resizeHeight, {
                            fit: 'contain',
                            background: { r: 0, g: 0, b: 0, alpha: 0 }
                        })
                        .toBuffer(),
                    left: offsetX,
                    top: offsetY
                }
            ])
            .png()
            .toBuffer();
            
            return processedImage;
            
        } catch (error) {
            console.error("Error processing signature image:", error.message);
            throw new Error(`Failed to process signature image: ${error.message}`);
        }
    }

    // --- Core Processing Method ---

    static async processFieldsOnPdf(pdfBuffer, fields) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const pages = pdfDoc.getPages();
            
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            
            const fieldsByPage = {};
            fields.forEach(field => {
                // Ensure page number defaults to 1 if not provided or invalid
                const pageIndex = (field.page && field.page >= 1) ? field.page - 1 : 0; 
                if (!fieldsByPage[pageIndex]) fieldsByPage[pageIndex] = [];
                fieldsByPage[pageIndex].push(field);
            });
            
            for (const [pageIndexStr, pageFields] of Object.entries(fieldsByPage)) {
                const pageIndex = parseInt(pageIndexStr);
                
                if (pageIndex >= pages.length) continue;
                
                const page = pages[pageIndex];
                const { height: pageHeight } = page.getSize();
                
                for (const field of pageFields) {
                    await this.processField(page, field, pageHeight, pdfDoc, font, boldFont);
                }
            }
            
            const modifiedPdfBytes = await pdfDoc.save();
            return Buffer.from(modifiedPdfBytes);
            
        } catch (error) {
            throw new Error(`Failed to process fields: ${error.message}`);
        }
    }

    // --- Field Processing Logic with Fixes ---

    static async processField(page, field, pageHeight, pdfDoc, font, boldFont) {
        const { type, position, size, value } = field;

        // CRITICAL COORDINATE CONVERSION FIX:
        // Web/React uses (x, y) = (Top, Left) origin.
        // PDF uses (x, y) = (Bottom, Left) origin.
        // We must calculate the PDF's Bottom-Left corner (y coordinate)
        const x = position.x;
        // PDF_Y = Page_Height - Web_Y_Top - Element_Height
        const y = pageHeight - position.y - size.height;
        
        try {
            switch (type) {
                case 'text':
                case 'date':
                    if (value) {
                        // 1. Draw Background/Border
                        page.drawRectangle({
                            x,
                            y,
                            width: size.width,
                            height: size.height,
                            borderColor: rgb(0.5, 0.5, 0.5),
                            borderWidth: 0.5,
                            color: rgb(1, 1, 1) // White fill
                        });
                        
                        // 2. Draw Text (Vertically Centered)
                        const fontSize = Math.min(12, size.height * 0.5);
                        // Calculate Y to place the text baseline for centering (adjusted empirically)
                        const textY = y + (size.height / 2) - (fontSize / 2); 
                        
                        page.drawText(value, {
                            x: x + 5, // Left padding
                            y: textY,
                            size: fontSize,
                            font: font,
                            color: rgb(0, 0, 0)
                        });
                    }
                    break;

                case 'checkbox':
                    const checkboxSize = Math.min(size.width, size.height);
                    
                    // 1. Draw Checkbox Box
                    page.drawRectangle({
                        x,
                        y,
                        width: checkboxSize,
                        height: checkboxSize,
                        borderWidth: 1.5,
                        borderColor: rgb(0, 0, 0),
                        color: rgb(1, 1, 1) // Crucial: White fill to prevent solid black box
                    });
                    
                    // 2. Draw Checkmark/X (Only if checked)
                    if (value === 'checked' || value === true || value === 'true') {
                        // Draw a simple 'X' for reliable rendering
                        const markSize = checkboxSize * 0.8;
                        const centerX = x + checkboxSize / 2;
                        const centerY = y + checkboxSize / 2;

                        page.drawText('X', {
                            // Calculate X to center the text
                            x: centerX - (boldFont.widthOfTextAtSize('X', markSize) / 2),
                            // Calculate Y to center the text (adjusting for baseline)
                            y: centerY - (markSize / 2), 
                            size: markSize,
                            font: boldFont,
                            color: rgb(0, 0, 0)
                        });
                    }
                    break;

                case 'radio':
                    const radius = Math.min(size.width, size.height) / 2;
                    const centerX = x + radius;
                    const centerY = y + radius;
                    
                    // 1. Draw Outer Circle
                    page.drawCircle({
                        x: centerX,
                        y: centerY,
                        size: radius,
                        borderWidth: 1.5,
                        borderColor: rgb(0, 0, 0),
                        color: rgb(1, 1, 1) // Crucial: White fill to prevent solid black circle
                    });
                    
                    // 2. Draw Inner Dot (Only if checked)
                    if (value === 'checked' || value === true || value === 'true') {
                        page.drawCircle({
                            x: centerX,
                            y: centerY,
                            size: radius * 0.5,
                            color: rgb(0, 0, 0) // Black fill for the dot
                        });
                    }
                    break;
                    
                case 'signature':
                case 'image':
                    if (value && value.startsWith('data:image')) {
                        const imageBuffer = Buffer.from(value.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                        const processedImage = await this.processSignatureImage(imageBuffer, size.width, size.height);
                        
                        let embeddedImage;
                        try {
                            // Use PNG to preserve transparency (if any)
                            embeddedImage = await pdfDoc.embedPng(processedImage);
                        } catch (error) {
                            embeddedImage = await pdfDoc.embedJpg(processedImage);
                        }
                        
                        page.drawImage(embeddedImage, { x, y, width: size.width, height: size.height });
                    }
                    break;
            }
        } catch (error) {
            console.error(`Error processing ${type} field at (${x}, ${y}):`, error.message);
        }
    }
}

module.exports = SignatureService;