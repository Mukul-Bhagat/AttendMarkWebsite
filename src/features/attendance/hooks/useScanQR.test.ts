import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ScanAttendancePayload, ScanAttendanceResponse, useScanQR } from './useScanQR';

const payload: ScanAttendancePayload = {
  sessionId: 'session-123',
  userLocation: { latitude: 28.61, longitude: 77.2 },
  deviceId: 'device-1',
  userAgent: 'vitest-agent',
  accuracy: 12,
  timestamp: Date.now(),
};

const markedResponse: ScanAttendanceResponse = {
  status: 'MARKED',
  reason: null,
  msg: 'Attendance Marked Successfully',
  sessionName: 'Morning Session',
  className: 'Class/Batch',
  sessionDate: '2026-02-17',
  distanceMeters: 8,
};

describe('useScanQR', () => {
  it('handles loading state transitions around async scan submission', async () => {
    let resolveRequest: ((value: ScanAttendanceResponse) => void) | null = null;
    const scanAttendance = vi.fn().mockImplementation(
      () => new Promise<ScanAttendanceResponse>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const { result } = renderHook(() =>
      useScanQR({
        role: 'USER',
        scanAttendance,
        canScan: vi.fn().mockReturnValue(true),
      }),
    );

    let pendingPromise: Promise<ScanAttendanceResponse | null> | null = null;
    act(() => {
      pendingPromise = result.current.submitScan(payload);
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveRequest?.(markedResponse);
      await pendingPromise;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toEqual(markedResponse);
  });

  it('surfaces error state when scan API fails', async () => {
    const scanAttendance = vi.fn().mockRejectedValue(new Error('scan failed'));

    const { result } = renderHook(() =>
      useScanQR({
        role: 'USER',
        scanAttendance,
        canScan: vi.fn().mockReturnValue(true),
      }),
    );

    await act(async () => {
      await result.current.submitScan(payload);
    });

    expect(result.current.error).toBe('scan failed');
    expect(result.current.result).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('enforces permission gating before API call', async () => {
    const scanAttendance = vi.fn();
    const { result } = renderHook(() =>
      useScanQR({
        role: 'USER',
        scanAttendance,
        canScan: vi.fn().mockReturnValue(false),
      }),
    );

    await act(async () => {
      const response = await result.current.submitScan(payload);
      expect(response).toBeNull();
    });

    expect(scanAttendance).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Not authorized to scan attendance.');
  });

  it('computes derived success/message values from response payload', async () => {
    const scanAttendance = vi.fn().mockResolvedValue({
      ...markedResponse,
      status: 'ALREADY_MARKED',
      msg: 'Attendance was already recorded earlier.',
    } satisfies ScanAttendanceResponse);

    const { result } = renderHook(() =>
      useScanQR({
        role: 'USER',
        scanAttendance,
        canScan: vi.fn().mockReturnValue(true),
      }),
    );

    await act(async () => {
      await result.current.submitScan(payload);
    });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.message).toBe('Attendance was already recorded earlier.');
  });
});
