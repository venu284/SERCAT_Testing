import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ShiftSlotCalendar from '../../components/ShiftSlotCalendar';
import { addDays, generateDateRange } from '../../lib/dates';
import { CONCEPT_THEME } from '../../lib/theme';
import { useActiveCycle } from '../../hooks/useActiveCycle';
import {
  useAvailableDates,
  useCreateCycle,
  useMasterShares,
  useSchedule,
  useSetAvailableDates,
  useUpdateCycle,
  useUsers,
} from '../../hooks/useApiData';
import { extractRows } from '../../lib/api';
import { SHIFT_ORDER, SHIFT_LABELS } from '../../lib/constants';

const EMPTY_CYCLE = {
  id: '',
  startDate: '',
  endDate: '',
  preferenceDeadline: '',
};

const EMPTY_EXCEPTION = { date: '', shift: 'DS1', startTime: '', endTime: '' };

function parseOverrides(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

const SHIFT_COLUMN_MAP = { DS1: 'ds1Available', DS2: 'ds2Available', NS: 'nsAvailable' };


function buildMemberDirectory(sharesData, usersData) {
  const dir = {};
  const shares = extractRows(sharesData);
  const users = extractRows(usersData);
  const userMap = {};
  users.forEach((user) => {
    userMap[user.id] = user;
  });

  shares.forEach((share) => {
    const abbr = share.institutionAbbreviation || share.abbreviation || share.institutionId;
    if (!abbr) return;
    const user = userMap[share.piId] || {};
    if (!dir[abbr]) {
      dir[abbr] = {
        id: abbr,
        name: share.institutionName || abbr,
        piName: user.name || share.piName || '',
        piEmail: user.email || share.piEmail || '',
        shares: Number(share.wholeShares || 0) + Number(share.fractionalShares || 0),
        status: share.isActive === false ? 'DEACTIVATED' : 'ACTIVE',
      };
    }
  });

  return dir;
}

function buildInitialFormCycle(activeCycle) {
  if (!activeCycle) return EMPTY_CYCLE;
  let preferenceDeadline = activeCycle.preferenceDeadline || '';
  if (preferenceDeadline && preferenceDeadline.includes('T')) {
    preferenceDeadline = preferenceDeadline.split('T')[0];
  }

  return {
    id: activeCycle.name || activeCycle.id || '',
    startDate: activeCycle.startDate || '',
    endDate: activeCycle.endDate || '',
    preferenceDeadline,
  };
}

function buildRowMap(dateRows, startDate, endDate) {
  const rowMap = {};
  if (!startDate || !endDate) return rowMap;

  generateDateRange(startDate, endDate).forEach((date) => {
    rowMap[date] = {
      date,
      isAvailable: true,
      ds1Available: true,
      ds2Available: true,
      nsAvailable: true,
    };
  });

  dateRows.forEach((row) => {
    if (rowMap[row.date]) {
      rowMap[row.date] = {
        date: row.date,
        isAvailable: row.isAvailable,
        ds1Available: row.ds1Available ?? true,
        ds2Available: row.ds2Available ?? true,
        nsAvailable: row.nsAvailable ?? true,
      };
    }
  });

  return rowMap;
}

export default function RunCycles() {
  const { activeCycle, activeCycleId, isLoading: cycleLoading, error: cycleError } = useActiveCycle();
  const datesQuery = useAvailableDates(activeCycleId);
  const setDatesMutation = useSetAvailableDates();
  const updateCycleMutation = useUpdateCycle();
  const createCycleMutation = useCreateCycle();
  const sharesQuery = useMasterShares();
  const usersQuery = useUsers({ all: true });
  const scheduleQuery = useSchedule(activeCycleId);
  const [formCycle, setFormCycle] = useState(EMPTY_CYCLE);
  const createTriggeredRef = useRef(false);
  const [notesValue, setNotesValue] = useState('');
  const [newException, setNewException] = useState(EMPTY_EXCEPTION);

  useEffect(() => {
    setFormCycle(buildInitialFormCycle(activeCycle));
    if (activeCycleId) {
      createTriggeredRef.current = false;
    }
  }, [activeCycle, activeCycleId]);

  useEffect(() => {
    setNotesValue(activeCycle?.notes || '');
  }, [activeCycle?.notes]);

  const dateRows = useMemo(() => {
    const raw = extractRows(datesQuery.data);
    return raw.map((entry) => ({
      date: entry.date,
      isAvailable: entry.isAvailable,
      ds1Available: entry.ds1Available ?? true,
      ds2Available: entry.ds2Available ?? true,
      nsAvailable: entry.nsAvailable ?? true,
    }));
  }, [datesQuery.data]);

  const cycle = useMemo(() => {
    if (!activeCycle) {
      return {
        ...formCycle,
        blockedDates: [],
        blockedSlots: [],
        _dbId: null,
        _status: '',
      };
    }

    const blockedDates = [];
    const blockedSlots = [];
    dateRows.forEach((entry) => {
      if (!entry.isAvailable) {
        blockedDates.push(entry.date);
      } else {
        if (!entry.ds1Available) blockedSlots.push(`${entry.date}:DS1`);
        if (!entry.ds2Available) blockedSlots.push(`${entry.date}:DS2`);
        if (!entry.nsAvailable) blockedSlots.push(`${entry.date}:NS`);
      }
    });

    return {
      ...formCycle,
      blockedDates: blockedDates.sort(),
      blockedSlots: blockedSlots.sort(),
      _dbId: activeCycle.id,
      _status: activeCycle.status,
    };
  }, [activeCycle, dateRows, formCycle]);

  const results = useMemo(() => {
    const schedule = scheduleQuery.data;
    if (!schedule || !Array.isArray(schedule.assignments)) return null;
    return { assignments: schedule.assignments };
  }, [scheduleQuery.data]);

  const memberDirectory = useMemo(
    () => buildMemberDirectory(sharesQuery.data, usersQuery.data),
    [sharesQuery.data, usersQuery.data],
  );

  const persistDates = useCallback((updatedRows, cycleIdOverride = activeCycleId) => {
    if (!cycleIdOverride) return;
    setDatesMutation.mutate({
      cycleId: cycleIdOverride,
      dates: updatedRows.map((row) => ({
        date: row.date,
        isAvailable: row.isAvailable,
        ds1Available: row.ds1Available,
        ds2Available: row.ds2Available,
        nsAvailable: row.nsAvailable,
      })),
    });
  }, [activeCycleId, setDatesMutation]);

  const applyCyclePatch = useCallback((patch) => {
    setFormCycle((prev) => {
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

      const preferenceDeadline = next.preferenceDeadline || (startDate ? addDays(startDate, -7) : '');
      const normalized = {
        ...next,
        startDate,
        endDate,
        preferenceDeadline,
      };

      if (!activeCycleId) {
        const canCreate = normalized.id && normalized.startDate && normalized.endDate && normalized.preferenceDeadline;
        if (canCreate && !createCycleMutation.isPending && !createTriggeredRef.current) {
          createTriggeredRef.current = true;
          createCycleMutation.mutate({
            name: normalized.id,
            startDate: normalized.startDate,
            endDate: normalized.endDate,
            preferenceDeadline: normalized.preferenceDeadline,
          });
        }
        return normalized;
      }

      const updates = {};
      if (patch.id !== undefined) updates.name = normalized.id;
      if (patch.startDate !== undefined) updates.startDate = normalized.startDate;
      if (patch.endDate !== undefined) updates.endDate = normalized.endDate;
      if (patch.preferenceDeadline !== undefined) updates.preferenceDeadline = normalized.preferenceDeadline;

      if (Object.keys(updates).length > 0) {
        updateCycleMutation.mutate({ id: activeCycleId, ...updates });
      }

      if ((patch.startDate !== undefined || patch.endDate !== undefined) && normalized.startDate && normalized.endDate) {
        const rowMap = buildRowMap(dateRows, normalized.startDate, normalized.endDate);
        persistDates(Object.values(rowMap).sort((left, right) => left.date.localeCompare(right.date)));
      }

      return normalized;
    });
  }, [activeCycleId, createCycleMutation, dateRows, persistDates, updateCycleMutation]);

  const toggleDateBlocked = useCallback((date) => {
    if (!activeCycleId || !cycle.startDate || !cycle.endDate) return;

    const rowMap = buildRowMap(dateRows, cycle.startDate, cycle.endDate);
    if (!rowMap[date]) return;

    rowMap[date].isAvailable = !rowMap[date].isAvailable;
    if (!rowMap[date].isAvailable) {
      rowMap[date].ds1Available = false;
      rowMap[date].ds2Available = false;
      rowMap[date].nsAvailable = false;
    } else {
      rowMap[date].ds1Available = true;
      rowMap[date].ds2Available = true;
      rowMap[date].nsAvailable = true;
    }

    persistDates(Object.values(rowMap).sort((left, right) => left.date.localeCompare(right.date)));
  }, [activeCycleId, cycle.endDate, cycle.startDate, dateRows, persistDates]);

  const saveNotes = useCallback((value) => {
    if (!activeCycleId) return;
    updateCycleMutation.mutate({ id: activeCycleId, notes: value });
  }, [activeCycleId, updateCycleMutation]);

  const overrides = useMemo(() => parseOverrides(activeCycle?.shiftTimingOverrides), [activeCycle?.shiftTimingOverrides]);

  const persistOverrides = useCallback((updated) => {
    if (!activeCycleId) return;
    updateCycleMutation.mutate({ id: activeCycleId, shiftTimingOverrides: JSON.stringify(updated) });
  }, [activeCycleId, updateCycleMutation]);

  const addException = useCallback(() => {
    const { date, shift, startTime, endTime } = newException;
    if (!date || !shift || !startTime || !endTime) return;
    const existing = overrides.filter((o) => !(o.date === date && o.shift === shift));
    persistOverrides([...existing, { date, shift, startTime, endTime }]);
    setNewException(EMPTY_EXCEPTION);
  }, [newException, overrides, persistOverrides]);

  const deleteException = useCallback((date, shift) => {
    persistOverrides(overrides.filter((o) => !(o.date === date && o.shift === shift)));
  }, [overrides, persistOverrides]);

  const toggleSlotBlocked = useCallback((date, shift) => {
    if (!activeCycleId || !cycle.startDate || !cycle.endDate) return;

    const column = SHIFT_COLUMN_MAP[shift];
    if (!column) return;

    const rowMap = buildRowMap(dateRows, cycle.startDate, cycle.endDate);
    if (!rowMap[date]) {
      rowMap[date] = {
        date,
        isAvailable: true,
        ds1Available: true,
        ds2Available: true,
        nsAvailable: true,
      };
    }

    rowMap[date][column] = !rowMap[date][column];
    const row = rowMap[date];
    if (!row.ds1Available && !row.ds2Available && !row.nsAvailable) {
      row.isAvailable = false;
    }
    if (!row.isAvailable && (row.ds1Available || row.ds2Available || row.nsAvailable)) {
      row.isAvailable = true;
    }

    persistDates(Object.values(rowMap).sort((left, right) => left.date.localeCompare(right.date)));
  }, [activeCycleId, cycle.endDate, cycle.startDate, dateRows, persistDates]);

  if (cycleLoading || datesQuery.isLoading || sharesQuery.isLoading || usersQuery.isLoading || scheduleQuery.isLoading) {
    return (
      <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <p className="text-sm" style={{ color: CONCEPT_THEME.muted }}>Loading cycle data...</p>
      </div>
    );
  }

  if (cycleError || datesQuery.error || sharesQuery.error || usersQuery.error || scheduleQuery.error) {
    const error = cycleError || datesQuery.error || sharesQuery.error || usersQuery.error || scheduleQuery.error;
    return (
      <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <p className="text-sm" style={{ color: CONCEPT_THEME.error }}>
          {error?.message || 'Unable to load run cycle data.'}
        </p>
      </div>
    );
  }

  const preferredDeadline = cycle.preferenceDeadline || (cycle.startDate ? addDays(cycle.startDate, -7) : '');

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

      {/* Admin Notes */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <h3 className="concept-font-display text-base font-bold mb-1" style={{ color: CONCEPT_THEME.navy }}>Admin Notes</h3>
        <p className="text-sm mb-3" style={{ color: CONCEPT_THEME.muted }}>
          Visible to members above their Availability Calendar. Use for cycle-wide announcements or reminders.
        </p>
        <textarea
          rows={4}
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          onBlur={(e) => saveNotes(e.target.value)}
          placeholder="e.g. June 10th DS1 shift starts at 8am instead of 9am."
          disabled={!activeCycleId}
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none"
          style={{ background: CONCEPT_THEME.warmWhite, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
        />
      </div>

      {/* Shift Timing Exceptions */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <h3 className="concept-font-display text-base font-bold mb-1" style={{ color: CONCEPT_THEME.navy }}>Shift Timing Exceptions</h3>
        <p className="text-sm mb-3" style={{ color: CONCEPT_THEME.muted }}>
          Override start/end times for specific date + shift combinations. Members will see the updated times in their schedule.
        </p>

        {/* Add row */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 mb-3">
          <input
            type="date"
            value={newException.date}
            min={cycle.startDate || undefined}
            max={cycle.endDate || undefined}
            onChange={(e) => setNewException((prev) => ({ ...prev, date: e.target.value }))}
            className="rounded-lg border px-2 py-1.5 text-sm outline-none"
            style={{ background: CONCEPT_THEME.warmWhite, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
          />
          <select
            value={newException.shift}
            onChange={(e) => setNewException((prev) => ({ ...prev, shift: e.target.value }))}
            className="rounded-lg border px-2 py-1.5 text-sm outline-none"
            style={{ background: CONCEPT_THEME.warmWhite, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
          >
            {SHIFT_ORDER.map((s) => (
              <option key={s} value={s}>{SHIFT_LABELS[s]}</option>
            ))}
          </select>
          <input
            type="time"
            value={newException.startTime}
            onChange={(e) => setNewException((prev) => ({ ...prev, startTime: e.target.value }))}
            className="rounded-lg border px-2 py-1.5 text-sm outline-none"
            style={{ background: CONCEPT_THEME.warmWhite, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
          />
          <input
            type="time"
            value={newException.endTime}
            onChange={(e) => setNewException((prev) => ({ ...prev, endTime: e.target.value }))}
            className="rounded-lg border px-2 py-1.5 text-sm outline-none"
            style={{ background: CONCEPT_THEME.warmWhite, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
          />
          <button
            type="button"
            onClick={addException}
            disabled={!activeCycleId || !newException.date || !newException.startTime || !newException.endTime}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: CONCEPT_THEME.navy, color: 'white' }}
          >
            Add
          </button>
        </div>

        {overrides.length === 0 ? (
          <p className="text-sm" style={{ color: CONCEPT_THEME.muted }}>No exceptions set.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: CONCEPT_THEME.muted }}>
                  <th className="text-left pb-1 pr-4 text-xs font-semibold uppercase tracking-wide">Date</th>
                  <th className="text-left pb-1 pr-4 text-xs font-semibold uppercase tracking-wide">Shift</th>
                  <th className="text-left pb-1 pr-4 text-xs font-semibold uppercase tracking-wide">Start</th>
                  <th className="text-left pb-1 pr-4 text-xs font-semibold uppercase tracking-wide">End</th>
                  <th className="pb-1" />
                </tr>
              </thead>
              <tbody>
                {[...overrides].sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift)).map((o) => (
                  <tr key={`${o.date}-${o.shift}`} className="border-t" style={{ borderColor: CONCEPT_THEME.borderLight }}>
                    <td className="py-1.5 pr-4" style={{ color: CONCEPT_THEME.text }}>{o.date}</td>
                    <td className="py-1.5 pr-4" style={{ color: CONCEPT_THEME.text }}>{o.shift}</td>
                    <td className="py-1.5 pr-4" style={{ color: CONCEPT_THEME.text }}>{o.startTime}</td>
                    <td className="py-1.5 pr-4" style={{ color: CONCEPT_THEME.text }}>{o.endTime}</td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => deleteException(o.date, o.shift)}
                        className="rounded px-2 py-0.5 text-xs font-semibold"
                        style={{ background: CONCEPT_THEME.errorLight, color: CONCEPT_THEME.error }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
