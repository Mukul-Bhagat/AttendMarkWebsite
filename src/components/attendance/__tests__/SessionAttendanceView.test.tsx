// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import SessionAttendanceView from '../SessionAttendanceView';
import api from '../../../api';
import { adjustAttendance } from '../../../api/attendanceAdjustment';

vi.mock('../../../api', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      role: 'COMPANY_ADMIN',
      roleProfile: 'MANAGER',
    },
  }),
}));

vi.mock('../AttendanceCheckbox', () => ({
  default: ({ user }: any) => <span data-testid={`status-${user.userId}`}>{user.status}</span>,
}));

vi.mock('../EnhancedManualUpdateModal', () => ({
  default: ({ isOpen, onConfirm }: any) => (
    isOpen ? (
      <button
        data-testid="confirm-adjust"
        onClick={() => onConfirm('Manual correction from test', undefined, 'PRESENT')}
      >
        Confirm Adjustment
      </button>
    ) : null
  ),
}));

vi.mock('../../../utils/attendancePermissions', () => ({
  canAdjustAttendance: () => true,
}));

vi.mock('../../../api/attendanceAdjustment', () => ({
  adjustAttendance: vi.fn(),
}));

vi.mock('../../../shared/logger', () => ({
  appLogger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const mockManageResponse = () => ({
  data: {
    data: {
      users: [
        {
          userId: 'user-1',
          name: 'User One',
          email: 'user1@example.com',
          role: 'Member',
          status: 'PRESENT',
          checkInTime: '2026-03-07T09:05:00.000Z',
          isLate: false,
          lateByMinutes: null,
          locationVerified: false,
          isManuallyModified: false,
          updatedBy: null,
          manualUpdatedAt: null,
          updateReason: null,
          markedViaLabel: 'One-Tap Check-In',
          markingMethod: 'ONE_TAP',
          markingChannel: 'APP',
          sourceContext: 'SELF_SERVICE',
          gracePeriodMinutes: 10,
          onTimeWithinGrace: true,
          leaveStatus: 'None',
          leaveType: null,
          modifiedByNames: [],
          modificationHistory: [],
        },
        {
          userId: 'user-2',
          name: 'User Two',
          email: 'user2@example.com',
          role: 'Member',
          status: 'ABSENT',
          checkInTime: null,
          isLate: false,
          lateByMinutes: null,
          locationVerified: false,
          isManuallyModified: true,
          updatedBy: {
            name: 'Manager One',
            role: 'MANAGER',
          },
          manualUpdatedAt: '2026-03-07T10:00:00.000Z',
          updateReason: 'Manual correction',
          markedViaLabel: 'Manual Adjustment',
          markingMethod: null,
          markingChannel: 'ADMIN',
          sourceContext: 'MANUAL_ADJUST',
          gracePeriodMinutes: 0,
          onTimeWithinGrace: false,
          leaveStatus: 'Approved',
          leaveType: 'Casual',
          modifiedByNames: ['Manager One', 'Admin Two'],
          modificationHistory: [],
        },
      ],
      summary: {
        total: 2,
        present: 1,
        absent: 1,
        late: 0,
      },
      sessionDate: '2026-03-07',
      session: {
        id: 'session-1',
        name: 'Trainee Session - 7/3/2026',
        startTime: '09:00',
        endTime: '10:00',
      },
    },
  },
});

describe('SessionAttendanceView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as any).mockResolvedValue(mockManageResponse());
    (adjustAttendance as any).mockResolvedValue({ success: true });
  });

  it('does not render audit-trail action controls in the modal', async () => {
    render(
      <SessionAttendanceView
        sessionId="session-1"
        sessionDate="2026-03-07"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Session Attendance')).toBeTruthy();
      expect(screen.getAllByText('User One').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('View Audit Trail')).toBeNull();
    expect(screen.queryByText('Edited')).toBeNull();
    expect(screen.queryByText('View History')).toBeNull();
  });

  it('renders info line with timing, method, verification, leave status, and modifiers', async () => {
    render(
      <SessionAttendanceView
        sessionId="session-1"
        sessionDate="2026-03-07"
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText('User One').length).toBeGreaterThan(0);
      expect(screen.getAllByText('User Two').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('On time (Grace)')).toBeTruthy();
    expect(screen.getByText('One-Tap Check-In')).toBeTruthy();
    expect(screen.getByText('Not Verified')).toBeTruthy();
    expect(screen.getByText('Leave Approved (Casual)')).toBeTruthy();
    expect(screen.getByText('Modified by Manager One -> Admin Two')).toBeTruthy();
    expect(screen.queryByText('Modified by User One')).toBeNull();
  });

  it('sends normalized YYYY-MM-DD targetDate during manual adjustment', async () => {
    render(
      <SessionAttendanceView
        sessionId="session-1"
        sessionDate="2026-03-07T12:34:00.000Z"
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('adjust-button').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByTestId('adjust-button')[0]);
    fireEvent.click(screen.getByTestId('confirm-adjust'));

    await waitFor(() => {
      expect(adjustAttendance).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          userId: 'user-1',
          targetDate: '2026-03-07',
        }),
      );
    });
  });
});
