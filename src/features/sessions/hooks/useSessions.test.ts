import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SessionListItem, useSessions } from './useSessions';

const sessionFixtures: SessionListItem[] = [
  { _id: 's1', name: 'Live Session', status: 'live' },
  { _id: 's2', name: 'Upcoming Session', status: 'upcoming' },
  { _id: 's3', name: 'Past Session', status: 'past' },
  { _id: 's4', name: 'Cancelled Live Session', status: 'live', isCancelled: true },
];

describe('useSessions', () => {
  it('handles loading transitions when fetching session list', async () => {
    let resolveFetch: ((value: SessionListItem[]) => void) | null = null;
    const fetchSessions = vi.fn().mockImplementation(
      () => new Promise<SessionListItem[]>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { result } = renderHook(() =>
      useSessions({
        role: 'CompanyAdmin',
        fetchSessions,
        canViewSessions: vi.fn().mockReturnValue(true),
      }),
    );

    let pendingPromise: Promise<SessionListItem[]> | null = null;
    act(() => {
      pendingPromise = result.current.loadSessions();
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveFetch?.(sessionFixtures);
      await pendingPromise;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.sessions).toHaveLength(4);
  });

  it('captures API errors into hook error state', async () => {
    const fetchSessions = vi.fn().mockRejectedValue(new Error('sessions failed'));

    const { result } = renderHook(() =>
      useSessions({
        role: 'CompanyAdmin',
        fetchSessions,
        canViewSessions: vi.fn().mockReturnValue(true),
      }),
    );

    await act(async () => {
      await result.current.loadSessions();
    });

    expect(result.current.error).toBe('sessions failed');
    expect(result.current.sessions).toEqual([]);
  });

  it('applies permission gating before session fetch', async () => {
    const fetchSessions = vi.fn();

    const { result } = renderHook(() =>
      useSessions({
        role: 'EndUser',
        fetchSessions,
        canViewSessions: vi.fn().mockReturnValue(false),
      }),
    );

    await act(async () => {
      const loaded = await result.current.loadSessions();
      expect(loaded).toEqual([]);
    });

    expect(fetchSessions).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Not authorized to view sessions.');
  });

  it('computes derived session summary and active filtering', async () => {
    const fetchSessions = vi.fn().mockResolvedValue(sessionFixtures);

    const { result } = renderHook(() =>
      useSessions({
        role: 'COMPANY_ADMIN',
        fetchSessions,
        canViewSessions: vi.fn().mockReturnValue(true),
      }),
    );

    await act(async () => {
      await result.current.loadSessions();
    });

    expect(result.current.activeSessions.map((entry) => entry._id)).toEqual(['s1', 's2']);
    expect(result.current.summary).toEqual({
      total: 4,
      active: 2,
      live: 2,
      past: 1,
    });
    expect(result.current.canManageSessions).toBe(true);
  });
});
