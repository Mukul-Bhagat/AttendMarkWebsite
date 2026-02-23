export type SessionMode = 'PHYSICAL' | 'REMOTE' | 'HYBRID';

const MODE_ALIASES: Record<string, SessionMode> = {
  PHYSICAL: 'PHYSICAL',
  REMOTE: 'REMOTE',
  HYBRID: 'HYBRID',
  VIRTUAL: 'REMOTE',
  ONLINE: 'REMOTE',
  INPERSON: 'PHYSICAL',
  IN_PERSON: 'PHYSICAL',
  ONSITE: 'PHYSICAL',
  ON_SITE: 'PHYSICAL',
};

export const normalizeSessionMode = (value?: string | null): SessionMode => {
  if (!value) return 'PHYSICAL';
  const normalized = value.toString().trim().toUpperCase();
  return MODE_ALIASES[normalized] || 'PHYSICAL';
};
