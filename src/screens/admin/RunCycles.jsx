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

const EMPTY_CYCLE = {
  id: '',
  startDate: '',
  endDate: '',
  preferenceDeadline: '',
};

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

  useEffect(() => {
    setFormCycle(buildInitialFormCycle(activeCycle));
    if (activeCycleId) {
      createTriggeredRef.current = false;
    }
  }, [activeCycle, activeCycleId]);

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
    </div>
  );
}
