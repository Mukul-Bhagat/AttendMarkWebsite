// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import AttendanceReport from '../AttendanceReport';
import api from '../../api';

vi.mock('../../api', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    isSuperAdmin: false,
    isCompanyAdmin: true,
    isManager: false,
    isPlatformOwner: false,
    isSessionAdmin: false,
  }),
}));

vi.mock('../../components/attendance/reporting/ReportApprovalPanel', () => ({
  default: () => null,
}));

vi.mock('../../components/attendance/SessionAttendanceView', () => ({
  default: () => null,
}));

vi.mock('../../components/SkeletonCard', () => ({
  default: () => <div data-testid="skeleton-card" />,
}));

describe('AttendanceReport class scope', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads with first class selected and requests class-scoped analytics', async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/api/classes') {
        return Promise.resolve({
          data: [
            { _id: 'class-1', name: 'Class One' },
            { _id: 'class-2', name: 'Class Two' },
          ],
        });
      }
      if (url === '/api/reports/analytics') {
        return Promise.resolve({
          data: {
            totalSessions: 1,
            overallPresent: 3,
            overallLate: 1,
            overallAbsent: 0,
            dailyBreakdown: [
              { date: '2026-03-03', present: 3, late: 1, absent: 0, totalStudents: 4 },
            ],
            topPerformers: [],
            defaulters: [],
          },
        });
      }
      if (url === '/api/reports/logs') {
        return Promise.resolve({ data: [] });
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(
      <MemoryRouter initialEntries={['/reports']}>
        <Routes>
          <Route path="/reports" element={<AttendanceReport />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/classes');
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/api/reports/analytics',
        expect.objectContaining({
          params: expect.objectContaining({
            classId: 'class-1',
          }),
        }),
      );
    });
  });

  it('refetches analytics with new class when class selection changes', async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/api/classes') {
        return Promise.resolve({
          data: [
            { _id: 'class-1', name: 'Class One' },
            { _id: 'class-2', name: 'Class Two' },
          ],
        });
      }
      if (url === '/api/reports/analytics') {
        return Promise.resolve({
          data: {
            totalSessions: 0,
            overallPresent: 0,
            overallLate: 0,
            overallAbsent: 0,
            dailyBreakdown: [],
            topPerformers: [],
            defaulters: [],
          },
        });
      }
      if (url === '/api/reports/logs') {
        return Promise.resolve({ data: [] });
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(
      <MemoryRouter initialEntries={['/reports']}>
        <Routes>
          <Route path="/reports" element={<AttendanceReport />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Class One')).toBeTruthy();
    });

    fireEvent.change(screen.getByDisplayValue('Class One'), {
      target: { value: 'class-2' },
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/api/reports/analytics',
        expect.objectContaining({
          params: expect.objectContaining({
            classId: 'class-2',
          }),
        }),
      );
    });
  });
});
