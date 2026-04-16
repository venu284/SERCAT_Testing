import React from 'react';
import { CONCEPT_THEME } from '../../lib/theme';
import { daysBetweenSigned, formatCalendarDate, fromDateStr, localTodayDateStr } from '../../lib/dates';
import { SHIFT_ORDER, SHIFT_TIME_LABELS } from '../../lib/constants';
import { useActiveCycle } from '../../hooks/useActiveCycle';
import { useMemberDashboardContext } from '../../hooks/useMemberDashboardContext';

function StatusCard({ title, detail }) {
  return (
    <div
      className="rounded-2xl px-6 py-5 concept-font-body concept-anim-fade"
      style={{ background: CONCEPT_THEME.warmWhite, border: `1px solid ${CONCEPT_THEME.borderLight}` }}
    >
      <h2 className="concept-font-display text-2xl font-bold" style={{ color: CONCEPT_THEME.navy }}>{title}</h2>
      <p className="mt-2 text-base" style={{ color: CONCEPT_THEME.muted }}>{detail}</p>
    </div>
  );
}

export default function MySchedule() {
  const { activeCycle, isLoading: cycleLoading, error: cycleError } = useActiveCycle();
  const {
    member,
    currentMemberAssignments,
    memberShiftCounts,
    schedulePublication,
    isLoading,
    error,
  } = useMemberDashboardContext();
  const [exportError, setExportError] = React.useState('');

  const cycle = React.useMemo(() => ({
    id: activeCycle?.name || activeCycle?.id || '',
    startDate: activeCycle?.startDate || '',
    endDate: activeCycle?.endDate || '',
  }), [activeCycle]);

  const hasGeneratedSchedule = schedulePublication.status === 'draft' || schedulePublication.status === 'published';
  const hasGeneratedScheduleForCurrentMember = currentMemberAssignments.length > 0;

  const sortedCurrentMemberAssignments = React.useMemo(
    () => [...currentMemberAssignments].sort((left, right) => {
      const dateDelta = String(left.assignedDate || '').localeCompare(String(right.assignedDate || ''));
      if (dateDelta !== 0) return dateDelta;
      return SHIFT_ORDER.indexOf(left.shift) - SHIFT_ORDER.indexOf(right.shift);
    }),
    [currentMemberAssignments],
  );

  const todayDate = localTodayDateStr();

  const scheduleUpcomingAssignments = React.useMemo(
    () => sortedCurrentMemberAssignments.filter((assignment) => String(assignment.assignedDate || '') >= todayDate),
    [sortedCurrentMemberAssignments, todayDate],
  );

  const schedulePastAssignments = React.useMemo(
    () => sortedCurrentMemberAssignments.filter((assignment) => String(assignment.assignedDate || '') < todayDate),
    [sortedCurrentMemberAssignments, todayDate],
  );

  const nextUpcomingAssignment = scheduleUpcomingAssignments[0] || null;

  const formatMemberShiftDate = React.useCallback((dateStr) => {
    if (!dateStr) return 'N/A';
    return fromDateStr(dateStr).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  const formatMemberShiftTiming = React.useCallback(
    (shift) => SHIFT_TIME_LABELS[shift] || shift || 'Unassigned',
    [],
  );

  const scheduleRelativeDayLabel = React.useCallback((dateStr) => {
    const delta = daysBetweenSigned(todayDate, dateStr);
    if (delta === 0) return 'Today';
    if (delta === 1) return 'Tomorrow';
    if (delta > 1) return `In ${delta} days`;
    if (delta === -1) return 'Yesterday';
    return `${Math.abs(delta)} days ago`;
  }, [todayDate]);

  const handleExportPdf = () => {
    setExportError('PDF export will be available soon.');
  };

  if (cycleLoading || isLoading) {
    return (
      <StatusCard
        title="Loading schedule..."
        detail="Fetching your active cycle and current assignments."
      />
    );
  }

  if (cycleError || error) {
    return (
      <StatusCard
        title="Unable to load schedule"
        detail={(cycleError || error)?.message || 'Please try again in a moment.'}
      />
    );
  }

  if (!activeCycle || !member) {
    return (
      <StatusCard
        title="Schedule unavailable"
        detail={!activeCycle ? 'No active cycle is available yet.' : 'Your member record is not available yet.'}
      />
    );
  }

  return (
    <div className="space-y-4 concept-font-body">
      <div className="rounded-2xl border bg-white px-5 py-4 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="concept-font-display text-lg font-bold" style={{ color: CONCEPT_THEME.navy }}>My Schedule</h3>
            <p className="mt-1 text-sm" style={{ color: CONCEPT_THEME.text }}>
              {formatCalendarDate(cycle.startDate)} - {formatCalendarDate(cycle.endDate)} | Cycle {cycle.id}
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportPdf}
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

        {exportError ? (
          <div className="mb-3 rounded-xl border px-3 py-2 text-sm" style={{ background: CONCEPT_THEME.errorLight, borderColor: `${CONCEPT_THEME.error}33`, color: CONCEPT_THEME.error }}>
            {exportError}
          </div>
        ) : null}

        {!hasGeneratedSchedule ? (
          <div className="text-sm" style={{ color: CONCEPT_THEME.muted }}>
            Schedule not generated yet. Current status: draft.
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { label: 'Total Shifts', value: sortedCurrentMemberAssignments.length, color: CONCEPT_THEME.navy, bg: CONCEPT_THEME.sand },
                { label: 'Morning', value: memberShiftCounts.DS1 || 0, color: CONCEPT_THEME.morning, bg: CONCEPT_THEME.morningBg },
                { label: 'Afternoon', value: memberShiftCounts.DS2 || 0, color: CONCEPT_THEME.afternoon, bg: CONCEPT_THEME.afternoonBg },
                { label: 'Night', value: memberShiftCounts.NS || 0, color: CONCEPT_THEME.night, bg: CONCEPT_THEME.nightBg },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl px-3 py-2.5" style={{ background: stat.bg }}>
                  <div className="text-lg font-bold leading-none" style={{ color: stat.color }}>{stat.value}</div>
                  <div className="mt-1 text-xs font-semibold" style={{ color: stat.color }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {!hasGeneratedScheduleForCurrentMember ? (
              <div className="rounded-xl px-3 py-2 text-sm" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.muted }}>
                No shifts assigned to your account for this cycle yet.
              </div>
            ) : null}

            <div className="space-y-4">
              {nextUpcomingAssignment ? (
                <div className="rounded-2xl px-5 py-4" style={{ background: `linear-gradient(135deg, ${CONCEPT_THEME.navy} 0%, ${CONCEPT_THEME.navyLight} 100%)`, border: `1px solid ${CONCEPT_THEME.navyLight}` }}>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: CONCEPT_THEME.accentText }}>Next Shift</div>
                  <div className="concept-font-display text-xl font-bold text-white">{formatMemberShiftDate(nextUpcomingAssignment.assignedDate)}</div>
                  <div className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>
                    {formatMemberShiftTiming(nextUpcomingAssignment.shift)} | {scheduleRelativeDayLabel(nextUpcomingAssignment.assignedDate)}
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border bg-white px-4 py-3" style={{ borderColor: CONCEPT_THEME.borderLight }}>
                <h4 className="concept-font-display mb-2 text-sm font-bold" style={{ color: CONCEPT_THEME.navy }}>
                  Upcoming ({scheduleUpcomingAssignments.length})
                </h4>
                {scheduleUpcomingAssignments.length === 0 ? (
                  <div className="text-sm" style={{ color: CONCEPT_THEME.muted }}>No upcoming shifts.</div>
                ) : (
                  <div className="space-y-2">
                    {scheduleUpcomingAssignments.map((assignment, idx) => {
                      const isPrimary = idx === 0;
                      return (
                        <div
                          key={`upcoming-${assignment.assignedDate}-${assignment.shift}-${idx}`}
                          className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                          style={{
                            background: isPrimary ? CONCEPT_THEME.sand : CONCEPT_THEME.warmWhite,
                            borderColor: isPrimary ? CONCEPT_THEME.border : CONCEPT_THEME.borderLight,
                          }}
                        >
                          <div className="h-3.5 w-3.5 rounded-full flex-shrink-0" style={{ background: CONCEPT_THEME.navy }} />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold" style={{ color: CONCEPT_THEME.navy }}>{formatMemberShiftDate(assignment.assignedDate)}</div>
                            <div className="text-sm" style={{ color: CONCEPT_THEME.muted }}>{formatMemberShiftTiming(assignment.shift)}</div>
                          </div>
                          <div className="text-xs font-semibold" style={{ color: CONCEPT_THEME.muted }}>{scheduleRelativeDayLabel(assignment.assignedDate)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border bg-white px-4 py-3" style={{ borderColor: CONCEPT_THEME.borderLight }}>
                <h4 className="concept-font-display mb-2 text-sm font-bold" style={{ color: CONCEPT_THEME.text }}>
                  Completed ({schedulePastAssignments.length})
                </h4>
                {schedulePastAssignments.length === 0 ? (
                  <div className="text-sm" style={{ color: CONCEPT_THEME.muted }}>No completed shifts yet.</div>
                ) : (
                  <div className="space-y-1.5">
                    {schedulePastAssignments.map((assignment, idx) => (
                      <div key={`past-${assignment.assignedDate}-${assignment.shift}-${idx}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5" style={{ background: CONCEPT_THEME.sand }}>
                        <div className="h-3 w-3 rounded-full" style={{ background: CONCEPT_THEME.text }} />
                        <span className="text-sm font-semibold" style={{ color: CONCEPT_THEME.text }}>{formatMemberShiftDate(assignment.assignedDate)}</span>
                        <span className="text-sm" style={{ color: CONCEPT_THEME.text }}>{formatMemberShiftTiming(assignment.shift)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
