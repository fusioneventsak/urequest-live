/**
 * Resizes and compresses an image to reduce payload size
 * @param dataUrl The data URL of the image to compress
 * @param maxWidth Maximum width of the resulting image
 * @param maxHeight Maximum height of the resulting image
 * @param quality Compression quality (0-1)
 * @returns Promise that resolves to compressed image data URL
 */
export function resizeAndCompressImage(
  dataUrl: string, 
  maxWidth = 200, 
  maxHeight = 200,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Validate input
      if (!dataUrl || typeof dataUrl !== 'string') {
        reject(new Error('Invalid data URL: input is null or not a string'));
        return;
      }
      
      // Basic format validation
      if (!dataUrl.startsWith('data:image/')) {
        reject(new Error('Invalid data URL format: must start with "data:image/"'));
        return;
      }

      const img = new Image();
      
      img.onload = () => {
        try {
          // Calculate new dimensions while maintaining aspect ratio
          let width = img.width;
          let height = img.height;
          
          if (width === 0 || height === 0) {
            reject(new Error('Invalid image dimensions: width or height is zero'));
            return;
          }
          
          // Calculate aspect ratio
          const aspectRatio = width / height;
          
          // Scale down if needed
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round(maxWidth / aspectRatio);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round(maxHeight * aspectRatio);
              height = maxHeight;
            }
          }
          
          // Create canvas for resizing
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Failed to create canvas context'));
            return;
          }
          
          // Enable high-quality image scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Draw image with resize
          ctx.drawImage(img, 0, 0, width, height);
          
          // First try with user-specified quality
          let compressedDataUrl;
          try {
            compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          } catch (canvasError) {
            console.error('Canvas toDataURL error:', canvasError);
            reject(new Error('Failed to generate compressed image: ' + (canvasError instanceof Error ? canvasError.message : String(canvasError))));
            return;
          }
          
          // Check if the result is valid
          if (!compressedDataUrl || !compressedDataUrl.startsWith('data:image/')) {
            reject(new Error('Failed to generate valid image data URL'));
            return;
          }
          
          // Check file size
          const base64 = compressedDataUrl.split(',')[1];
          const size = Math.ceil((base64.length * 3) / 4);
          const maxSize = 300 * 1024; // 300KB max
          
          // If still too large, compress more aggressively
          if (size > maxSize) {
            // Try medium quality
            compressedDataUrl = canvas.toDataURL('image/jpeg', 0.5);
            
            const newBase64 = compressedDataUrl.split(',')[1];
            const newSize = Math.ceil((newBase64.length * 3) / 4);
            
            // If still too large, compress even more
            if (newSize > maxSize) {
              compressedDataUrl = canvas.toDataURL('image/jpeg', 0.3);
              
              const finalBase64 = compressedDataUrl.split(',')[1];
              const finalSize = Math.ceil((finalBase64.length * 3) / 4);
              
              // If still too large after maximum compression, reject
              if (finalSize > maxSize) {
                reject(new Error(`Image is too large (${Math.round(finalSize/1024)}KB) even after compression. Please use a smaller image.`));
                return;
              }
            }
          }
          
          resolve(compressedDataUrl);
        } catch (innerError) {
          console.error('Error in image processing:', innerError);
          reject(innerError instanceof Error ? innerError : new Error('Error processing image: ' + String(innerError)));
        }
      };
      
      img.onerror = (error) => {
        console.error('Image loading error:', error);
        reject(new Error('Failed to load image for compression'));
      };
      
      // Set crossOrigin to handle CORS issues
      img.crossOrigin = 'anonymous';
      img.src = dataUrl;
      
    } catch (error) {
      console.error('Unexpected error in image compression:', error);
      reject(error instanceof Error ? error : new Error('Unexpected error: ' + String(error)));
    }
  });
}

/**
 * Estimates the file size of a data URL in bytes
 */
export function estimateDataUrlSize(dataUrl: string): number {
  if (!dataUrl) return 0;
  
  // Extract the base64 part (after the comma)
  const base64 = dataUrl.split(',')[1];
  if (!base64) return 0;
  
  // Base64 encodes 3 bytes into 4 chars, so the decoded size is 3/4 of the base64 length
  return Math.floor(base64.length * 0.75);
}

/**
 * Gets the dimensions of an image from a data URL
 */
export function getImageDimensions(dataUrl: string): Promise<{ width: number, height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height
      });
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    img.crossOrigin = 'anonymous';
    img.src = dataUrl;
  });
}

/**
 * Validates an image URL by attempting to load it
 */
export function validateImageUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }
    
    const img = new Image();
    const timeout = setTimeout(() => {
      console.warn('Image validation timed out:', url);
      resolve(false);
    }, 5000);
    
    img.onload = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      console.warn('Image validation failed:', url);
      resolve(false);
    };
    
    img.crossOrigin = 'anonymous';
    
    // Add cache busting parameter
    const cacheBuster = Date.now();
    const separator = url.includes('?') ? '&' : '?';
    img.src = `${url}${separator}t=${cacheBuster}`;
  });
}