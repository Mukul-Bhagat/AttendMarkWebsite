import { describe, expect, it } from 'vitest';

import {
  BUSINESS_TIMEZONE,
  IST_OFFSET_MS,
  isSameISTDay,
  istDayEnd,
  istDayStart,
  nowIST,
  sessionTimeToIST,
  toISTDateString,
} from './time';

describe('time utilities', () => {
  it('exposes expected constants', () => {
    expect(IST_OFFSET_MS).toBe(19800000);
    expect(BUSINESS_TIMEZONE).toBe('Asia/Kolkata');
  });

  it('returns a recent timestamp from nowIST', () => {
    const before = Date.now();
    const now = nowIST();
    const after = Date.now();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });

  it('calculates IST day boundaries correctly', () => {
    const start = istDayStart('2026-01-07');
    const end = istDayEnd('2026-01-07');

    expect(new Date(start).toISOString()).toBe('2026-01-06T18:30:00.000Z');
    expect(end - start).toBe((24 * 60 * 60 * 1000) - 1);
  });

  it('converts session date + IST time into UTC timestamp', () => {
    const ts = sessionTimeToIST('2026-01-07T00:00:00.000Z', '11:00');
    expect(new Date(ts).toISOString()).toBe('2026-01-07T05:30:00.000Z');
  });

  it('checks same IST day accurately across UTC boundaries', () => {
    const a = new Date('2026-01-06T20:00:00.000Z').getTime();
    const b = new Date('2026-01-07T18:00:00.000Z').getTime();
    const c = new Date('2026-01-07T19:00:00.000Z').getTime();

    expect(isSameISTDay(a, b)).toBe(true);
    expect(isSameISTDay(a, c)).toBe(false);
    expect(toISTDateString(a)).toBe('2026-01-07');
  });
});
