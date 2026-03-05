// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import MyAttendance from '../MyAttendance';
import { getMyDashboard, getMySessions } from '../../api/analyticsApi';

vi.mock('../../api/analyticsApi', () => ({
  getMyDashboard: vi.fn(),
  getMySessions: vi.fn(),
}));

vi.mock('../../api/reportingApi', () => ({
  getEmailAutomationConfigs: vi.fn().mockResolvedValue({ data: { data: [] } }),
  toggleEmailAutomation: vi.fn(),
  deleteEmailAutomation: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'viewer-1',
      organizationId: 'org-1',
      organizationName: 'Org',
      organizationLogo: '',
    },
    isSuperAdmin: false,
    isCompanyAdmin: false,
    isManager: false,
    isPlatformOwner: false,
    isSessionAdmin: false,
  }),
}));

vi.mock('../../components/attendance/AnalyticsFilters', () => ({
  default: (props: any) => (
    <div
      data-testid="analytics-filters"
      data-selected={props.selectedClass}
      data-hide={String(props.hideClassFilter)}
    />
  ),
}));

vi.mock('../../components/attendance/AnalyticsTab', () => ({
  default: () => <div data-testid="analytics-tab" />,
}));

vi.mock('../../components/attendance/reporting/AttendanceReportTab', () => ({
  default: () => <div data-testid="attendance-report-tab" />,
}));

vi.mock('../../components/attendance/reporting/ShareReportModal', () => ({
  default: () => null,
}));

vi.mock('../../components/attendance/reporting/DownloadReportModal', () => ({
  default: () => null,
}));

vi.mock('../../components/attendance/reporting/ReportApprovalPanel', () => ({
  default: () => null,
}));

vi.mock('../../components/attendance/reporting/AutomationIndicator', () => ({
  AutomationIndicator: () => null,
}));

describe('MyAttendance class-scoped behavior', () => {
  const STORAGE_KEY = 'my-attendance:selected-class:org-1:viewer-1:self';
  const REAL_DATE_NOW = Date.now;

  beforeEach(() => {
    Date.now = vi.fn(() => new Date('2026-03-05T12:00:00.000Z').getTime()) as any;
    localStorage.clear();
  });

  afterEach(() => {
    Date.now = REAL_DATE_NOW;
    vi.clearAllMocks();
  });

  it('defaults to first class, uses previous-month range, and fetches analytics with classId', async () => {
    (getMySessions as any).mockResolvedValue([
      { _id: 'class-1', name: 'Class One' },
    ]);
    (getMyDashboard as any).mockResolvedValue({
      trend: [],
      summary: {},
    });

    render(
      <MemoryRouter initialEntries={['/my-attendance']}>
        <Routes>
          <Route path="/my-attendance" element={<MyAttendance />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getMySessions).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(getMyDashboard).toHaveBeenCalledWith(
        expect.objectContaining({
          classId: 'class-1',
          startDate: '2026-02-05',
          endDate: '2026-03-05',
        }),
      );
    });

    const filterNode = screen.getByTestId('analytics-filters');
    expect(filterNode.getAttribute('data-selected')).toBe('class-1');
    expect(filterNode.getAttribute('data-hide')).toBe('true');
  });

  it('restores persisted class when still enrolled', async () => {
    localStorage.setItem(STORAGE_KEY, 'class-2');
    (getMySessions as any).mockResolvedValue([
      { _id: 'class-1', name: 'Class One' },
      { _id: 'class-2', name: 'Class Two' },
    ]);
    (getMyDashboard as any).mockResolvedValue({
      trend: [],
      summary: {},
    });

    render(
      <MemoryRouter initialEntries={['/my-attendance']}>
        <Routes>
          <Route path="/my-attendance" element={<MyAttendance />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getMyDashboard).toHaveBeenCalledWith(
        expect.objectContaining({
          classId: 'class-2',
        }),
      );
    });

    const filterNode = screen.getByTestId('analytics-filters');
    expect(filterNode.getAttribute('data-selected')).toBe('class-2');
  });

  it('falls back to first class when persisted class is no longer valid', async () => {
    localStorage.setItem(STORAGE_KEY, 'class-missing');
    (getMySessions as any).mockResolvedValue([
      { _id: 'class-1', name: 'Class One' },
      { _id: 'class-2', name: 'Class Two' },
    ]);
    (getMyDashboard as any).mockResolvedValue({
      trend: [],
      summary: {},
    });

    render(
      <MemoryRouter initialEntries={['/my-attendance']}>
        <Routes>
          <Route path="/my-attendance" element={<MyAttendance />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getMyDashboard).toHaveBeenCalledWith(
        expect.objectContaining({
          classId: 'class-1',
        }),
      );
    });

    const filterNode = screen.getByTestId('analytics-filters');
    expect(filterNode.getAttribute('data-selected')).toBe('class-1');
  });

  it('shows class filter when user has multiple classes', async () => {
    (getMySessions as any).mockResolvedValue([
      { _id: 'class-1', name: 'Class One' },
      { _id: 'class-2', name: 'Class Two' },
    ]);
    (getMyDashboard as any).mockResolvedValue({
      trend: [],
      summary: {},
    });

    render(
      <MemoryRouter initialEntries={['/my-attendance']}>
        <Routes>
          <Route path="/my-attendance" element={<MyAttendance />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const filterNode = screen.getByTestId('analytics-filters');
      expect(filterNode.getAttribute('data-hide')).toBe('false');
    });
  });
});
