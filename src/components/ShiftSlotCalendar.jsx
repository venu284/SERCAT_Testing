import React, { useMemo } from 'react';
import { CALENDAR_DAY_NAMES, SHIFT_LABELS, SHIFT_ORDER } from '../lib/constants';
import { localTodayDateStr, fromDateStr } from '../lib/dates';
import { COLORS, MEMBER_BG } from '../lib/theme';

export default function ShiftSlotCalendar({
  cycle,
  assignments = [],
  editable = false,
  onToggleDateBlock,
  onToggleSlotBlock,
  filterMember = 'all',
  onSelectSlot,
  preferenceMarks = {},
  activeSelection,
  memberDirectory = {},
  showPreferenceOverlay = false,
  showAssignedOnly = false,
  preferenceSelectionMode = false,
  availabilityColorMode = false,
  todayDate = localTodayDateStr(),
  prioritizeTodayMonth = false,
}) {
  const start = fromDateStr(cycle.startDate);
  const end = fromDateStr(cycle.endDate);
  const months = [];
  let cur = new Date(start);
  while (cur <= end) {
    const year = cur.getFullYear();
    const month = cur.getMonth();
    if (!months.find((m) => m.year === year && m.month === month)) months.push({ year, month });
    cur.setMonth(cur.getMonth() + 1);
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const blockedDateSet = new Set(cycle.blockedDates || []);
  const blockedSlotSet = new Set(cycle.blockedSlots || []);
  const filteredAssignments = filterMember === 'all' ? assignments : assignments.filter((a) => a.memberId === filterMember);
  const shifts = SHIFT_ORDER;
  const scheduleMode = showAssignedOnly && !editable;
  const isPreferenceSelectionMode = preferenceSelectionMode && !editable && Boolean(onSelectSlot);
  const displayMonths = useMemo(() => {
    if (!prioritizeTodayMonth) return months;
    const today = fromDateStr(todayDate);
    const idx = months.findIndex((m) => m.year === today.getFullYear() && m.month === today.getMonth());
    if (idx <= 0) return months;
    return [months[idx], ...months.slice(0, idx), ...months.slice(idx + 1)];
  }, [months, prioritizeTodayMonth, todayDate]);

  const getSlotAssignments = (date, shiftType) => filteredAssignments.filter((a) => a.date === date && a.shiftType === shiftType);

  return (
    <div className="space-y-3">
      {scheduleMode ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded border bg-emerald-50 border-emerald-200 text-emerald-700">Assigned slot</span>
          <span className="px-2 py-1 rounded border bg-white border-dashed border-gray-200 text-gray-600">No assignment</span>
          <span className="px-2 py-1 rounded border bg-slate-100 border-slate-300 text-slate-600">Blocked</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {shifts.map((shiftType) => (
            <span key={shiftType} className="px-2 py-1 rounded border bg-gray-50 text-gray-600">{SHIFT_LABELS[shiftType]}</span>
          ))}
          {editable && (
            <span className="px-2 py-1 rounded border bg-blue-50 text-blue-700">Calendar setup mode: click day/shift chips to block or unblock</span>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-4">
        {displayMonths.map(({ year, month }) => {
          const firstDay = new Date(year, month, 1).getDay();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const cells = [];
          for (let i = 0; i < firstDay; i += 1) cells.push(null);
          for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

          return (
            <div key={`${year}-${month}`} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm" style={{ minWidth: 330 }}>
              <div className={`text-center mb-2 text-sm ${scheduleMode ? 'font-bold text-gray-800' : 'font-semibold text-gray-700'}`}>
                {monthNames[month]} {year}
              </div>
              <div className="grid grid-cols-7 gap-1 text-xs">
                {CALENDAR_DAY_NAMES.map((d) => <div key={`${month}-${d}`} className="py-1 text-center text-xs font-semibold text-gray-500">{d}</div>)}
                {cells.map((day, idx) => {
                  if (!day) return <div key={`empty-${month}-${idx}`} className="min-h-[138px]" />;
                  const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const inRange = date >= cycle.startDate && date <= cycle.endDate;
                  if (!inRange) return <div key={date} className="min-h-[138px] rounded bg-gray-50" />;
                  const isToday = date === todayDate;
                  const dayBlocked = blockedDateSet.has(date);
                  const dayAssignedCount = scheduleMode ? shifts.reduce((count, shiftType) => count + (getSlotAssignments(date, shiftType).length > 0 ? 1 : 0), 0) : 0;

                  return (
                    <div
                      key={date}
                      className={`min-h-[138px] rounded border p-1 ${
                        dayBlocked ? 'bg-slate-100 border-slate-300' : scheduleMode && dayAssignedCount > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'
                      } ${isToday ? 'ring-2 ring-blue-300 ring-inset' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-bold ${dayBlocked ? 'text-gray-500' : isToday ? 'text-blue-700' : 'text-gray-700'}`}>{day}</span>
                        {editable ? (
                          <button
                            type="button"
                            className={`px-2 py-1 rounded text-[11px] font-semibold ${dayBlocked ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}
                            onClick={() => onToggleDateBlock?.(date)}
                            title={date}
                          >
                            {dayBlocked ? 'Unblock' : 'Block'}
                          </button>
                        ) : scheduleMode ? (
                          dayBlocked ? (
                            <span className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-200 text-slate-600">Blocked</span>
                          ) : dayAssignedCount > 0 ? (
                            <span className="px-2 py-1 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-700">{dayAssignedCount} Assigned</span>
                          ) : (
                            <span />
                          )
                        ) : !isPreferenceSelectionMode ? (
                          <span className={`px-2 py-1 rounded text-[11px] font-semibold ${dayBlocked ? (availabilityColorMode ? 'bg-slate-200 text-slate-600' : 'bg-rose-100 text-rose-700') : 'bg-emerald-100 text-emerald-700'}`}>
                            {dayBlocked ? 'Blocked' : 'Open'}
                          </span>
                        ) : <span />}
                      </div>
                      <div className="space-y-1">
                        {shifts.map((shiftType) => {
                          const slotKey = `${date}:${shiftType}`;
                          const slotBlocked = dayBlocked || blockedSlotSet.has(slotKey);
                          const slotAssignments = getSlotAssignments(date, shiftType);
                          const primaryAssignment = slotAssignments[0] || null;
                          const assignmentMemberName = primaryAssignment ? (memberDirectory[primaryAssignment.memberId]?.name || primaryAssignment.memberId) : '';
                          const assignmentLabel = filterMember === 'all' ? assignmentMemberName : 'Assigned';
                          const assignmentTypeLabel = primaryAssignment ? primaryAssignment.assignmentType.replace(/_/g, ' ') : '';
                          const marks = preferenceMarks[slotKey] || [];
                          const hasFirstPreference = marks.some((m) => /1st/i.test(m));
                          const hasSecondPreference = marks.some((m) => /2nd/i.test(m));
                          const preferenceLabel = hasFirstPreference && hasSecondPreference ? '1st + 2nd' : hasFirstPreference ? '1st Choice' : hasSecondPreference ? '2nd Choice' : '';
                          const preferenceToneClass = !slotBlocked && !primaryAssignment && marks.length > 0
                            ? hasFirstPreference && hasSecondPreference ? 'bg-amber-100 border-amber-400 text-amber-800 shadow-md -translate-y-[1px]'
                              : hasFirstPreference ? 'bg-blue-100 border-blue-400 text-blue-800 shadow-md -translate-y-[1px]'
                                : 'bg-orange-100 border-orange-400 text-orange-800 shadow-md -translate-y-[1px]'
                            : '';
                          const isActiveSelection = activeSelection?.shiftType === shiftType;
                          const canSelect = !scheduleMode && !editable && Boolean(onSelectSlot) && !slotBlocked;
                          const shouldHighlight = canSelect && isActiveSelection;
                          const assignmentTitles = slotAssignments.map((a) => `${a.memberId} (${a.assignmentType})`).join(', ');
                          const prefSummary = marks.length > 3 ? `${marks.slice(0, 3).join(', ')} +${marks.length - 3}` : marks.join(', ');
                          const assignmentStyle = (!scheduleMode && !slotBlocked && primaryAssignment)
                            ? { backgroundColor: MEMBER_BG[primaryAssignment.memberId] || '#eef2ff', borderColor: COLORS[primaryAssignment.memberId] || '#94a3b8' }
                            : undefined;
                          const slotToneClass = slotBlocked
                            ? 'bg-slate-100 border-slate-300 text-gray-600'
                            : scheduleMode
                              ? (primaryAssignment ? (shiftType === 'NS' ? 'bg-indigo-100 border-indigo-300 text-indigo-800' : 'bg-emerald-100 border-emerald-300 text-emerald-800') : 'bg-white border-dashed border-gray-200 text-gray-500')
                              : primaryAssignment
                                ? 'bg-white border-gray-200 text-gray-700'
                                : isPreferenceSelectionMode
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                  : (availabilityColorMode ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white border-gray-200 text-gray-700');

                          return (
                            <button
                              key={slotKey}
                              type="button"
                              className={`w-full text-left px-2 py-1.5 rounded text-xs border transition-all ${slotToneClass} ${editable ? 'hover:bg-gray-50' : canSelect ? 'hover:brightness-105 cursor-pointer' : ''} ${shouldHighlight ? 'ring-1 ring-blue-400' : ''} ${primaryAssignment && !slotBlocked && !scheduleMode ? 'shadow-sm' : ''} ${preferenceToneClass}`}
                              style={assignmentStyle}
                              onClick={() => {
                                if (editable) {
                                  if (!dayBlocked) onToggleSlotBlock?.(date, shiftType);
                                  return;
                                }
                                if (canSelect) onSelectSlot(date, shiftType);
                              }}
                              title={slotBlocked ? `${SHIFT_LABELS[shiftType]} blocked` : assignmentTitles || SHIFT_LABELS[shiftType]}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-semibold">{SHIFT_LABELS[shiftType] || shiftType}</span>
                                {slotBlocked ? (
                                  scheduleMode || isPreferenceSelectionMode ? null : <span className="text-[11px] font-medium">Blocked</span>
                                ) : scheduleMode ? (
                                  primaryAssignment ? <span className={`text-[11px] font-semibold ${shiftType === 'NS' ? 'text-indigo-700' : 'text-emerald-700'}`}>Assigned</span> : null
                                ) : isPreferenceSelectionMode ? (
                                  marks.length > 0 ? <span className={`text-[11px] font-semibold ${hasFirstPreference && !hasSecondPreference ? 'text-blue-700' : hasSecondPreference && !hasFirstPreference ? 'text-orange-700' : 'text-amber-700'}`}>{preferenceLabel}</span> : null
                                ) : primaryAssignment ? (
                                  <span className="max-w-[95px] truncate text-[11px] font-semibold" style={{ color: COLORS[primaryAssignment.memberId] }} title={assignmentMemberName}>
                                    {assignmentLabel}{slotAssignments.length > 1 ? ` +${slotAssignments.length - 1}` : ''}
                                  </span>
                                ) : marks.length > 0 ? (
                                  <span className={`text-[11px] font-semibold ${hasFirstPreference && !hasSecondPreference ? 'text-blue-700' : hasSecondPreference && !hasFirstPreference ? 'text-orange-700' : 'text-amber-700'}`}>{preferenceLabel}</span>
                                ) : (
                                  <span className={`text-[11px] ${availabilityColorMode ? 'font-semibold text-emerald-700' : 'text-gray-500'}`}>Open</span>
                                )}
                              </div>
                              {!slotBlocked && primaryAssignment && !scheduleMode && (
                                <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: COLORS[primaryAssignment.memberId] }}>{assignmentTypeLabel}</div>
                              )}
                              {!slotBlocked && !primaryAssignment && marks.length > 0 && !scheduleMode && (
                                <div className={`mt-0.5 text-[11px] font-semibold uppercase tracking-wide ${hasFirstPreference && !hasSecondPreference ? 'text-blue-700' : hasSecondPreference && !hasFirstPreference ? 'text-orange-700' : 'text-amber-700'}`}>Selected Slot</div>
                              )}
                              {!slotBlocked && showPreferenceOverlay && marks.length > 0 && !scheduleMode && (
                                <div className="mt-0.5 truncate text-[11px] font-medium text-gray-500" title={`Original choices: ${marks.join(', ')}`}>Original: {prefSummary}</div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
