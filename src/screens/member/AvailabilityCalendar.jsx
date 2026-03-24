import React from 'react';
import ShiftSlotCalendar from '../../components/ShiftSlotCalendar';
import { useMockApp } from '../../lib/mock-state';

export default function AvailabilityCalendar() {
  const { hasAvailabilityCalendar, cycle, memberDirectory } = useMockApp();

  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <h3 className="mb-2 text-base font-semibold text-gray-800">Availability Calendar</h3>
      {!hasAvailabilityCalendar ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Availability calendar is not available yet. Admin has not configured the current run dates.
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="px-2 py-1 rounded border bg-emerald-50 text-emerald-700 border-emerald-100">Open = Green</span>
            <span className="px-2 py-1 rounded border bg-slate-100 text-slate-700 border-slate-300">Blocked = Grey</span>
            <span className="px-2 py-1 rounded border bg-gray-50 text-gray-700 border-gray-200">Each day shows DS1 / DS2 / NS</span>
          </div>
          <ShiftSlotCalendar cycle={cycle} assignments={[]} editable={false} memberDirectory={memberDirectory} availabilityColorMode />
        </>
      )}
    </div>
  );
}
