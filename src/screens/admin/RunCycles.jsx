import React from 'react';
import ShiftSlotCalendar from '../../components/ShiftSlotCalendar';
import { addDays } from '../../lib/dates';
import { useMockApp } from '../../lib/mock-state';

export default function RunCycles() {
  const { cycle, setCycle, results, toggleDateBlocked, toggleSlotBlocked, memberDirectory } = useMockApp();

  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <h3 className="font-semibold text-gray-800 mb-2 text-sm">Run Cycles Management - Availability Setup</h3>
      <p className="text-xs text-gray-500 mb-3">Configure blocked dates, blocked shift slots, and member submission deadline.</p>
      <div className="grid grid-cols-1 gap-2 text-xs mb-3">
        <div className="rounded border border-gray-200 bg-gray-50 p-2">
          <label className="block text-gray-600 mb-1">Preference Deadline</label>
          <input
            type="date"
            value={cycle.preferenceDeadline || addDays(cycle.startDate, -7)}
            onChange={(e) => setCycle((prev) => ({ ...prev, preferenceDeadline: e.target.value }))}
            className="w-full md:w-64 border rounded px-2 py-1.5"
          />
        </div>
      </div>
      <ShiftSlotCalendar cycle={cycle} assignments={results?.assignments || []} editable onToggleDateBlock={toggleDateBlocked} onToggleSlotBlock={toggleSlotBlocked} memberDirectory={memberDirectory} availabilityColorMode />
    </div>
  );
}
