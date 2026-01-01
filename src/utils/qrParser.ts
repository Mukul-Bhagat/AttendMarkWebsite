/**
 * QR Code Parser Utility
 * 
 * Normalizes QR content to extract sessionId from:
 * - Raw sessionId: "507f1f77bcf86cd799439011"
 * - URL with sessionId: "https://example.com/quick-scan/507f1f77bcf86cd799439011"
 * - URL with query params: "https://example.com/quick-scan/507f1f77bcf86cd799439011?token=xyz"
 * 
 * Returns the extracted sessionId or null if invalid
 */
export const extractSessionIdFromQR = (qrContent: string): string | null => {
  if (!qrContent || typeof qrContent !== 'string') {
    return null;
  }

  const trimmed = qrContent.trim();
  
  // Check if it's a valid MongoDB ObjectId (24 hex characters)
  const objectIdPattern = /^[0-9a-fA-F]{24}$/;
  if (objectIdPattern.test(trimmed)) {
    return trimmed;
  }

  // Try to extract from URL pattern: /quick-scan/:sessionId
  const urlPattern = /\/quick-scan\/([0-9a-fA-F]{24})/;
  const match = trimmed.match(urlPattern);
  if (match && match[1]) {
    return match[1];
  }

  // Try to extract from any URL with sessionId as last path segment
  try {
    const url = new URL(trimmed);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];
    
    if (lastSegment && objectIdPattern.test(lastSegment)) {
      return lastSegment;
    }
  } catch {
    // Not a valid URL, continue
  }

  // Try to extract from path-like string (without protocol)
  const pathMatch = trimmed.match(/\/([0-9a-fA-F]{24})(?:\?|$)/);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1];
  }

  return null;
};

