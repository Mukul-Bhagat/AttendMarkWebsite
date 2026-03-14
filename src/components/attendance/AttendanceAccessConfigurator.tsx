import React from 'react';
import { motion } from 'framer-motion';
import { Camera, Check, ScanLine, Sparkles, Smartphone, Globe } from 'lucide-react';

import { AttendanceChannel, AttendanceMethod, IAttendanceAccess } from '../../types';
import { getAttendanceMethodLabel, normalizeAttendanceAccess } from '../../utils/attendanceAccess';

interface AttendanceAccessConfiguratorProps {
  value: IAttendanceAccess;
  onChange: (next: IAttendanceAccess) => void;
  title?: string;
  description?: string;
  compact?: boolean;
}

type MethodCardConfig = {
  method: AttendanceMethod;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  colorClass: string;
};

const methodCards: MethodCardConfig[] = [
  {
    method: 'QR',
    title: 'QR Check-In',
    subtitle: 'Scan a secure session QR before marking attendance.',
    icon: <ScanLine className="h-5 w-5" />,
    colorClass: 'from-orange-500/15 to-red-500/10 border-orange-200/80',
  },
  {
    method: 'ONE_TAP',
    title: 'One-Tap Check-In',
    subtitle: 'Use the same validation pipeline without opening the scanner.',
    icon: <Camera className="h-5 w-5" />,
    colorClass: 'from-emerald-500/15 to-cyan-500/10 border-emerald-200/80',
  },
  {
    method: 'FACE_VERIFY',
    title: 'Face Verify',
    subtitle: 'Reserved for app-based biometric validation in a later rollout.',
    icon: <Sparkles className="h-5 w-5" />,
    colorClass: 'from-sky-500/15 to-indigo-500/10 border-sky-200/80',
  },
];

const cloneChannels = (channels: AttendanceChannel[]) => [...channels];

const channelPill = (channel: AttendanceChannel) => {
  if (channel === 'APP') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-300/70 bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-700">
        <Smartphone className="h-3.5 w-3.5" />
        App
      </span>
    );
  }

  if (channel === 'WEB') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-300/70 bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-700">
        <Globe className="h-3.5 w-3.5" />
        Web
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-300/70 bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {channel}
    </span>
  );
};

const AttendanceAccessConfigurator: React.FC<AttendanceAccessConfiguratorProps> = ({
  value,
  onChange,
  title = 'Attendance Access',
  description = 'Choose which self-service attendance methods students can use for this session.',
  compact = false,
}) => {
  const attendanceAccess = normalizeAttendanceAccess(value);

  const updateMethodEnabled = (method: AttendanceMethod, enabled: boolean) => {
    const next = normalizeAttendanceAccess(attendanceAccess);
    if (method === 'QR') {
      next.qr.enabled = enabled;
    } else if (method === 'ONE_TAP') {
      next.oneTap.enabled = enabled;
    } else {
      next.faceVerify.enabled = enabled;
    }

    const stillValidDefault =
      (next.defaultMethod === 'QR' && next.qr.enabled)
      || (next.defaultMethod === 'ONE_TAP' && next.oneTap.enabled)
      || (next.defaultMethod === 'FACE_VERIFY' && next.faceVerify.enabled);
    if (!stillValidDefault) {
      next.defaultMethod = next.qr.enabled
        ? 'QR'
        : next.oneTap.enabled
          ? 'ONE_TAP'
          : 'FACE_VERIFY';
    }

    onChange(next);
  };

  const updateMethodChannels = (method: AttendanceMethod, channel: AttendanceChannel, enabled: boolean) => {
    const next = normalizeAttendanceAccess(attendanceAccess);
    if (method === 'FACE_VERIFY') {
      next.faceVerify.channels = enabled ? ['APP'] : [];
      onChange(next);
      return;
    }

    const currentChannels = method === 'QR' ? cloneChannels(next.qr.channels) : cloneChannels(next.oneTap.channels);
    const nextChannels = enabled
      ? Array.from(new Set([...currentChannels, channel]))
      : currentChannels.filter((entry) => entry !== channel);

    if (method === 'QR') {
      next.qr.channels = nextChannels;
    } else {
      next.oneTap.channels = nextChannels;
    }
    onChange(next);
  };

  const renderCard = (card: MethodCardConfig) => {
    const isFaceVerify = card.method === 'FACE_VERIFY';
    const methodState = card.method === 'QR'
      ? attendanceAccess.qr
      : card.method === 'ONE_TAP'
        ? attendanceAccess.oneTap
        : attendanceAccess.faceVerify;
    const isDefault = attendanceAccess.defaultMethod === card.method;

    return (
      <motion.div
        key={card.method}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
        className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br ${card.colorClass} from-white to-slate-50 p-5 shadow-sm`}
      >
        <div className="absolute right-4 top-4">
          {isFaceVerify && (
            <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
              Coming Soon
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
              {card.icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{card.title}</h3>
              <p className="mt-1 max-w-sm text-sm leading-6 text-slate-600">{card.subtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => updateMethodEnabled(card.method, !methodState.enabled)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              methodState.enabled ? 'bg-slate-900' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                methodState.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {isFaceVerify ? (
            channelPill('APP')
          ) : (
            <>
              <button
                type="button"
                onClick={() => updateMethodChannels(card.method, 'APP', !methodState.channels.includes('APP'))}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  methodState.channels.includes('APP')
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                App
              </button>
              <button
                type="button"
                onClick={() => updateMethodChannels(card.method, 'WEB', !methodState.channels.includes('WEB'))}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  methodState.channels.includes('WEB')
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                Web
              </button>
            </>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Default Action</p>
            <p className="mt-1 text-sm text-slate-700">{getAttendanceMethodLabel(card.method)}</p>
          </div>
          <button
            type="button"
            disabled={!methodState.enabled}
            onClick={() => onChange({ ...attendanceAccess, defaultMethod: card.method })}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              isDefault
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50'
            }`}
          >
            {isDefault && <Check className="h-4 w-4" />}
            {isDefault ? 'Default' : 'Make default'}
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <section className={`${compact ? 'space-y-4' : 'space-y-5'} rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(255,237,213,0.8),_rgba(255,255,255,0.96)_42%,_rgba(240,249,255,0.9)_100%)] p-6 shadow-sm`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Adaptive Attendance Modes</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>

      <div className={`grid gap-4 ${compact ? 'lg:grid-cols-1' : 'lg:grid-cols-3'}`}>
        {methodCards.map(renderCard)}
      </div>
    </section>
  );
};

export default AttendanceAccessConfigurator;
