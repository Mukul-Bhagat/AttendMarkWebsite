// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import SessionOverride from '../SessionOverride';
import api from '../../api';

vi.mock('../../api', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../../components/GoogleMapPicker', () => ({
  default: () => null,
}));

const mockSessionResponse = {
  data: {
    session: {
      _id: 'session-1',
      name: 'Session - 2026-02-23',
      description: '',
      frequency: 'OneTime',
      startDate: '2026-02-23T00:00:00.000Z',
      endDate: '2026-02-23T00:00:00.000Z',
      startTime: '10:00',
      endTime: '11:00',
      locationType: 'Physical',
      sessionType: 'PHYSICAL',
      physicalLocation: 'Room 1',
      virtualLocation: '',
      radius: 100,
      location: {
        type: 'COORDS',
        geolocation: { latitude: 19.1, longitude: 72.9 },
      },
      assignedUsers: [],
      weeklyDays: [],
      createdBy: 'user-1',
      organizationPrefix: 'org',
      classBatchId: 'class-1',
      isCancelled: false,
      isCompleted: false,
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    },
  },
};

describe('SessionOverride', () => {
  beforeEach(() => {
    (api.get as any).mockResolvedValue(mockSessionResponse);
    (api.patch as any).mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows confirmation dialog when mode changes', async () => {
    render(
      <MemoryRouter initialEntries={['/sessions/edit/session-1']}>
        <Routes>
          <Route path="/sessions/edit/:id" element={<SessionOverride />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Override Session');

    fireEvent.click(screen.getByText('Remote'));
    fireEvent.change(screen.getByPlaceholderText('Why are you overriding this session?'), {
      target: { value: 'Mode change for remote session.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Override/i }));

    expect(await screen.findByText('Confirm Session Mode Change')).toBeTruthy();
  });

  it('cancel prevents override call', async () => {
    render(
      <MemoryRouter initialEntries={['/sessions/edit/session-1']}>
        <Routes>
          <Route path="/sessions/edit/:id" element={<SessionOverride />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Override Session');

    fireEvent.click(screen.getByText('Remote'));
    fireEvent.change(screen.getByPlaceholderText('Why are you overriding this session?'), {
      target: { value: 'Mode change for remote session.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Override/i }));

    const cancelButton = await screen.findByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect((api.patch as any).mock.calls.length).toBe(0);
  });

  it('confirm triggers override call', async () => {
    render(
      <MemoryRouter initialEntries={['/sessions/edit/session-1']}>
        <Routes>
          <Route path="/sessions/edit/:id" element={<SessionOverride />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Override Session');

    fireEvent.click(screen.getByText('Remote'));
    fireEvent.change(screen.getByPlaceholderText('Why are you overriding this session?'), {
      target: { value: 'Mode change for remote session.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Override/i }));

    const confirmButton = await screen.findByRole('button', { name: /Confirm Override/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect((api.patch as any).mock.calls.length).toBeGreaterThan(0);
    });
  });
});
