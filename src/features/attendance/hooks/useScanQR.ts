import { useCallback, useMemo, useState } from 'react';

import api from '../../../api';

export interface ScanAttendancePayload {
  sessionId?: string;
  qrToken?: string;
  userLocation?: {
    latitude: number;
    longitude: number;
  };
  deviceId: string;
  userAgent: string;
  accuracy?: number;
  timestamp: number;
}

export interface ScanAttendanceResponse {
  status: 'MARKED' | 'ALREADY_MARKED' | 'FAILED';
  reason: string | null;
  msg: string;
  sessionName: string;
  className: string;
  sessionDate: string;
  distanceMeters: number;
  organizationId?: string;
  organizationName?: string;
}

type ScanAttendanceFn = (
  payload: ScanAttendancePayload,
) => Promise<ScanAttendanceResponse>;

type CanScanFn = (role: string) => boolean;

const defaultCanScan: CanScanFn = (role: string) =>
  role.trim().toUpperCase() !== 'PLATFORM_OWNER';

const defaultScanAttendance: ScanAttendanceFn = async (
  payload: ScanAttendancePayload,
) => {
  const { data } = await api.post('/api/attendance/scan', payload);
  return data as ScanAttendanceResponse;
};

export interface UseScanQROptions {
  role: string;
  scanAttendance?: ScanAttendanceFn;
  canScan?: CanScanFn;
}

export const useScanQR = ({
  role,
  scanAttendance = defaultScanAttendance,
  canScan = defaultCanScan,
}: UseScanQROptions) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanAttendanceResponse | null>(null);

  const submitScan = useCallback(
    async (payload: ScanAttendancePayload): Promise<ScanAttendanceResponse | null> => {
      if (!canScan(role)) {
        setError('Not authorized to scan attendance.');
        setResult(null);
        return null;
      }

      if (!payload.sessionId && !payload.qrToken) {
        setError('Session ID or QR token is required.');
        setResult(null);
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await scanAttendance(payload);
        setResult(response);
        return response;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to mark attendance';
        setError(message);
        setResult(null);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [canScan, role, scanAttendance],
  );

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
    setIsLoading(false);
  }, []);

  const isSuccess = useMemo(
    () => result?.status === 'MARKED' || result?.status === 'ALREADY_MARKED',
    [result],
  );

  const message = useMemo(() => {
    if (error) return error;
    return result?.msg || '';
  }, [error, result]);

  return {
    submitScan,
    reset,
    isLoading,
    error,
    result,
    isSuccess,
    message,
  };
};

export default useScanQR;
