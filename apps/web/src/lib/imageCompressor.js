/**
 * imageCompressor.js
 * Canvas-based utility to compress image files below a specified size limit.
 */
export async function compressImage(file, maxSizeMB = 2) {
  return new Promise((resolve, reject) => {
    if (!window.FileReader || !window.HTMLCanvasElement) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        
        // If file size is already smaller than target, just resolve with base64
        if (file.size <= maxSizeBytes) {
          resolve(event.target.result);
          return;
        }

        // Draw image on canvas to compress
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Downscale image if it is extremely large to save memory and base64 size
        const maxDimension = 1600;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target.result); // Fallback to original
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Adjust compression quality iteratively to fit under limit
        let quality = 0.8;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        // Convert base64 length to approx byte size
        let approxSize = Math.round((dataUrl.length - 22) * 3 / 4);

        while (approxSize > maxSizeBytes && quality > 0.1) {
          quality -= 0.15;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          approxSize = Math.round((dataUrl.length - 22) * 3 / 4);
        }

        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
