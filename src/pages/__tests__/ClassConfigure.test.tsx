// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import ClassConfigure from '../ClassConfigure';
import api from '../../api';

vi.mock('../../api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../components/GoogleMapPicker', () => ({
  default: () => null,
}));

vi.mock('../../components/AddUsersModal', () => ({
  default: () => null,
}));

const mockConfigResponse = {
  data: {
    classBatch: {
      _id: 'class-1',
      name: 'Test Class',
      description: 'Test description',
      configRevision: 2,
    },
    configVersion: {
      effectiveFromKey: '2026-02-23',
      scheduleRule: {
        frequency: 'DAILY',
        startDateKey: '2026-02-23',
        endDateKey: '2026-03-23',
        startTime: '10:00',
        endTime: '11:00',
        timezone: 'Asia/Kolkata',
      },
      defaults: {
        mode: 'PHYSICAL',
        physicalPolicy: {
          radiusMeters: 100,
          center: { latitude: 19.1, longitude: 72.9 },
          locationLabel: 'Room 1',
        },
      },
    },
  },
};

describe('ClassConfigure', () => {
  beforeEach(() => {
    (api.get as any).mockImplementation((url: string) => {
      if (url.includes('/configuration')) {
        return Promise.resolve(mockConfigResponse);
      }
      if (url.includes('/enrollments')) {
        return Promise.resolve({ data: { enrollments: [] } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
    (api.put as any).mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows confirmation dialog when mode changes', async () => {
    render(
      <MemoryRouter initialEntries={['/classes/edit/class-1']}>
        <Routes>
          <Route path="/classes/edit/:id" element={<ClassConfigure />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Configure Class');

    fireEvent.click(screen.getByText('Remote'));
    fireEvent.click(screen.getByRole('button', { name: /Save Configuration/i }));

    expect(await screen.findByText('Confirm Class Mode Change')).toBeTruthy();
  });

  it('cancel prevents configure call', async () => {
    render(
      <MemoryRouter initialEntries={['/classes/edit/class-1']}>
        <Routes>
          <Route path="/classes/edit/:id" element={<ClassConfigure />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Configure Class');

    fireEvent.click(screen.getByText('Remote'));
    fireEvent.click(screen.getByRole('button', { name: /Save Configuration/i }));

    const cancelButton = await screen.findByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButton);

    const configureCalls = (api.put as any).mock.calls.filter((call: any[]) => call[0].includes('/configure'));
    expect(configureCalls.length).toBe(0);
  });

  it('confirm triggers configure call', async () => {
    render(
      <MemoryRouter initialEntries={['/classes/edit/class-1']}>
        <Routes>
          <Route path="/classes/edit/:id" element={<ClassConfigure />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Configure Class');

    fireEvent.click(screen.getByText('Remote'));
    fireEvent.click(screen.getByRole('button', { name: /Save Configuration/i }));

    const confirmButton = await screen.findByRole('button', { name: /Confirm Change/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      const configureCalls = (api.put as any).mock.calls.filter((call: any[]) => call[0].includes('/configure'));
      expect(configureCalls.length).toBeGreaterThan(0);
    });
  });
});
