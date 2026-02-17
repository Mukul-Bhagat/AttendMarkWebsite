/**
 * Optimizes a Cloudinary URL by injecting transformation parameters.
 * 
 * @param url The original Cloudinary URL (or any URL).
 * @param width The desired width.
 * @param height The desired height.
 * @param mode The crop mode (default: 'fill').
 * @returns The optimized URL with transformations, or the original URL if not a Cloudinary URL.
 */
export const getOptimizedImageUrl = (
    url: string | undefined | null,
    width: number = 100,
    height: number = 100,
    mode: string = 'fill'
): string => {
    if (!url) return '';

    // Check if it's a Cloudinary URL
    if (!url.includes('cloudinary.com')) {
        return url;
    }

    // Find the insertion point: after "/upload/"
    const uploadIndex = url.indexOf('/upload/');
    if (uploadIndex === -1) {
        return url;
    }

    // Construct the transformation string
    // f_auto: Automatically choose the best format (e.g., WebP, AVIF)
    // q_auto: Automatically adjust quality
    // w_{width},h_{height}: Resize
    // c_{mode}: Crop mode
    const transformation = `f_auto,q_auto,w_${width},h_${height},c_${mode}`;

    // Insert the transformation string
    // The insertion point is right after "/upload/" (length is 8)
    const insertionPoint = uploadIndex + 8;
    return url.slice(0, insertionPoint) + transformation + '/' + url.slice(insertionPoint);
};
