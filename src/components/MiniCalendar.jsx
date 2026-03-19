import React from 'react';
import { fromDateStr } from '../lib/dates';
import { COLORS, MEMBER_BG } from '../lib/theme';

export default function MiniCalendar({ startDate, endDate, blocked, selected, onDateClick, assignments, highlightMember, viewOnly }) {
  const start = fromDateStr(startDate);
  const end = fromDateStr(endDate);
  const months = [];
  let cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    if (!months.find((x) => x.year === y && x.month === m)) months.push({ year: y, month: m });
    cur.setMonth(cur.getMonth() + 1);
  }
  const blockedSet = new Set(blocked || []);
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="flex flex-wrap gap-4">
      {months.map(({ year, month }) => {
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cells = [];
        for (let i = 0; i < firstDay; i += 1) cells.push(null);
        for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

        return (
          <div key={`${year}-${month}`} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm" style={{ minWidth: 280 }}>
            <div className="text-center font-semibold text-gray-700 mb-2 text-sm">{MONTHS[month]} {year}</div>
            <div className="grid grid-cols-7 gap-0.5 text-xs">
              {DAYS.map((d) => <div key={d} className="text-center text-gray-400 font-medium py-1">{d}</div>)}
              {cells.map((day, i) => {
                if (!day) return <div key={`e${i}`} />;
                const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const inRange = ds >= startDate && ds <= endDate;
                const isBlocked = blockedSet.has(ds);
                const isSelected = selected?.includes(ds);
                const dayAssignments = assignments?.filter((a) => a.date === ds) || [];
                const memberAssignment = highlightMember ? dayAssignments.filter((a) => a.memberId === highlightMember) : dayAssignments;
                const uniqueMembers = [...new Set(dayAssignments.map((a) => a.memberId))];

                if (!inRange) return <div key={ds} className="text-center py-1 text-gray-200">{day}</div>;

                return (
                  <div
                    key={ds}
                    className={`text-center py-1 rounded cursor-pointer text-xs relative transition-all
                      ${isBlocked ? 'bg-gray-300 text-gray-500 line-through cursor-not-allowed' : ''}
                      ${isSelected ? 'ring-2 ring-blue-500 font-bold' : ''}
                      ${!isBlocked && !viewOnly ? 'hover:bg-blue-50' : ''}`}
                    style={memberAssignment.length > 0 && !isBlocked ? {
                      backgroundColor: MEMBER_BG[memberAssignment[0]?.memberId] || '#f3f4f6',
                      color: COLORS[memberAssignment[0]?.memberId] || '#374151',
                      fontWeight: 600,
                    } : uniqueMembers.length > 0 && !highlightMember ? {
                      backgroundColor: MEMBER_BG[uniqueMembers[0]] || '#f3f4f6',
                    } : {}}
                    onClick={() => !isBlocked && !viewOnly && onDateClick?.(ds)}
                    title={isBlocked ? 'Blocked' : dayAssignments.length > 0 ? dayAssignments.map((a) => `${a.memberId} ${a.shiftType} (${a.assignmentType})`).join('\n') : ds}
                  >
                    {day}
                    {uniqueMembers.length > 1 && !highlightMember && (
                      <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border border-white" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
