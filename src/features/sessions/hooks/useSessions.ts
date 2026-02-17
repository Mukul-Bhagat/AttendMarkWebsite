import { useCallback, useMemo, useState } from 'react';

import api from '../../../api';
import { normalizeRole, Role } from '../../../shared/roles';

export type SessionListStatus = 'live' | 'upcoming' | 'past';

export interface SessionListItem {
  _id: string;
  name: string;
  status: SessionListStatus;
  isCancelled?: boolean;
}

type FetchSessionsFn = () => Promise<SessionListItem[]>;
type CanViewSessionsFn = (role: string) => boolean;

const defaultCanViewSessions: CanViewSessionsFn = (role: string) => {
  try {
    const canonicalRole = normalizeRole(role);
    return [
      Role.PLATFORM_OWNER,
      Role.COMPANY_ADMIN,
      Role.STAFF,
      Role.USER,
    ].includes(canonicalRole);
  } catch {
    return false;
  }
};

const defaultFetchSessions: FetchSessionsFn = async () => {
  const { data } = await api.get('/api/sessions');
  if (!Array.isArray(data)) {
    return [];
  }
  return data as SessionListItem[];
};

export interface UseSessionsOptions {
  role: string;
  fetchSessions?: FetchSessionsFn;
  canViewSessions?: CanViewSessionsFn;
}

export const useSessions = ({
  role,
  fetchSessions = defaultFetchSessions,
  canViewSessions = defaultCanViewSessions,
}: UseSessionsOptions) => {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async (): Promise<SessionListItem[]> => {
    if (!canViewSessions(role)) {
      setSessions([]);
      setError('Not authorized to view sessions.');
      return [];
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSessions();
      setSessions(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load sessions';
      setError(message);
      setSessions([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [canViewSessions, fetchSessions, role]);

  const activeSessions = useMemo(
    () => sessions.filter((entry) => !entry.isCancelled && entry.status !== 'past'),
    [sessions],
  );

  const summary = useMemo(() => ({
    total: sessions.length,
    active: activeSessions.length,
    live: sessions.filter((entry) => entry.status === 'live').length,
    past: sessions.filter((entry) => entry.status === 'past').length,
  }), [activeSessions.length, sessions]);

  const canManageSessions = useMemo(() => {
    try {
      const canonicalRole = normalizeRole(role);
      return canonicalRole === Role.PLATFORM_OWNER || canonicalRole === Role.COMPANY_ADMIN;
    } catch {
      return false;
    }
  }, [role]);

  return {
    sessions,
    activeSessions,
    summary,
    isLoading,
    error,
    canManageSessions,
    loadSessions,
  };
};

export default useSessions;
