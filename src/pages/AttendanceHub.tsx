import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Compass,
  MapPin,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';

import api from '../api';
import { FullScreenAnimation } from '../components/FullScreenAnimation';
import ModeBadge from '../components/ModeBadge';
import { ISession, IAttendanceAccess, AttendanceMethod } from '../types';
import { getOrCreateDeviceId } from '../utils/deviceId';
import { normalizeAttendanceAccess } from '../utils/attendanceAccess';
import { normalizeSessionMode } from '../utils/sessionMode';

type AttendanceHubResponse = {
  session: ISession;
  attendanceSessionId?: string | null;
  attendanceAccess?: IAttendanceAccess;
  availableMethods?: AttendanceMethod[];
  requirements?: string[];
  alreadyMarked?: boolean;
  markedVia?: string | null;
};

type MarkResponse = {
  status: 'MARKED' | 'ALREADY_MARKED' | 'FAILED';
  attemptLogId?: string;
  msg?: string;
  reason?: string | null;
  className?: string;
  sessionName?: string;
  sessionDate?: string;
  organizationName?: string;
  attendanceStatus?: string;
  checkInTime?: string;
  markedVia?: string;
};

const withAttemptLog = (message: string, attemptLogId?: string) =>
  attemptLogId ? `${message} (Attempt Log: ${attemptLogId})` : message;

const locationReasons = new Set([
  'LOCATION_REQUIRED',
  'ACCURACY_REQUIRED',
  'INVALID_LOCATION_COORDS',
  'INVALID_LOCATION_ZERO',
  'INVALID_COORDINATES',
  'INVALID_ACCURACY',
  'INVALID_ACCURACY_RANGE',
]);

const AttendanceHub: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: paramId } = useParams<{ id: string }>();
  const id = (paramId || '').includes('_') ? (paramId || '').split('_')[0] : paramId || '';

  const [session, setSession] = useState<ISession | null>(null);
  const [attendanceSessionId, setAttendanceSessionId] = useState<string | null>(null);
  const [availableMethods, setAvailableMethods] = useState<AttendanceMethod[]>([]);
  const [requirements, setRequirements] = useState<string[]>([]);
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const [markedVia, setMarkedVia] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState<AttendanceMethod | null>(null);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState<MarkResponse | null>(null);

  const fetchSessionDetails = async () => {
    if (!id) {
      setError('Invalid session.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const query = new URLSearchParams(location.search);
      const dateParam = query.get('date');
      const requestUrl = dateParam
        ? `/api/sessions/${id}/details?date=${encodeURIComponent(dateParam)}`
        : `/api/sessions/${id}/details`;
      const { data } = await api.get<AttendanceHubResponse>(requestUrl);
      setSession(data.session);
      setAttendanceSessionId(data.attendanceSessionId || data.session.attendanceSessionId || null);
      setAvailableMethods(data.availableMethods || data.session.availableMethods || []);
      setRequirements(data.requirements || data.session.requirements || []);
      setAlreadyMarked(Boolean(data.alreadyMarked ?? data.session.alreadyMarked));
      setMarkedVia(data.markedVia ?? data.session.markedVia ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.msg || 'Failed to load attendance hub.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionDetails();
  }, [id, location.search]);

  const attendanceAccess = useMemo(
    () => normalizeAttendanceAccess(session?.attendanceAccess),
    [session?.attendanceAccess],
  );

  const sessionMode = normalizeSessionMode(session?.sessionType || 'PHYSICAL');
  const channel = 'WEB';
  const hasServerAvailableMethods = availableMethods.length > 0;

  const isMethodEnabled = useCallback((method: AttendanceMethod): boolean => {
    if (hasServerAvailableMethods) {
      return availableMethods.includes(method);
    }

    if (method === 'QR') {
      return attendanceAccess.qr.enabled && attendanceAccess.qr.channels.includes(channel);
    }

    if (method === 'ONE_TAP') {
      return attendanceAccess.oneTap.enabled && attendanceAccess.oneTap.channels.includes(channel);
    }

    return attendanceAccess.faceVerify.enabled && attendanceAccess.faceVerify.channels.includes(channel);
  }, [attendanceAccess, availableMethods, hasServerAvailableMethods]);

  const actionCards = useMemo(() => {
    const cards: Array<{
      method: AttendanceMethod;
      title: string;
      body: string;
      icon: React.ReactNode;
      enabled: boolean;
      actionLabel: string;
      helper: string;
      accent: string;
    }> = [];

    if (isMethodEnabled('QR')) {
      cards.push({
        method: 'QR',
        title: 'QR Check-In',
        body: 'Open the scanner and verify the session QR code in real time.',
        icon: <ScanLine className="h-6 w-6" />,
        enabled: true,
        actionLabel: 'Open Scanner',
        helper: 'Camera, device, location, and timing checks apply automatically.',
        accent: 'from-orange-500 to-rose-500',
      });
    }

    if (isMethodEnabled('ONE_TAP')) {
      cards.push({
        method: 'ONE_TAP',
        title: 'One-Tap Check-In',
        body: 'Mark attendance directly from this session using the same security pipeline.',
        icon: <CheckCircle2 className="h-6 w-6" />,
        enabled: true,
        actionLabel: 'Mark Attendance',
        helper: 'Uses the shared device, location, enrollment, and duplicate checks.',
        accent: 'from-emerald-500 to-cyan-500',
      });
    }

    if (attendanceAccess.faceVerify.enabled) {
      cards.push({
        method: 'FACE_VERIFY',
        title: 'Face Verify',
        body: 'Planned for the mobile app. The session is already configured for this future mode.',
        icon: <Sparkles className="h-6 w-6" />,
        enabled: false,
        actionLabel: 'Available In App',
        helper: 'Face Verify is modeled now, but web marking stays disabled in v1.',
        accent: 'from-sky-500 to-indigo-500',
      });
    }

    return cards;
  }, [attendanceAccess, isMethodEnabled]);

  const requestBrowserLocation = () =>
    new Promise<{ userLocation: { latitude: number; longitude: number }; accuracy: number }>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            userLocation: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
            accuracy: position.coords.accuracy,
          });
        },
        (geoError) => reject(new Error(geoError.message || 'Unable to access location.')),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        },
      );
    });

  const handleOneTapMark = async () => {
    if (!session) {
      return;
    }

    const targetSessionId = attendanceSessionId || session._id;
    setIsSubmitting('ONE_TAP');
    setError('');

    const basePayload = {
      sessionId: targetSessionId,
      markingMethod: 'ONE_TAP' as const,
      markingChannel: 'WEB' as const,
      deviceId: getOrCreateDeviceId(),
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    };

    const submit = async (payload: Record<string, unknown>) => {
      const { data } = await api.post<MarkResponse>('/api/attendance/mark', payload);
      return data;
    };

    try {
      let response = await submit(basePayload);

      if (response.reason && locationReasons.has(response.reason)) {
        const locationPayload = await requestBrowserLocation();
        response = await submit({
          ...basePayload,
          ...locationPayload,
        });
      }

      if (response.status === 'MARKED' || response.status === 'ALREADY_MARKED') {
        setSuccessData(response);
        await fetchSessionDetails();
        return;
      }

      setError(withAttemptLog(response.msg || 'Attendance could not be marked.', response.attemptLogId));
    } catch (err: any) {
      const reason = err?.response?.data?.reason;
      if (locationReasons.has(reason)) {
        try {
          const locationPayload = await requestBrowserLocation();
          const response = await submit({
            ...basePayload,
            ...locationPayload,
          });

          if (response.status === 'FAILED') {
            setError(withAttemptLog(response.msg || 'Attendance could not be marked.', response.attemptLogId));
            return;
          }

          setSuccessData(response);
          await fetchSessionDetails();
          return;
        } catch (locationError: any) {
          setError(locationError?.message || 'Location is required to mark attendance.');
          return;
        }
      }

      setError(err?.response?.data?.msg || 'Unable to mark attendance right now.');
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleQrFlow = () => {
    const query = attendanceSessionId ? `?sessionId=${encodeURIComponent(attendanceSessionId)}` : '';
    navigate(`/scan-web${query}`);
  };

  if (successData) {
    return (
      <>
        <FullScreenAnimation
          src="/animations/success.lottie"
          title={successData.status === 'ALREADY_MARKED' ? 'Attendance Already Recorded' : 'Attendance Marked'}
          description={[
            successData.msg || 'Attendance confirmed.',
            successData.attemptLogId ? `Attempt Log: ${successData.attemptLogId}` : '',
            successData.className ? `Class: ${successData.className}` : '',
            successData.sessionName ? `Session: ${successData.sessionName}` : '',
            successData.sessionDate ? `Date: ${successData.sessionDate}` : '',
            successData.attendanceStatus ? `Status: ${successData.attendanceStatus}` : '',
            successData.markedVia ? `Marked via: ${successData.markedVia}` : '',
          ].filter(Boolean).join('\n')}
          loop={false}
        />
        <div className="fixed inset-x-0 bottom-8 z-[60] flex justify-center gap-3 px-4">
          <button
            type="button"
            onClick={() => setSuccessData(null)}
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-lg transition hover:border-slate-300"
          >
            Back To Session
          </button>
          <button
            type="button"
            onClick={() => navigate('/my-attendance')}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-700"
          >
            Open My Attendance
          </button>
        </div>
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[70vh] rounded-[32px] border border-slate-200 bg-white/70 p-8 shadow-sm">
        <div className="animate-pulse space-y-6">
          <div className="h-6 w-40 rounded-full bg-slate-200" />
          <div className="h-16 rounded-3xl bg-slate-200" />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="h-56 rounded-3xl bg-slate-200" />
            <div className="h-56 rounded-3xl bg-slate-200" />
            <div className="h-56 rounded-3xl bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="rounded-[32px] border border-rose-200 bg-rose-50 p-8 text-rose-700 shadow-sm">
        {error || 'Session not found.'}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Mark Attendance Hub</p>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-[36px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(255,237,213,0.85),_rgba(255,255,255,0.97)_38%,_rgba(239,246,255,0.96)_100%)] shadow-sm"
      >
        <div className="grid gap-6 p-6 lg:grid-cols-[1.5fr,0.9fr] lg:p-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              Adaptive Attendance Modes
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{session.name}</h1>
              {session.description && (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{session.description}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <ModeBadge mode={sessionMode} size="md" />
              {alreadyMarked && markedVia && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Already marked via {markedVia}
                </span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Session Date</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {session.occurrenceDate || new Date(session.startDate).toLocaleDateString()}
                </p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Time Window</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {session.startTime} to {session.endTime}
                </p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Attendance State</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {session.isCancelled ? 'Cancelled' : alreadyMarked ? 'Recorded' : 'Ready'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Session Requirements</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {requirements.map((requirement) => (
                <span
                  key={requirement}
                  className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90"
                >
                  {requirement}
                </span>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-orange-300" />
                  <div>
                    <p className="text-sm font-semibold">Location & timing checks</p>
                    <p className="mt-1 text-xs leading-5 text-slate-300">
                      The same attendance policy runs for QR and one-tap marking, including location and device checks.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  <Compass className="h-5 w-5 text-sky-300" />
                  <div>
                    <p className="text-sm font-semibold">Channel-aware access</p>
                    <p className="mt-1 text-xs leading-5 text-slate-300">
                      Available methods are filtered for web automatically. App-only methods stay visible as future-ready options.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        {actionCards.map((card, index) => (
          <motion.article
            key={card.method}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, delay: 0.06 * index, ease: 'easeOut' }}
            className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm"
          >
            <div className={`h-2 bg-gradient-to-r ${card.accent}`} />
            <div className="space-y-5 p-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg">
                {card.icon}
              </div>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-slate-900">{card.title}</h2>
                  {card.method === attendanceAccess.defaultMethod && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                      Default
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                {card.helper}
              </div>

              <button
                type="button"
                disabled={!card.enabled || Boolean(isSubmitting) || (alreadyMarked && card.method !== 'QR')}
                onClick={() => {
                  if (card.method === 'QR') {
                    handleQrFlow();
                    return;
                  }
                  if (card.method === 'ONE_TAP') {
                    handleOneTapMark();
                    return;
                  }
                }}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  card.enabled
                    ? 'bg-slate-950 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50'
                    : 'cursor-not-allowed bg-slate-100 text-slate-400'
                }`}
              >
                {card.method === 'QR' && <ScanLine className="h-4 w-4" />}
                {card.method === 'ONE_TAP' && <CheckCircle2 className="h-4 w-4" />}
                {card.method === 'FACE_VERIFY' && <Smartphone className="h-4 w-4" />}
                {isSubmitting === card.method ? 'Validating...' : card.actionLabel}
              </button>
            </div>
          </motion.article>
        ))}
      </section>

      {actionCards.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
          No attendance methods are currently available for web on this session. Use the mobile app or contact your administrator.
        </div>
      )}

      {alreadyMarked && markedVia && (
        <div className="rounded-[30px] border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Attendance Recorded</p>
          <h3 className="mt-2 text-2xl font-semibold text-emerald-900">{markedVia}</h3>
          <p className="mt-2 text-sm leading-6 text-emerald-800">
            This session has already been marked. Reports and My Attendance will reflect the recorded method automatically.
          </p>
        </div>
      )}
    </div>
  );
};

export default AttendanceHub;
