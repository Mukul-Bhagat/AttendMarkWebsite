import React, { useState } from 'react';
import { ISession } from '../types';

interface SessionCalendarProps {
  sessions: ISession[];
  selectedDate: Date | null;
  onDateSelect: (date: Date | null) => void;
}

const SessionCalendar: React.FC<SessionCalendarProps> = ({ sessions, selectedDate, onDateSelect }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Get first day of month and number of days
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Adjust to Monday = 0 (instead of Sunday = 0)
  const adjustedStartingDay = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;

  // Get sessions for a specific date
  const getSessionsForDate = (date: Date): ISession[] => {
    const dateStr = date.toISOString().split('T')[0];
    return sessions.filter(session => {
      if (!session.startDate) return false;
      const sessionDate = new Date(session.startDate);
      sessionDate.setHours(0, 0, 0, 0);
      const sessionDateStr = sessionDate.toISOString().split('T')[0];
      return sessionDateStr === dateStr && !session.isCancelled;
    });
  };

  // Helper function to get session end time as a full Date object
  const getSessionEndTime = (session: ISession): Date => {
    // Use startDate as the base date (for recurring sessions, this will be the actual date)
    const d = new Date(session.startDate);
    
    if (session.endTime && typeof session.endTime === 'string' && session.endTime.includes(':')) {
      const [h, m] = session.endTime.split(':').map(Number);
      d.setHours(h, m, 0, 0);
    } else {
      // If no endTime, assume end of day
      d.setHours(23, 59, 59, 999);
    }
    
    return d;
  };

  // Check if date has sessions and determine dot color
  const getDateIndicator = (date: Date): 'red' | 'green' | 'yellow' | null => {
    const dateSessions = getSessionsForDate(date);
    if (dateSessions.length === 0) return null;

    const now = new Date();

    // For each session on this date, determine its status
    const sessionStatuses: Array<'red' | 'green' | 'yellow'> = [];
    
    for (const session of dateSessions) {
      // PRIORITY 1: Check if session's endTime has passed (RED)
      const sessionEndTime = getSessionEndTime(session);
      if (now > sessionEndTime) {
        sessionStatuses.push('red');
        continue; // Skip to next session
      }

      // PRIORITY 2: Check if session was edited (YELLOW) - only if not past
      if (session.updatedAt && session.createdAt) {
        const updatedAt = new Date(session.updatedAt);
        const createdAt = new Date(session.createdAt);
        if (updatedAt > createdAt) {
          sessionStatuses.push('yellow');
          continue; // Skip to next session
        }
      }

      // PRIORITY 3: Default to GREEN (Upcoming/Live)
      sessionStatuses.push('green');
    }

    // If multiple sessions on this date:
    // - If ALL sessions are past (red) -> RED
    // - If ANY session is red -> RED (highest priority)
    // - Else if ANY session is yellow -> YELLOW
    // - Else -> GREEN
    if (sessionStatuses.some(status => status === 'red')) {
      return 'red';
    }
    if (sessionStatuses.some(status => status === 'yellow')) {
      return 'yellow';
    }
    return 'green';
  };

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Check if a date is selected
  const isDateSelected = (date: Date): boolean => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  // Handle date click
  const handleDateClick = (date: Date) => {
    if (isDateSelected(date)) {
      // Deselect if clicking the same date
      onDateSelect(null);
    } else {
      onDateSelect(new Date(date));
    }
  };

  // Generate calendar days
  const calendarDays: (Date | null)[] = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < adjustedStartingDay; i++) {
    calendarDays.push(null);
  }

  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
      {/* Month Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Previous month"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button
          onClick={goToNextMonth}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Next month"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      {/* Day Names Header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-slate-500 dark:text-slate-400 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const indicator = getDateIndicator(date);
          const isSelected = isDateSelected(date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const checkDate = new Date(date);
          checkDate.setHours(0, 0, 0, 0);
          const isToday = checkDate.getTime() === today.getTime();

          return (
            <button
              key={date.toISOString()}
              onClick={() => handleDateClick(date)}
              className={`aspect-square rounded-lg text-sm font-medium transition-colors relative ${
                isSelected
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : isToday
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {date.getDate()}
              {indicator && (
                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      indicator === 'red'
                        ? 'bg-red-500'
                        : indicator === 'yellow'
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-slate-600 dark:text-slate-400">Past Session</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-slate-600 dark:text-slate-400">Upcoming Session</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-slate-600 dark:text-slate-400">Edited Session</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionCalendar;

