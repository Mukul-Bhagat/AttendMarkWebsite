import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FullScreenAnimation } from '../FullScreenAnimation';

vi.mock('@lottiefiles/dotlottie-react', () => ({
  DotLottieReact: () => <div data-testid="lottie-mock" />,
}));

describe('FullScreenAnimation timeline reveal flow', () => {
  it('reveals steps one-by-one and stops reveal at failed step before completion', () => {
    vi.useFakeTimers();
    const onSequenceComplete = vi.fn();
    const primaryAction = vi.fn();

    render(
      <FullScreenAnimation
        src="/animations/warning.lottie"
        title="Scan Failed"
        description="Failure"
        timeline={[
          { key: 'qr', label: 'QR Validation', status: 'passed', detail: 'ok' },
          { key: 'device', label: 'Device Check', status: 'failed', detail: 'mismatch' },
          { key: 'location', label: 'Location Gate', status: 'pending', detail: 'not reached' },
        ]}
        onSequenceComplete={onSequenceComplete}
        primaryAction={{ label: 'Retry', onClick: primaryAction }}
      />,
    );

    expect(screen.queryByText('QR Validation')).toBeNull();
    expect(screen.queryByText('Device Check')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.getByText('QR Validation')).toBeTruthy();
    expect(screen.queryByText('Device Check')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.getByText('Device Check')).toBeTruthy();
    expect(screen.queryByText('Location Gate')).toBeNull();
    expect(onSequenceComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1800);
    });
    expect(onSequenceComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Location Gate')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    vi.useRealTimers();
  });

  it('uses deterministic timing for full success timeline', () => {
    vi.useFakeTimers();
    const onSequenceComplete = vi.fn();

    render(
      <FullScreenAnimation
        src="/animations/success.lottie"
        title="Success"
        description="Done"
        timeline={[
          { key: 'qr', label: 'QR Validation', status: 'passed', detail: 'ok' },
          { key: 'device', label: 'Device Check', status: 'passed', detail: 'ok' },
          { key: 'location', label: 'Location Gate', status: 'passed', detail: 'ok' },
          { key: 'time', label: 'Date/Time Window', status: 'passed', detail: 'ok' },
          { key: 'write', label: 'Attendance Write', status: 'passed', detail: 'ok' },
        ]}
        onSequenceComplete={onSequenceComplete}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(3499);
    });
    expect(onSequenceComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1 + 1800);
    });
    expect(onSequenceComplete).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
