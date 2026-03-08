import {
  AttendanceChannel,
  AttendanceMethod,
  IAttendanceAccess,
} from '../types';

const normalizeChannels = (
  channels: AttendanceChannel[] | undefined,
  fallback: AttendanceChannel[],
): AttendanceChannel[] => {
  if (!Array.isArray(channels) || channels.length === 0) {
    return fallback;
  }

  return Array.from(
    new Set(
      channels.filter((channel): channel is AttendanceChannel =>
        channel === 'APP' || channel === 'WEB' || channel === 'ADMIN',
      ),
    ),
  );
};

export const createDefaultAttendanceAccess = (): IAttendanceAccess => ({
  qr: {
    enabled: true,
    channels: ['APP', 'WEB'],
  },
  oneTap: {
    enabled: false,
    channels: ['APP', 'WEB'],
  },
  faceVerify: {
    enabled: false,
    channels: ['APP'],
    readiness: 'PLANNED',
  },
  defaultMethod: 'QR',
  allowLiveMethodSwitch: true,
});

export const normalizeAttendanceAccess = (
  input?: Partial<IAttendanceAccess> | null,
): IAttendanceAccess => {
  const fallback = createDefaultAttendanceAccess();
  if (!input) {
    return fallback;
  }

  const defaultMethod = input.defaultMethod || fallback.defaultMethod;
  return {
    qr: {
      enabled: input.qr?.enabled ?? fallback.qr.enabled,
      channels: normalizeChannels(input.qr?.channels, fallback.qr.channels),
    },
    oneTap: {
      enabled: input.oneTap?.enabled ?? fallback.oneTap.enabled,
      channels: normalizeChannels(input.oneTap?.channels, fallback.oneTap.channels),
    },
    faceVerify: {
      enabled: input.faceVerify?.enabled ?? fallback.faceVerify.enabled,
      channels: normalizeChannels(input.faceVerify?.channels, fallback.faceVerify.channels).filter(
        (channel) => channel === 'APP',
      ),
      readiness: input.faceVerify?.readiness === 'ACTIVE' ? 'ACTIVE' : 'PLANNED',
    },
    defaultMethod:
      defaultMethod === 'ONE_TAP' || defaultMethod === 'FACE_VERIFY' || defaultMethod === 'QR'
        ? defaultMethod
        : fallback.defaultMethod,
    allowLiveMethodSwitch: input.allowLiveMethodSwitch ?? fallback.allowLiveMethodSwitch,
  };
};

export const getAvailableAttendanceMethods = (
  access: IAttendanceAccess,
  channel: AttendanceChannel,
): AttendanceMethod[] => {
  const methods: AttendanceMethod[] = [];
  if (access.qr.enabled && access.qr.channels.includes(channel)) {
    methods.push('QR');
  }
  if (access.oneTap.enabled && access.oneTap.channels.includes(channel)) {
    methods.push('ONE_TAP');
  }
  if (access.faceVerify.enabled && access.faceVerify.channels.includes(channel)) {
    methods.push('FACE_VERIFY');
  }
  return methods;
};

export const getAttendanceMethodLabel = (method: AttendanceMethod): string => {
  if (method === 'ONE_TAP') {
    return 'One-Tap Check-In';
  }
  if (method === 'FACE_VERIFY') {
    return 'Face Verify';
  }
  return 'QR Check-In';
};
