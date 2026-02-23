// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import SessionCalendar from '../SessionCalendar';
import { ISession } from '../../types';

const buildSession = (overrides: Partial<ISession> = {}): ISession => ({
  _id: 'session-1',
  name: 'Session - 2026-02-15',
  frequency: 'OneTime',
  startDate: '2026-02-15T00:00:00.000Z',
  endDate: '2026-02-15T00:00:00.000Z',
  startTime: '10:00',
  endTime: '11:00',
  locationType: 'Physical',
  sessionType: 'PHYSICAL',
  assignedUsers: [],
  createdBy: 'user-1',
  organizationPrefix: 'org',
  createdAt: '2026-02-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
  ...overrides,
});

describe('SessionCalendar', () => {
  it('renders mode label based on sessions', () => {
    const onDateSelect = () => { };
    const onMonthChange = () => { };
    const currentMonth = new Date('2026-02-01T00:00:00.000Z');

    const { rerender } = render(
      <SessionCalendar
        sessions={[buildSession({ sessionType: 'PHYSICAL' })]}
        selectedDate={null}
        onDateSelect={onDateSelect}
        currentMonth={currentMonth}
        onMonthChange={onMonthChange}
      />
    );

    expect(screen.getByText('PHYSICAL')).toBeTruthy();

    rerender(
      <SessionCalendar
        sessions={[buildSession({ sessionType: 'REMOTE' })]}
        selectedDate={null}
        onDateSelect={onDateSelect}
        currentMonth={currentMonth}
        onMonthChange={onMonthChange}
      />
    );

    expect(screen.getByText('REMOTE')).toBeTruthy();
  });
});
