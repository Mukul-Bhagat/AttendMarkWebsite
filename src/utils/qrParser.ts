/**
 * QR Code Parser Utility
 * 
 * Normalizes QR content to extract sessionId or qrToken from:
 * - Raw sessionId: "507f1f77bcf86cd799439011"
 * - URL with sessionId: "https://example.com/scan/507f1f77bcf86cd799439011"
 * - URL with query params: "https://example.com/scan?token=xyz"
 * - Legacy: "https://example.com/quick-scan/507f1f77bcf86cd799439011"
 * 
 * Returns the extracted sessionId or null if invalid
 */
export const extractQrTokenFromQR = (qrContent: string): string | null => {
  if (!qrContent || typeof qrContent !== 'string') {
    return null;
  }

  const trimmed = qrContent.trim();

  // Raw JWT token (three Base64URL segments)
  const jwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
  if (jwtPattern.test(trimmed)) {
    return trimmed;
  }

  // Try to extract from URL query param
  try {
    const url = new URL(trimmed);
    const tokenParam = url.searchParams.get('token') || url.searchParams.get('qrToken');
    if (tokenParam) {
      return tokenParam;
    }
  } catch {
    // Not a valid URL, continue
  }

  // Try to extract from raw query string
  const tokenMatch = trimmed.match(/[?&](?:token|qrToken)=([^&#]+)/i);
  if (tokenMatch && tokenMatch[1]) {
    try {
      return decodeURIComponent(tokenMatch[1]);
    } catch {
      return tokenMatch[1];
    }
  }

  return null;
};

export const extractSessionIdFromQR = (qrContent: string): string | null => {
  if (!qrContent || typeof qrContent !== 'string') {
    return null;
  }

  const trimmed = qrContent.trim();

  // Check if it's a valid MongoDB ObjectId (24 hex characters)
  // OR a Virtual Instance ID: ObjectId_YYYY-MM-DD
  const objectIdPattern = /^[0-9a-fA-F]{24}(?:_\d{4}-\d{2}-\d{2})?$/;
  if (objectIdPattern.test(trimmed)) {
    return trimmed;
  }

  // Try to extract from URL query param: ?sessionId=...
  try {
    const url = new URL(trimmed);
    const sessionIdParam = url.searchParams.get('sessionId');
    if (sessionIdParam && objectIdPattern.test(sessionIdParam)) {
      return sessionIdParam;
    }
  } catch {
    // Not a valid URL, continue
  }

  // Try to extract from URL pattern: /scan/:sessionId (new format)
  const scanPattern = /\/scan\/([0-9a-fA-F]{24}(?:_\d{4}-\d{2}-\d{2})?)/;
  const scanMatch = trimmed.match(scanPattern);
  if (scanMatch && scanMatch[1]) {
    return scanMatch[1];
  }

  // Try to extract from URL pattern: /quick-scan/:sessionId (legacy format, backward compatibility)
  const quickScanPattern = /\/quick-scan\/([0-9a-fA-F]{24}(?:_\d{4}-\d{2}-\d{2})?)/;
  const quickScanMatch = trimmed.match(quickScanPattern);
  if (quickScanMatch && quickScanMatch[1]) {
    return quickScanMatch[1];
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
  const pathMatch = trimmed.match(/\/([0-9a-fA-F]{24}(?:_\d{4}-\d{2}-\d{2})?)(?:\?|$)/);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1];
  }

  return null;
};

export const parseQrContent = (qrContent: string): { qrToken?: string; sessionId?: string } => {
  const qrToken = extractQrTokenFromQR(qrContent);
  if (qrToken) {
    return { qrToken };
  }

  const sessionId = extractSessionIdFromQR(qrContent);
  return sessionId ? { sessionId } : {};
};

