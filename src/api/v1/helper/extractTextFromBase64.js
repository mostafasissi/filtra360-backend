const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');

/**
 * Extract text from Base64 encoded files (PDF, PNG, JPG)
 * @param {string} base64Data - Base64 encoded file data (with or without data URL prefix)
 * @returns {Promise<string>} - Extracted text content
 */
async function extractTextFromBase64(base64Data) {
  try {
    console.log('[extractTextFromBase64] Starting text extraction from Base64 data');
    
    // Remove data URL prefix if present (e.g., "data:application/pdf;base64,")
    let cleanBase64Data = base64Data;
    if (base64Data.includes(',')) {
      cleanBase64Data = base64Data.split(',')[1];
    }
    
    // Detect file type from Base64 header
    const fileType = detectFileType(cleanBase64Data);
    console.log(`[extractTextFromBase64] Detected file type: ${fileType}`);
    
    // Convert Base64 to Buffer
    const buffer = Buffer.from(cleanBase64Data, 'base64');
    
    let extractedText = '';
    
    switch (fileType) {
      case 'PDF':
        extractedText = await extractTextFromPDF(buffer);
        break;
      case 'PNG':
      case 'JPG':
        extractedText = await extractTextFromImage(buffer);
        break;
      default:
        throw new Error(`Unsupported file type: ${fileType}. Only PDF, PNG, and JPG files are supported.`);
    }
    
    // Clean up the extracted text
    const cleanedText = cleanupExtractedText(extractedText);
    
    console.log(`[extractTextFromBase64] Successfully extracted ${cleanedText.length} characters of text`);
    return cleanedText;
    
  } catch (error) {
    console.error('[extractTextFromBase64] Error:', error);
    throw new Error(`Failed to extract text from file: ${error.message}`);
  }
}

/**
 * Detect file type from Base64 header
 * @param {string} base64Data - Clean Base64 data (without data URL prefix)
 * @returns {string} - File type (PDF, PNG, JPG, or UNKNOWN)
 */
function detectFileType(base64Data) {
  // Get the first few characters of the Base64 data to identify file signature
  const header = base64Data.substring(0, 10);
  
  // Check for PDF signature (starts with "JVBER" which is Base64 for "%PDF")
  if (header.startsWith('JVBER')) {
    return 'PDF';
  }
  
  // Check for PNG signature (starts with "iVBOR" which is Base64 for PNG header)
  if (header.startsWith('iVBOR')) {
    return 'PNG';
  }
  
  // Check for JPG signature (starts with "/9j/" which is Base64 for JPEG header)
  if (header.startsWith('/9j/')) {
    return 'JPG';
  }
  
  return 'UNKNOWN';
}

/**
 * Extract text from PDF buffer using pdf-parse
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromPDF(buffer) {
  try {
    console.log('[extractTextFromPDF] Parsing PDF document');
    
    const pdfData = await pdfParse(buffer);
    
    if (!pdfData.text || pdfData.text.trim().length === 0) {
      throw new Error('No text content found in PDF. The PDF might be image-based or corrupted.');
    }
    
    console.log(`[extractTextFromPDF] Successfully extracted text from PDF (${pdfData.numpages} pages)`)
    console.log("========================[EXTRACTED TEXT]=======================");
    console.log(pdfData.text);
    console.log("==============================================================");
    return pdfData.text;
    
  } catch (error) {
    console.error('[extractTextFromPDF] Error parsing PDF:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Extract text from image buffer using Tesseract OCR
 * @param {Buffer} buffer - Image file buffer
 * @returns {Promise<string>} - Extracted text via OCR
 */
async function extractTextFromImage(buffer) {
  try {
    console.log('[extractTextFromImage] Starting OCR text extraction from image');
    
    // Use Tesseract.js to perform OCR on the image buffer
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng', {
      logger: (m) => {
        // Log OCR progress for debugging
        if (m.status === 'recognizing text') {
          console.log(`[extractTextFromImage] OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text content found in image. The image might be of poor quality or contain no readable text.');
    }
    
    console.log(`[extractTextFromImage] Successfully extracted text via OCR`);
    return text;
    
  } catch (error) {
    console.error('[extractTextFromImage] Error during OCR:', error);
    throw new Error(`Failed to extract text from image: ${error.message}`);
  }
}

/**
 * Clean up extracted text by removing excessive whitespace and line breaks
 * @param {string} text - Raw extracted text
 * @returns {string} - Cleaned text
 */
function cleanupExtractedText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    // Replace multiple consecutive whitespaces with single space
    .replace(/\s+/g, ' ')
    // Replace multiple consecutive line breaks with single line break
    .replace(/\n\s*\n/g, '\n')
    // Trim leading and trailing whitespace
    .trim();
}

module.exports = {
  extractTextFromBase64,
  detectFileType,
  extractTextFromPDF,
  extractTextFromImage,
  cleanupExtractedText
};