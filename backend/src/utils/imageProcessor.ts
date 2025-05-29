import { Logger } from '@nestjs/common';

const logger = new Logger('ImageProcessor');

/**
 * Validates if a base64 string is a valid image format
 * @param base64String The base64 string to validate
 * @returns boolean indicating if it's a valid image
 */
export function validateBase64Image(base64String: string): boolean {
  if (!base64String) {
    return false;
  }

  // Check if it's a data URL format
  if (!base64String.startsWith('data:image/')) {
    logger.warn('Invalid base64 image: Not in data URL format');
    return false;
  }

  // Basic validation to ensure it has the proper structure
  const matches = base64String.match(/^data:image\/([a-zA-Z]+);base64,([^\s]+)$/);
  if (!matches || matches.length !== 3) {
    logger.warn('Invalid base64 image: Malformed data URL');
    return false;
  }

  // Check for common image formats
  const imageType = matches[1].toLowerCase();
  if (!['jpeg', 'jpg', 'png', 'gif', 'webp', 'svg+xml'].includes(imageType)) {
    logger.warn(`Invalid base64 image: Unsupported image type ${imageType}`);
    return false;
  }

  // Check if the base64 part looks valid
  const base64Data = matches[2];
  if (base64Data.length % 4 !== 0) {
    logger.warn('Invalid base64 image: Invalid base64 padding');
    return false;
  }

  try {
    // Try to decode a small part of the base64 to validate it
    // We don't need to decode the whole image for validation
    const sampleLength = Math.min(100, base64Data.length);
    const sample = base64Data.substring(0, sampleLength);
    Buffer.from(sample, 'base64');
    return true;
  } catch (error) {
    logger.error(`Base64 validation error: ${error.message}`);
    return false;
  }
}

/**
 * Compresses a base64 image if it's too large
 * Note: This is a simple implementation - for production, consider a more robust solution
 * @param base64String The base64 string to compress
 * @param maxSizeKB Maximum size in KB (default: 1024KB/1MB)
 * @returns Compressed base64 string or original if not compressible
 */
export function compressBase64Image(base64String: string, maxSizeKB = 1024): string {
  if (!base64String) {
    return base64String;
  }

  // Estimate the size of the base64 string in KB
  const sizeInKB = Math.round((base64String.length * 3) / 4 / 1024);
  
  // If it's already small enough, return as is
  if (sizeInKB <= maxSizeKB) {
    logger.debug(`Image size is already under ${maxSizeKB}KB (current: ${sizeInKB}KB)`);
    return base64String;
  }

  logger.log(`Image size (${sizeInKB}KB) exceeds maximum (${maxSizeKB}KB), attempting to compress`);

  // Extract image data
  const matches = base64String.match(/^data:image\/([a-zA-Z]+);base64,([^\s]+)$/);
  if (!matches || matches.length !== 3) {
    logger.warn('Cannot compress: Invalid base64 image format');
    return base64String;
  }

  // For now, just truncate the base64 string to fit the maximum size
  // In a real-world scenario, you would use a proper image compression library
  const imageType = matches[1];
  const base64Data = matches[2];
  
  // Calculate how much we need to truncate
  const targetLength = Math.floor(maxSizeKB * 1024 * 4 / 3);
  const headerLength = `data:image/${imageType};base64,`.length;
  const dataLength = Math.max(targetLength - headerLength, 0);
  
  if (dataLength < base64Data.length) {
    logger.warn('Image truncated due to size limits. Consider implementing proper compression.');
    return `data:image/${imageType};base64,${base64Data.substring(0, dataLength)}`;
  }
  
  return base64String;
}

/**
 * Process the incoming base64 image - validate and compress if needed
 * @param base64String The base64 string to process
 * @param maxSizeKB Maximum size in KB (default: 1024KB/1MB)
 * @returns Processed base64 string or null if invalid
 */
export function processBase64Image(base64String: string, maxSizeKB = 1024): string | null {
  if (!validateBase64Image(base64String)) {
    return null;
  }
  
  return compressBase64Image(base64String, maxSizeKB);
}

export const convertImageToBase64 = async (imageFile: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(imageFile);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // The result includes the data URL prefix (e.g., "data:image/jpeg;base64,"),
        // which is what we want to store and use directly in <img> src.
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert image to base64: result is not a string.'));
      }
    };
    reader.onerror = (error) => {
      reject(new Error('Failed to read image file: ' + error));
    };
  });
}; 