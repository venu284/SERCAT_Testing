import React, { useMemo } from 'react';
import ShiftSlotCalendar from '../../components/ShiftSlotCalendar';
import { CONCEPT_THEME } from '../../lib/theme';
import { useActiveCycle } from '../../hooks/useActiveCycle';
import { useAvailableDates, useMasterShares, useUsers } from '../../hooks/useApiData';

function extractRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

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

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
      <h3 className="mb-2 text-base font-semibold" style={{ color: CONCEPT_THEME.navy }}>Availability Calendar</h3>
      {isLoading ? (
        <div className="py-8 text-center text-sm" style={{ color: CONCEPT_THEME.muted }}>
          Loading availability calendar...
        </div>
      ) : error ? (
        <div className="rounded border p-3 text-sm" style={{ borderColor: `${CONCEPT_THEME.error}33`, background: CONCEPT_THEME.errorLight, color: CONCEPT_THEME.error }}>
          {error.message || 'Unable to load the availability calendar right now.'}
        </div>
      ) : !hasAvailabilityCalendar ? (
        <div className="rounded border p-3 text-sm" style={{ borderColor: `${CONCEPT_THEME.amber}33`, background: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.accentOnAccent }}>
          Availability calendar is not available yet. Admin has not configured the current run dates.
        </div>
      ) : (
        <>
          <div className="mb-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="px-2 py-1 rounded border bg-emerald-50 text-emerald-700 border-emerald-100">Open = available for scheduling</span>
              <span className="px-2 py-1 rounded border bg-rose-100 text-rose-700 border-rose-200">Blocked = unavailable (set by admin)</span>
              <span className="px-2 py-1 rounded border" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text, borderColor: CONCEPT_THEME.border }}>Each day shows DS1 / DS2 / NS</span>
            </div>
            <div className="rounded-xl border px-3 py-2 text-xs" style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.muted }}>
              Blocked dates are configured by the SERCAT admin for maintenance windows, holidays, or operational constraints.
              If you believe a date should be available, contact{' '}
              <a href="mailto:admin@ser-cat.org" className="font-semibold" style={{ color: CONCEPT_THEME.sky }}>admin@ser-cat.org</a>.
            </div>
          </div>
          <ShiftSlotCalendar cycle={cycleProp} assignments={[]} editable={false} memberDirectory={memberDirectory} availabilityColorMode />
        </>
      )}
    </div>
  );
}
