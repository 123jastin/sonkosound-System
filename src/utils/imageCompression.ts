/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Compress an image File to a smaller size (JPEG) while keeping good quality.
 * @param file - Original image File
 * @param maxWidth - Max width in pixels (default 1200)
 * @param quality - JPEG quality 0-1 (default 0.75)
 * @returns Promise<string> - Base64 data URL (compressed)
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1200,
  quality: number = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions keeping aspect ratio
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        
        // Use high-quality downscaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with compression
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Compress a profile picture to smaller size (square-ish avatar)
 */
export async function compressProfilePicture(file: File): Promise<string> {
  return compressImage(file, 400, 0.8);
}

/**
 * Compress a product image
 */
export async function compressProductImage(file: File): Promise<string> {
  return compressImage(file, 1000, 0.7);
}
