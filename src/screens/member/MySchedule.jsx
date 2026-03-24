import React from 'react';
import { CALENDAR_DAY_NAMES, SHIFT_ORDER, SHIFT_UI_META } from '../../lib/constants';
import { CONCEPT_THEME } from '../../lib/theme';
import { formatCalendarDate } from '../../lib/dates';
import { useMockApp } from '../../lib/mock-state';

export default function MySchedule() {
  const {
    cycle,
    memberScheduleView,
    setMemberScheduleView,
    downloadMemberSchedulePdf,
    hasGeneratedSchedule,
    hasGeneratedScheduleForCurrentMember,
    sortedCurrentMemberAssignments,
    memberShiftCounts,
    scheduleUpcomingAssignments,
    schedulePastAssignments,
    nextUpcomingAssignment,
    formatMemberShiftDate,
    scheduleRelativeDayLabel,
    scheduleMonths,
    todayDate,
    memberAssignmentMapByDate,
  } = useMockApp();

  return (
    <div className="space-y-4 concept-font-body">
      <div className="rounded-2xl px-5 py-4 bg-white border shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="concept-font-display text-lg font-bold" style={{ color: CONCEPT_THEME.navy }}>My Schedule</h3>
            <p className="text-xs mt-1" style={{ color: CONCEPT_THEME.muted }}>
              {formatCalendarDate(cycle.startDate)} - {formatCalendarDate(cycle.endDate)} | Cycle {cycle.id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: CONCEPT_THEME.border }}>
              {[
                { id: 'agenda', label: 'Agenda' },
                { id: 'calendar', label: 'Calendar' },
              ].map((view) => (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => setMemberScheduleView(view.id)}
                  className="px-3 py-1.5 text-sm font-semibold transition-all"
                  style={{
                    background: memberScheduleView === view.id ? CONCEPT_THEME.navy : CONCEPT_THEME.warmWhite,
                    color: memberScheduleView === view.id ? 'white' : CONCEPT_THEME.muted,
                  }}
                >
                  {view.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={downloadMemberSchedulePdf}
              disabled={!hasGeneratedSchedule}
              className="rounded-xl px-4 py-2 text-sm font-bold transition-all disabled:cursor-not-allowed"
              style={{
                background: hasGeneratedSchedule ? CONCEPT_THEME.navy : CONCEPT_THEME.sandDark,
                color: hasGeneratedSchedule ? 'white' : CONCEPT_THEME.text,
              }}
            >
              Export PDF
            </button>
          </div>
        </div>

        {!hasGeneratedSchedule ? (
          <div className="text-sm text-gray-500">
            Schedule not generated yet. Current status: draft.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
              {[
                { label: 'Total Shifts', value: sortedCurrentMemberAssignments.length, color: CONCEPT_THEME.navy, bg: CONCEPT_THEME.sand },
                { label: 'Morning', value: memberShiftCounts.DS1 || 0, color: CONCEPT_THEME.morning, bg: CONCEPT_THEME.morningBg },
                { label: 'Afternoon', value: memberShiftCounts.DS2 || 0, color: CONCEPT_THEME.afternoon, bg: CONCEPT_THEME.afternoonBg },
                { label: 'Night', value: memberShiftCounts.NS || 0, color: CONCEPT_THEME.night, bg: CONCEPT_THEME.nightBg },
              ].map((stat) => (
                <div key={stat.label} className="px-3 py-2.5 rounded-xl" style={{ background: stat.bg }}>
                  <div className="text-lg font-bold leading-none" style={{ color: stat.color }}>{stat.value}</div>
                  <div className="mt-1 text-xs" style={{ color: stat.color }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {!hasGeneratedScheduleForCurrentMember && (
              <div className="mb-3 rounded-xl px-3 py-2 text-sm" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.muted }}>
                No shifts assigned to your account for this cycle yet.
              </div>
            )}

            {memberScheduleView === 'agenda' ? (
              <div className="space-y-4">
                {nextUpcomingAssignment && (
                  <div className="rounded-2xl px-5 py-4" style={{ background: `linear-gradient(135deg, ${CONCEPT_THEME.navy} 0%, ${CONCEPT_THEME.navyLight} 100%)`, border: `1px solid ${CONCEPT_THEME.navyLight}` }}>
                    <div className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: CONCEPT_THEME.amber }}>Next Shift</div>
                    <div className="text-white concept-font-display text-xl font-bold">{formatMemberShiftDate(nextUpcomingAssignment.date)}</div>
                    <div className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.88)' }}>
                      {(SHIFT_UI_META[nextUpcomingAssignment.shiftType]?.label || nextUpcomingAssignment.shiftType)} | {scheduleRelativeDayLabel(nextUpcomingAssignment.date)}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl px-4 py-3 bg-white border" style={{ borderColor: CONCEPT_THEME.borderLight }}>
                  <h4 className="concept-font-display text-sm font-bold mb-2" style={{ color: CONCEPT_THEME.navy }}>
                    Upcoming ({scheduleUpcomingAssignments.length})
                  </h4>
                  {scheduleUpcomingAssignments.length === 0 ? (
                    <div className="text-sm" style={{ color: CONCEPT_THEME.muted }}>No upcoming shifts.</div>
                  ) : (
                    <div className="space-y-2">
                      {scheduleUpcomingAssignments.map((assignment, idx) => {
                        const meta = SHIFT_UI_META[assignment.shiftType] || { label: assignment.shiftType, sub: '', color: CONCEPT_THEME.text, bg: CONCEPT_THEME.sand };
                        return (
                          <div key={`upcoming-${assignment.date}-${assignment.shiftType}-${idx}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border" style={{ background: idx === 0 ? meta.bg : CONCEPT_THEME.warmWhite, borderColor: `${meta.color}22` }}>
                            <div className="h-3.5 w-3.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold" style={{ color: CONCEPT_THEME.navy }}>{formatMemberShiftDate(assignment.date)}</div>
                              <div className="text-sm" style={{ color: CONCEPT_THEME.muted }}>{meta.label} ({meta.sub})</div>
                            </div>
                            <div className="text-xs font-semibold" style={{ color: CONCEPT_THEME.muted }}>{scheduleRelativeDayLabel(assignment.date)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl px-4 py-3 bg-white border" style={{ borderColor: CONCEPT_THEME.borderLight }}>
                  <h4 className="concept-font-display text-sm font-bold mb-2" style={{ color: CONCEPT_THEME.muted }}>
                    Completed ({schedulePastAssignments.length})
                  </h4>
                  {schedulePastAssignments.length === 0 ? (
                    <div className="text-sm" style={{ color: CONCEPT_THEME.muted }}>No completed shifts yet.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {schedulePastAssignments.map((assignment, idx) => {
                        const meta = SHIFT_UI_META[assignment.shiftType] || { label: assignment.shiftType, color: CONCEPT_THEME.muted };
                        return (
                          <div key={`past-${assignment.date}-${assignment.shiftType}-${idx}`} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg" style={{ background: CONCEPT_THEME.sand }}>
                            <div className="h-3 w-3 rounded-full" style={{ background: meta.color }} />
                            <span className="text-sm font-semibold" style={{ color: CONCEPT_THEME.text }}>{formatMemberShiftDate(assignment.date)}</span>
                            <span className="text-sm" style={{ color: CONCEPT_THEME.muted }}>{meta.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {scheduleMonths.map(([monthKey, dates]) => {
                  const [yearText, monthText] = monthKey.split('-');
                  const year = Number(yearText);
                  const month = Number(monthText) - 1;
                  const monthLabel = new Date(year, month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                  const firstDay = new Date(year, month, 1).getDay();
                  const blanks = Array.from({ length: firstDay }, (_, idx) => idx);
                  return (
                    <div key={monthKey} className="rounded-2xl px-4 py-3 bg-white border" style={{ borderColor: CONCEPT_THEME.borderLight }}>
                      <h4 className="concept-font-display text-sm font-bold mb-2" style={{ color: CONCEPT_THEME.navy }}>{monthLabel}</h4>
                      <div className="grid grid-cols-7 gap-1">
                        {CALENDAR_DAY_NAMES.map((dayName) => (
                          <div key={`${monthKey}-${dayName}`} className="py-1 text-center text-xs font-semibold" style={{ color: CONCEPT_THEME.muted }}>
                            {dayName}
                          </div>
                        ))}
                        {blanks.map((blank) => <div key={`${monthKey}-blank-${blank}`} />)}
                        {dates.map((dateStr) => {
                          const dayNum = Number(dateStr.slice(-2));
                          const isToday = dateStr === todayDate;
                          const assignments = memberAssignmentMapByDate[dateStr] || [];
                          return (
                            <div
                              key={dateStr}
                              className="rounded-lg min-h-[46px] px-1 py-1 text-center"
                              style={{
                                background: assignments.length > 0 ? CONCEPT_THEME.warmWhite : CONCEPT_THEME.cream,
                                border: isToday
                                  ? `2px solid ${CONCEPT_THEME.sky}`
                                  : assignments.length > 0
                                    ? `1px solid ${CONCEPT_THEME.border}`
                                    : `1px solid ${CONCEPT_THEME.borderLight}`,
                              }}
                            >
                              <div className="text-sm font-semibold" style={{ color: assignments.length > 0 ? CONCEPT_THEME.navy : CONCEPT_THEME.muted }}>
                                {dayNum}
                              </div>
                              {assignments.length > 0 && (
                                <div className="flex items-center justify-center gap-1 mt-1">
                                  {assignments.map((assignment, idx) => (
                                    <span
                                      key={`${dateStr}-${assignment.shiftType}-${idx}`}
                                      className="h-3 w-3 rounded-full"
                                      title={`${assignment.shiftType} (${SHIFT_UI_META[assignment.shiftType]?.label || assignment.shiftType})`}
                                      style={{ background: SHIFT_UI_META[assignment.shiftType]?.color || CONCEPT_THEME.muted }}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="flex flex-wrap items-center gap-4 px-1">
                  {SHIFT_ORDER.map((shiftType) => (
                    <div key={`legend-${shiftType}`} className="flex items-center gap-1.5 text-xs">
                      <span className="h-3.5 w-3.5 rounded-full" style={{ background: SHIFT_UI_META[shiftType]?.color || CONCEPT_THEME.muted }} />
                      <span style={{ color: CONCEPT_THEME.text }}>{SHIFT_UI_META[shiftType]?.label || shiftType}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
