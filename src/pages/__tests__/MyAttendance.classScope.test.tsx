// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import MyAttendance from '../MyAttendance';
import { getMyAnalytics, getMySessions } from '../../api/analyticsApi';

vi.mock('../../api/analyticsApi', () => ({
  getMyAnalytics: vi.fn(),
  getMySessions: vi.fn(),
}));

vi.mock('../../api/reportingApi', () => ({
  getEmailAutomationConfigs: vi.fn().mockResolvedValue({ data: { data: [] } }),
  toggleEmailAutomation: vi.fn(),
  deleteEmailAutomation: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { organizationName: 'Org', organizationLogo: '' },
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
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to first class and fetches analytics with classId', async () => {
    (getMySessions as any).mockResolvedValue([
      { _id: 'class-1', name: 'Class One' },
    ]);
    (getMyAnalytics as any).mockResolvedValue({
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
      expect(getMyAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          classId: 'class-1',
        }),
      );
    });

    const filterNode = screen.getByTestId('analytics-filters');
    expect(filterNode.getAttribute('data-selected')).toBe('class-1');
    expect(filterNode.getAttribute('data-hide')).toBe('true');
  });

  it('shows class filter when user has multiple classes', async () => {
    (getMySessions as any).mockResolvedValue([
      { _id: 'class-1', name: 'Class One' },
      { _id: 'class-2', name: 'Class Two' },
    ]);
    (getMyAnalytics as any).mockResolvedValue({
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

