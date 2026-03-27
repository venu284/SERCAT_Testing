import React from 'react';
import ShiftSlotCalendar from '../../components/ShiftSlotCalendar';
import { CONCEPT_THEME } from '../../lib/theme';
import { useMockApp } from '../../lib/mock-state';

export default function AvailabilityCalendar() {
  const { hasAvailabilityCalendar, cycle, memberDirectory } = useMockApp();

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
      <h3 className="mb-2 text-base font-semibold" style={{ color: CONCEPT_THEME.navy }}>Availability Calendar</h3>
      {!hasAvailabilityCalendar ? (
        <div className="rounded border p-3 text-sm" style={{ borderColor: `${CONCEPT_THEME.amber}33`, background: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.accentOnAccent }}>
          Availability calendar is not available yet. Admin has not configured the current run dates.
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="px-2 py-1 rounded border bg-emerald-50 text-emerald-700 border-emerald-100">Open = Green</span>
            <span className="px-2 py-1 rounded border bg-rose-100 text-rose-700 border-rose-200">Blocked = Red</span>
            <span className="px-2 py-1 rounded border" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text, borderColor: CONCEPT_THEME.border }}>Each day shows DS1 / DS2 / NS</span>
          </div>
          <ShiftSlotCalendar cycle={cycle} assignments={[]} editable={false} memberDirectory={memberDirectory} availabilityColorMode />
        </>
      )}
    </div>
  );
}
