import React from 'react';
import ShiftSlotCalendar from '../../components/ShiftSlotCalendar';
import { addDays } from '../../lib/dates';
import { CONCEPT_THEME } from '../../lib/theme';
import { useMockApp } from '../../lib/mock-state';

export default function RunCycles() {
  const { cycle, setCycle, setResults, results, toggleDateBlocked, toggleSlotBlocked, memberDirectory } = useMockApp();

  const applyCyclePatch = (patch) => {
    setCycle((prev) => {
      const next = { ...prev, ...patch };

      let startDate = next.startDate || prev.startDate || '';
      let endDate = next.endDate || prev.endDate || '';

      if (startDate && endDate && startDate > endDate) {
        if (patch.startDate !== undefined && patch.endDate === undefined) {
          endDate = startDate;
        } else if (patch.endDate !== undefined && patch.startDate === undefined) {
          startDate = endDate;
        } else {
          endDate = startDate;
        }
      }

      const preferenceDeadline = next.preferenceDeadline || addDays(startDate, -7);

      const blockedDates = (next.blockedDates || []).filter((date) => (
        (!startDate || date >= startDate) && (!endDate || date <= endDate)
      ));
      const blockedSlots = (next.blockedSlots || []).filter((entry) => {
        const [date] = String(entry).split(':');
        return (!startDate || date >= startDate) && (!endDate || date <= endDate);
      });

      return {
        ...next,
        startDate,
        endDate,
        preferenceDeadline,
        blockedDates,
        blockedSlots,
      };
    });
    setResults(null);
  };

  const preferredDeadline = cycle.preferenceDeadline || addDays(cycle.startDate, -7);

  return (
    <div className="space-y-4 concept-font-body">
      <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <h3 className="concept-font-display text-base font-bold mb-2" style={{ color: CONCEPT_THEME.navy }}>Availability Calendar Setup</h3>
        <p className="text-sm mb-4" style={{ color: CONCEPT_THEME.muted }}>
          Configure the cycle name, date range, submission deadline, and blocked availability before running scheduling.
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border p-3" style={{ background: CONCEPT_THEME.cream, borderColor: CONCEPT_THEME.border }}>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: CONCEPT_THEME.muted }}>
              Cycle Name
            </label>
            <input
              type="text"
              value={cycle.id || ''}
              onChange={(e) => applyCyclePatch({ id: e.target.value })}
              placeholder="2026-1"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ background: CONCEPT_THEME.warmWhite, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
            />
          </div>

          <div className="rounded-xl border p-3" style={{ background: CONCEPT_THEME.cream, borderColor: CONCEPT_THEME.border }}>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: CONCEPT_THEME.muted }}>
              Cycle Start Date
            </label>
            <input
              type="date"
              value={cycle.startDate || ''}
              max={cycle.endDate || undefined}
              onChange={(e) => applyCyclePatch({ startDate: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ background: CONCEPT_THEME.warmWhite, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
            />
          </div>

          <div className="rounded-xl border p-3" style={{ background: CONCEPT_THEME.cream, borderColor: CONCEPT_THEME.border }}>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: CONCEPT_THEME.muted }}>
              Cycle End Date
            </label>
            <input
              type="date"
              value={cycle.endDate || ''}
              min={cycle.startDate || undefined}
              onChange={(e) => applyCyclePatch({ endDate: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ background: CONCEPT_THEME.warmWhite, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
            />
          </div>

          <div className="rounded-xl border p-3" style={{ background: CONCEPT_THEME.cream, borderColor: CONCEPT_THEME.border }}>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: CONCEPT_THEME.muted }}>
              Preference Deadline
            </label>
            <input
              type="date"
              value={preferredDeadline}
              onChange={(e) => applyCyclePatch({ preferenceDeadline: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ background: CONCEPT_THEME.warmWhite, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <ShiftSlotCalendar
          cycle={cycle}
          assignments={results?.assignments || []}
          editable
          onToggleDateBlock={toggleDateBlocked}
          onToggleSlotBlock={toggleSlotBlocked}
          memberDirectory={memberDirectory}
          availabilityColorMode
          showShiftLegend={false}
        />
      </div>
    </div>
  );
}
