import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useActiveCycle } from '../../hooks/useActiveCycle';
import { useSchedule } from '../../hooks/useApiData';
import { CONCEPT_THEME } from '../../lib/theme';
import { daysBetweenSigned, formatCalendarDate, fromDateStr, localTodayDateStr } from '../../lib/dates';
import { SHIFT_ORDER, SHIFT_TIME_LABELS } from '../../lib/constants';

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
  const { user } = useAuth();
  const { activeCycle, isLoading: cycleLoading, error: cycleError } = useActiveCycle();
  const scheduleQuery = useSchedule(activeCycle?.id ?? null, { staleTime: 0 });
  const [exportError, setExportError] = React.useState('');

  const scheduleData = scheduleQuery.data || null;
  const isPublished = scheduleData?.status === 'published';
  const assignments = isPublished && Array.isArray(scheduleData?.assignments)
    ? scheduleData.assignments
    : [];

  const todayDate = localTodayDateStr();

  const sorted = React.useMemo(
    () => [...assignments].sort((a, b) => {
      const d = String(a.assignedDate || '').localeCompare(String(b.assignedDate || ''));
      return d !== 0 ? d : SHIFT_ORDER.indexOf(a.shift) - SHIFT_ORDER.indexOf(b.shift);
    }),
    [assignments],
  );

  const upcoming = React.useMemo(
    () => sorted.filter((a) => String(a.assignedDate || '') >= todayDate),
    [sorted, todayDate],
  );

  const past = React.useMemo(
    () => sorted.filter((a) => String(a.assignedDate || '') < todayDate),
    [sorted, todayDate],
  );

  const shiftCounts = React.useMemo(
    () => assignments.reduce(
      (acc, a) => { if (a.shift in acc) acc[a.shift] += 1; return acc; },
      { DS1: 0, DS2: 0, NS: 0 },
    ),
    [assignments],
  );

  const formatShiftDate = React.useCallback((dateStr) => {
    if (!dateStr) return 'N/A';
    return fromDateStr(dateStr).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  const formatShiftTiming = React.useCallback(
    (shift) => SHIFT_TIME_LABELS[shift] || shift || 'Unassigned',
    [],
  );

  const relativeLabel = React.useCallback((dateStr) => {
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

  if (cycleLoading || scheduleQuery.isLoading) {
    return <StatusCard title="Loading schedule..." detail="Fetching your assignments." />;
  }

  if (cycleError || scheduleQuery.error) {
    return (
      <StatusCard
        title="Unable to load schedule"
        detail={(cycleError || scheduleQuery.error)?.message || 'Please try again in a moment.'}
      />
    );
  }

  if (!activeCycle) {
    return <StatusCard title="Schedule unavailable" detail="No active cycle is available yet." />;
  }

  if (!user) {
    return <StatusCard title="Schedule unavailable" detail="Not signed in." />;
  }

  const cycleLabel = activeCycle.name || activeCycle.id || '';
  const nextUpcoming = upcoming[0] || null;

  return (
    <div className="space-y-4 concept-font-body">
      <div className="rounded-2xl border bg-white px-5 py-4 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="concept-font-display text-lg font-bold" style={{ color: CONCEPT_THEME.navy }}>My Schedule</h3>
            <p className="mt-1 text-sm" style={{ color: CONCEPT_THEME.text }}>
              {formatCalendarDate(activeCycle.startDate)} - {formatCalendarDate(activeCycle.endDate)} | Cycle {cycleLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={!isPublished}
            className="rounded-xl px-4 py-2 text-sm font-bold transition-all disabled:cursor-not-allowed"
            style={{
              background: isPublished ? CONCEPT_THEME.navy : CONCEPT_THEME.sandDark,
              color: isPublished ? 'white' : CONCEPT_THEME.text,
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

        {!isPublished ? (
          <div className="text-sm" style={{ color: CONCEPT_THEME.muted }}>
            Schedule has not been published yet.
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { label: 'Total Shifts', value: sorted.length, color: CONCEPT_THEME.navy, bg: CONCEPT_THEME.sand },
                { label: 'Morning', value: shiftCounts.DS1, color: CONCEPT_THEME.morning, bg: CONCEPT_THEME.morningBg },
                { label: 'Afternoon', value: shiftCounts.DS2, color: CONCEPT_THEME.afternoon, bg: CONCEPT_THEME.afternoonBg },
                { label: 'Night', value: shiftCounts.NS, color: CONCEPT_THEME.night, bg: CONCEPT_THEME.nightBg },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl px-3 py-2.5" style={{ background: stat.bg }}>
                  <div className="text-lg font-bold leading-none" style={{ color: stat.color }}>{stat.value}</div>
                  <div className="mt-1 text-xs font-semibold" style={{ color: stat.color }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {sorted.length === 0 ? (
              <div className="rounded-xl px-3 py-2 text-sm" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.muted }}>
                No shifts assigned to your account for this cycle yet.
              </div>
            ) : null}

            <div className="space-y-4">
              {nextUpcoming ? (
                <div className="rounded-2xl px-5 py-4" style={{ background: `linear-gradient(135deg, ${CONCEPT_THEME.navy} 0%, ${CONCEPT_THEME.navyLight} 100%)`, border: `1px solid ${CONCEPT_THEME.navyLight}` }}>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: CONCEPT_THEME.accentText }}>Next Shift</div>
                  <div className="concept-font-display text-xl font-bold text-white">{formatShiftDate(nextUpcoming.assignedDate)}</div>
                  <div className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>
                    {formatShiftTiming(nextUpcoming.shift)} | {relativeLabel(nextUpcoming.assignedDate)}
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border bg-white px-4 py-3" style={{ borderColor: CONCEPT_THEME.borderLight }}>
                <h4 className="concept-font-display mb-2 text-sm font-bold" style={{ color: CONCEPT_THEME.navy }}>
                  Upcoming ({upcoming.length})
                </h4>
                {upcoming.length === 0 ? (
                  <div className="text-sm" style={{ color: CONCEPT_THEME.muted }}>No upcoming shifts.</div>
                ) : (
                  <div className="space-y-2">
                    {upcoming.map((assignment, idx) => {
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
                            <div className="text-sm font-semibold" style={{ color: CONCEPT_THEME.navy }}>{formatShiftDate(assignment.assignedDate)}</div>
                            <div className="text-sm" style={{ color: CONCEPT_THEME.muted }}>{formatShiftTiming(assignment.shift)}</div>
                          </div>
                          <div className="text-xs font-semibold" style={{ color: CONCEPT_THEME.muted }}>{relativeLabel(assignment.assignedDate)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border bg-white px-4 py-3" style={{ borderColor: CONCEPT_THEME.borderLight }}>
                <h4 className="concept-font-display mb-2 text-sm font-bold" style={{ color: CONCEPT_THEME.text }}>
                  Completed ({past.length})
                </h4>
                {past.length === 0 ? (
                  <div className="text-sm" style={{ color: CONCEPT_THEME.muted }}>No completed shifts yet.</div>
                ) : (
                  <div className="space-y-1.5">
                    {past.map((assignment, idx) => (
                      <div key={`past-${assignment.assignedDate}-${assignment.shift}-${idx}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5" style={{ background: CONCEPT_THEME.sand }}>
                        <div className="h-3 w-3 rounded-full" style={{ background: CONCEPT_THEME.text }} />
                        <span className="text-sm font-semibold" style={{ color: CONCEPT_THEME.text }}>{formatShiftDate(assignment.assignedDate)}</span>
                        <span className="text-sm" style={{ color: CONCEPT_THEME.text }}>{formatShiftTiming(assignment.shift)}</span>
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
