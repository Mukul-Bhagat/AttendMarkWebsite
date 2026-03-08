import React, { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../api';

type FirebaseStatus = {
  firebaseConnected: boolean;
  messagingReady: boolean;
  initialized: boolean;
  projectId: string | null;
  credentialSource: string;
  credentialPath: string | null;
  credentialConfigured: boolean;
  error: string | null;
};

type RedisStatus = {
  redisConnected: boolean;
  status: string;
  latencyMs: number | null;
  error: string | null;
};

type DeviceTokenStatus = {
  success: boolean;
  tokens: {
    total: number;
    active: number;
    inactive: number;
    activeByPlatform: Record<string, number>;
  };
};

type NotificationHealth = {
  redis: boolean;
  workerRunning: boolean;
  firebaseConnected: boolean;
  tokensRegistered: number;
  queueBacklog: number;
  failedJobs: number;
  timestamp: string;
};

const DiagnosticsCard: React.FC<{
  title: string;
  loading: boolean;
  error?: string | null;
  children: React.ReactNode;
}> = ({ title, loading, error, children }) => {
  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        {loading ? (
          <span className="text-xs text-gray-500 dark:text-gray-400">Loading...</span>
        ) : null}
      </div>

      {error ? (
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      ) : (
        children
      )}
    </section>
  );
};

const ValueRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 dark:border-slate-700 last:border-b-0">
    <span className="text-gray-600 dark:text-gray-300">{label}</span>
    <span className="font-medium text-gray-900 dark:text-white">{value}</span>
  </div>
);

const NotificationSystemDiagnostics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseStatus | null>(null);
  const [redisStatus, setRedisStatus] = useState<RedisStatus | null>(null);
  const [tokenStatus, setTokenStatus] = useState<DeviceTokenStatus | null>(null);
  const [healthStatus, setHealthStatus] = useState<NotificationHealth | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [testResult, setTestResult] = useState<string>('');

  const fetchDiagnostics = useCallback(async () => {
    setLoading(true);
    setErrors({});

    const [firebaseRes, redisRes, tokenRes, healthRes] = await Promise.allSettled([
      api.get('/api/system/firebase-status'),
      api.get('/api/system/redis-status'),
      api.get('/api/system/device-tokens'),
      api.get('/api/system/notification-health'),
    ]);

    const nextErrors: Record<string, string | null> = {
      firebase: null,
      redis: null,
      tokens: null,
      health: null,
    };

    if (firebaseRes.status === 'fulfilled') {
      setFirebaseStatus(firebaseRes.value.data as FirebaseStatus);
    } else {
      nextErrors.firebase =
        firebaseRes.reason?.response?.data?.error ||
        firebaseRes.reason?.message ||
        'Failed to fetch Firebase status';
      setFirebaseStatus(null);
    }

    if (redisRes.status === 'fulfilled') {
      setRedisStatus(redisRes.value.data as RedisStatus);
    } else {
      nextErrors.redis =
        redisRes.reason?.response?.data?.error ||
        redisRes.reason?.message ||
        'Failed to fetch Redis status';
      setRedisStatus(null);
    }

    if (tokenRes.status === 'fulfilled') {
      setTokenStatus(tokenRes.value.data as DeviceTokenStatus);
    } else {
      nextErrors.tokens =
        tokenRes.reason?.response?.data?.error ||
        tokenRes.reason?.message ||
        'Failed to fetch token status';
      setTokenStatus(null);
    }

    if (healthRes.status === 'fulfilled') {
      setHealthStatus(healthRes.value.data as NotificationHealth);
    } else {
      nextErrors.health =
        healthRes.reason?.response?.data?.error ||
        healthRes.reason?.message ||
        'Failed to fetch health status';
      setHealthStatus(null);
    }

    setErrors(nextErrors);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchDiagnostics();
  }, [fetchDiagnostics]);

  const handleTestNotification = async () => {
    setSubmitting(true);
    setTestResult('');

    try {
      const response = await api.post('/api/system/test-notification', {
        title: 'System Diagnostics Test',
        body: 'This notification was queued from the diagnostics dashboard.',
      });

      setTestResult(
        `Queued successfully. Job ID: ${response.data?.jobId || 'unknown'} | Event ID: ${
          response.data?.eventId || 'unknown'
        }`,
      );

      await fetchDiagnostics();
    } catch (error: any) {
      setTestResult(
        error?.response?.data?.message ||
          error?.message ||
          'Failed to queue test notification',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const platformRows = useMemo(() => {
    const source = tokenStatus?.tokens?.activeByPlatform || {};
    return Object.entries(source);
  }, [tokenStatus]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Notification System Diagnostics
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Live status for Firebase, Redis, queue worker, and device token registration.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void fetchDiagnostics()}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700"
              disabled={loading}
            >
              Refresh
            </button>
            <button
              onClick={handleTestNotification}
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? 'Queueing...' : 'Send Test Notification'}
            </button>
          </div>
        </div>

        {testResult ? (
          <div className="text-sm px-4 py-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200">
            {testResult}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <DiagnosticsCard
            title="Notification Health"
            loading={loading}
            error={errors.health}
          >
            <ValueRow label="Redis" value={healthStatus?.redis ? 'Healthy' : 'Unhealthy'} />
            <ValueRow
              label="Worker"
              value={healthStatus?.workerRunning ? 'Running' : 'Not running'}
            />
            <ValueRow
              label="Firebase"
              value={healthStatus?.firebaseConnected ? 'Connected' : 'Disconnected'}
            />
            <ValueRow label="Active Tokens" value={healthStatus?.tokensRegistered ?? 0} />
            <ValueRow label="Queue Backlog" value={healthStatus?.queueBacklog ?? 0} />
            <ValueRow label="Failed Jobs" value={healthStatus?.failedJobs ?? 0} />
          </DiagnosticsCard>

          <DiagnosticsCard
            title="Firebase Status"
            loading={loading}
            error={errors.firebase}
          >
            <ValueRow
              label="Connection"
              value={firebaseStatus?.firebaseConnected ? 'Connected' : 'Disconnected'}
            />
            <ValueRow
              label="Messaging"
              value={firebaseStatus?.messagingReady ? 'Ready' : 'Not ready'}
            />
            <ValueRow label="Project" value={firebaseStatus?.projectId || 'N/A'} />
            <ValueRow
              label="Credential Source"
              value={firebaseStatus?.credentialSource || 'N/A'}
            />
            <ValueRow
              label="Configured"
              value={firebaseStatus?.credentialConfigured ? 'Yes' : 'No'}
            />
            <ValueRow label="Error" value={firebaseStatus?.error || 'None'} />
          </DiagnosticsCard>

          <DiagnosticsCard title="Redis Status" loading={loading} error={errors.redis}>
            <ValueRow
              label="Connection"
              value={redisStatus?.redisConnected ? 'Connected' : 'Disconnected'}
            />
            <ValueRow label="State" value={redisStatus?.status || 'unknown'} />
            <ValueRow
              label="Latency"
              value={
                redisStatus?.latencyMs !== null && redisStatus?.latencyMs !== undefined
                  ? `${redisStatus.latencyMs} ms`
                  : 'N/A'
              }
            />
            <ValueRow label="Error" value={redisStatus?.error || 'None'} />
          </DiagnosticsCard>

          <DiagnosticsCard
            title="Device Token Inventory"
            loading={loading}
            error={errors.tokens}
          >
            <ValueRow label="Total" value={tokenStatus?.tokens?.total ?? 0} />
            <ValueRow label="Active" value={tokenStatus?.tokens?.active ?? 0} />
            <ValueRow label="Inactive" value={tokenStatus?.tokens?.inactive ?? 0} />
            {platformRows.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 py-2">
                No active platform tokens.
              </div>
            ) : (
              platformRows.map(([platform, count]) => (
                <ValueRow key={platform} label={`Active (${platform})`} value={count} />
              ))
            )}
          </DiagnosticsCard>
        </div>
      </div>
    </div>
  );
};

export default NotificationSystemDiagnostics;
