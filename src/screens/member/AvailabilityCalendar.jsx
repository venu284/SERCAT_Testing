import React, { useMemo } from 'react';
import ShiftSlotCalendar from '../../components/ShiftSlotCalendar';
import { CONCEPT_THEME } from '../../lib/theme';
import { useActiveCycle } from '../../hooks/useActiveCycle';
import { useAvailableDates, useMasterShares, useUsers } from '../../hooks/useApiData';
import { extractRows } from '../../lib/api';

export default function AvailabilityCalendar() {
  const { activeCycle, activeCycleId, isLoading: cycleLoading, error: cycleError } = useActiveCycle();
  const datesQuery = useAvailableDates(activeCycleId);
  const sharesQuery = useMasterShares();
  const usersQuery = useUsers({ all: true });

  const cycleProp = useMemo(() => {
    if (!activeCycle) return null;

    const blockedDates = extractRows(datesQuery.data)
      .filter((entry) => !entry?.isAvailable)
      .map((entry) => entry.date);

    return {
      id: activeCycle.name || activeCycle.id,
      startDate: activeCycle.startDate,
      endDate: activeCycle.endDate,
      blockedDates,
      blockedSlots: [],
    };
  }, [activeCycle, datesQuery.data]);

  const hasAvailabilityCalendar = Boolean(
    cycleProp?.startDate
      && cycleProp?.endDate
      && cycleProp.startDate <= cycleProp.endDate,
  );

  const memberDirectory = useMemo(() => {
    const shareRows = extractRows(sharesQuery.data);
    const userRows = extractRows(usersQuery.data);
    const usersById = new Map(userRows.map((user) => [user.id, user]));
    const directory = {};

    shareRows.forEach((share) => {
      const key = share.institutionAbbreviation || share.institutionId;
      if (!key) return;

      const user = usersById.get(share.piId) || {};
      directory[key] = {
        id: key,
        name: share.institutionName || key,
        shares: Number(share.wholeShares || 0) + Number(share.fractionalShares || 0),
        piName: share.piName || user.name || '',
        piEmail: share.piEmail || user.email || '',
      };
    });

    return directory;
  }, [sharesQuery.data, usersQuery.data]);

  const isLoading = cycleLoading || datesQuery.isLoading || sharesQuery.isLoading || usersQuery.isLoading;
  const error = cycleError || datesQuery.error || sharesQuery.error || usersQuery.error;

  const adminNotes = activeCycle?.notes?.trim() || '';

  const timingExceptions = useMemo(() => {
    if (!activeCycle?.shiftTimingOverrides) return [];
    try { return JSON.parse(activeCycle.shiftTimingOverrides); } catch { return []; }
  }, [activeCycle?.shiftTimingOverrides]);

  return (
    <div className="space-y-3">
      {adminNotes ? (
        <div className="rounded-xl border px-4 py-3" style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border }}>
          <p className="mb-1 text-sm font-bold uppercase tracking-wide" style={{ color: CONCEPT_THEME.navy }}>Admin Notice</p>
          <p className="text-lg whitespace-pre-wrap" style={{ color: CONCEPT_THEME.text }}>{adminNotes}</p>
        </div>
      ) : null}

      {timingExceptions.length > 0 ? (
        <div className="rounded-xl border px-4 py-3" style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border }}>
          <p className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: CONCEPT_THEME.navy }}>Shift Timing Changes</p>
          <div className="space-y-1">
            {[...timingExceptions].sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift)).map((o) => (
              <p key={`${o.date}-${o.shift}`} className="text-base" style={{ color: CONCEPT_THEME.text }}>
                <span className="font-semibold">{o.date} {o.shift}:</span> {o.startTime} – {o.endTime}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border bg-white p-4 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <h3 className="concept-font-display text-2xl font-bold" style={{ color: CONCEPT_THEME.navy }}>Availability Calendar</h3>
        {isLoading ? (
          <div className="py-8 text-center text-base" style={{ color: CONCEPT_THEME.muted }}>
            Loading availability calendar...
          </div>
        ) : error ? (
          <div className="rounded border p-3 text-base" style={{ borderColor: `${CONCEPT_THEME.error}33`, background: CONCEPT_THEME.errorLight, color: CONCEPT_THEME.error }}>
            {error.message || 'Unable to load the availability calendar right now.'}
          </div>
        ) : !hasAvailabilityCalendar ? (
          <div className="rounded border p-3 text-base" style={{ borderColor: `${CONCEPT_THEME.amber}33`, background: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.accentOnAccent }}>
            Availability calendar is not available yet. Admin has not configured the current run dates.
          </div>
        ) : (
          <>
            <div className="mb-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-base">
                <span className="px-2 py-1 rounded border bg-emerald-50 text-emerald-700 border-emerald-100">Open = available for scheduling</span>
                <span className="px-2 py-1 rounded border bg-rose-100 text-rose-700 border-rose-200">Blocked = unavailable (set by admin)</span>
                <span className="px-2 py-1 rounded border" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text, borderColor: CONCEPT_THEME.border }}>Each day shows DS1 / DS2 / NS</span>
              </div>
              <div className="rounded-xl border px-3 py-2 text-sm" style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.muted }}>
                Blocked dates are configured by the SERCAT admin for maintenance windows, holidays, or operational constraints.
              </div>
            </div>
            <ShiftSlotCalendar cycle={cycleProp} assignments={[]} editable={false} memberDirectory={memberDirectory} availabilityColorMode />
          </>
        )}
      </div>
    </div>
  );
}
