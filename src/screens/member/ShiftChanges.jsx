import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useActiveCycle } from '../../hooks/useActiveCycle';
import {
  useAvailableDates,
  useCreateSwapRequest,
  useSchedule,
  useSwapRequests,
} from '../../hooks/useApiData';
import { formatCalendarDate, fromDateStr } from '../../lib/dates';
import { SHIFT_ORDER, SHIFT_UI_META } from '../../lib/constants';
import { CONCEPT_THEME } from '../../lib/theme';
import { extractRows } from '../../lib/api';

export default function ShiftChanges() {
  const { user } = useAuth();
  const { activeCycle, activeCycleId } = useActiveCycle();
  const scheduleQuery = useSchedule(activeCycleId);
  const swapRequestsQuery = useSwapRequests();
  const datesQuery = useAvailableDates(activeCycleId);
  const createSwapRequest = useCreateSwapRequest();

  const [selectedShiftChangeSource, setSelectedShiftChangeSource] = useState('');
  const [shiftChangeForm, setShiftChangeForm] = useState({ requestedDate: '', requestedShift: '', reason: '' });
  const [memberShiftChangeError, setMemberShiftChangeError] = useState('');
  const [shiftChangeSubmittedFlash, setShiftChangeSubmittedFlash] = useState(false);
  const [expandedMemberRequestId, setExpandedMemberRequestId] = useState('');

  const cycle = useMemo(() => {
    if (!activeCycle) return { startDate: '', endDate: '' };
    return {
      startDate: activeCycle.startDate || '',
      endDate: activeCycle.endDate || '',
    };
  }, [activeCycle]);

  const scheduleData = scheduleQuery.data || null;
  const allAssignments = useMemo(
    () => (Array.isArray(scheduleData?.assignments) ? scheduleData.assignments : []),
    [scheduleData],
  );

  const sortedCurrentMemberAssignments = useMemo(
    () => [...allAssignments].sort((a, b) => {
      const dateDelta = String(a.assignedDate || '').localeCompare(String(b.assignedDate || ''));
      if (dateDelta !== 0) return dateDelta;
      return SHIFT_ORDER.indexOf(a.shift) - SHIFT_ORDER.indexOf(b.shift);
    }),
    [allAssignments],
  );

  const assignmentKey = useCallback(
    (assignment) => `${assignment.assignedDate}:${assignment.shift}`,
    [],
  );

  const availableDateRows = useMemo(() => extractRows(datesQuery.data), [datesQuery.data]);
  const availableDateMap = useMemo(() => {
    const map = new Map();
    availableDateRows.forEach((row) => {
      if (!row?.date) return;
      map.set(row.date, row);
    });
    return map;
  }, [availableDateRows]);

  const selectedShiftChangeDate = selectedShiftChangeSource ? selectedShiftChangeSource.split(':')[0] : '';

  const availableShiftRequestDatesForSelection = useMemo(() => (
    availableDateRows
      .filter((row) => row.isAvailable)
      .filter((row) => row.date !== selectedShiftChangeDate)
      .filter((row) => (
        (row.ds1Available ?? true)
        || (row.ds2Available ?? true)
        || (row.nsAvailable ?? true)
      ))
      .map((row) => row.date)
      .sort()
  ), [availableDateRows, selectedShiftChangeDate]);

  const availableShiftRequestTypes = useMemo(() => {
    if (!shiftChangeForm.requestedDate) return SHIFT_ORDER;
    const row = availableDateMap.get(shiftChangeForm.requestedDate);
    if (!row || row.isAvailable === false) return [];
    return SHIFT_ORDER.filter((shift) => {
      if (shift === 'DS1') return row.ds1Available !== false;
      if (shift === 'DS2') return row.ds2Available !== false;
      if (shift === 'NS') return row.nsAvailable !== false;
      return false;
    });
  }, [availableDateMap, shiftChangeForm.requestedDate]);

  const selectedShiftChangeAssignmentObj = useMemo(
    () => sortedCurrentMemberAssignments.find(
      (assignment) => assignmentKey(assignment) === selectedShiftChangeSource,
    ) || null,
    [sortedCurrentMemberAssignments, assignmentKey, selectedShiftChangeSource],
  );

  const memberShiftRequests = useMemo(() => {
    const swaps = extractRows(swapRequestsQuery.data);
    return swaps
      .map((swap) => {
        const targetAssignment = swap.targetAssignment || {};
        const approved = swap.status === 'approved';
        return {
          id: swap.id,
          sourceDate: targetAssignment.assignedDate || '',
          sourceShift: targetAssignment.shift || '',
          requestedDate: (swap.preferredDates || [])[0] || '',
          requestedShift: '',
          reason: '',
          status: approved ? 'Approved' : swap.status === 'denied' ? 'Rejected' : 'Pending',
          createdAt: swap.createdAt,
          adminNote: swap.adminNotes || '',
          reassignedDate: approved ? (targetAssignment.assignedDate || '') : '',
          reassignedShift: approved ? (targetAssignment.shift || '') : '',
        };
      })
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }, [swapRequestsQuery.data]);

  const memberShiftChangeSummary = useMemo(() => ({
    pending: memberShiftRequests.filter((request) => request.status === 'Pending').length,
    approved: memberShiftRequests.filter((request) => request.status === 'Approved').length,
    rejected: memberShiftRequests.filter((request) => request.status === 'Rejected').length,
  }), [memberShiftRequests]);

  const formatMemberShiftDate = useCallback((dateStr) => {
    if (!dateStr) return 'N/A';
    return fromDateStr(dateStr).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  useEffect(() => {
    if (selectedShiftChangeSource && !selectedShiftChangeAssignmentObj) {
      setSelectedShiftChangeSource('');
    }
  }, [selectedShiftChangeAssignmentObj, selectedShiftChangeSource]);

  useEffect(() => {
    if (!selectedShiftChangeSource) {
      setShiftChangeForm((prev) => {
        if (!prev.requestedDate && !prev.requestedShift && !prev.reason) return prev;
        return { requestedDate: '', requestedShift: '', reason: '' };
      });
      return;
    }

    setShiftChangeForm((prev) => {
      if (!prev.requestedDate) return prev;
      if (!availableShiftRequestDatesForSelection.includes(prev.requestedDate)) {
        return { ...prev, requestedDate: '', requestedShift: '' };
      }
      return prev;
    });
  }, [availableShiftRequestDatesForSelection, selectedShiftChangeSource]);

  useEffect(() => {
    setShiftChangeForm((prev) => {
      if (!prev.requestedDate) {
        if (!prev.requestedShift) return prev;
        if (!SHIFT_ORDER.includes(prev.requestedShift)) {
          return { ...prev, requestedShift: '' };
        }
        return prev;
      }

      if (!prev.requestedShift) return prev;
      if (!availableShiftRequestTypes.includes(prev.requestedShift)) {
        return { ...prev, requestedShift: '' };
      }
      return prev;
    });
  }, [availableShiftRequestTypes]);

  useEffect(() => {
    if (memberShiftChangeError) setMemberShiftChangeError('');
  }, [memberShiftChangeError, selectedShiftChangeSource, shiftChangeForm.requestedDate, shiftChangeForm.requestedShift]);

  const submitShiftChangeRequest = useCallback((event) => {
    event.preventDefault();

    if (!selectedShiftChangeAssignmentObj) {
      setMemberShiftChangeError('Select an assigned shift to request a change.');
      return;
    }

    if (!scheduleData?.scheduleId) {
      setMemberShiftChangeError('Schedule is not available. Try refreshing.');
      return;
    }

    if (shiftChangeForm.requestedDate && !availableShiftRequestDatesForSelection.includes(shiftChangeForm.requestedDate)) {
      setMemberShiftChangeError('Preferred date is not available.');
      return;
    }

    if (shiftChangeForm.requestedDate && shiftChangeForm.requestedShift && !availableShiftRequestTypes.includes(shiftChangeForm.requestedShift)) {
      setMemberShiftChangeError('Preferred shift is blocked on selected date.');
      return;
    }

    createSwapRequest.mutate(
      {
        scheduleId: scheduleData.scheduleId,
        targetAssignmentId: selectedShiftChangeAssignmentObj.id,
        preferredDates: shiftChangeForm.requestedDate ? [shiftChangeForm.requestedDate] : [],
      },
      {
        onSuccess: () => {
          setShiftChangeSubmittedFlash(true);
          window.setTimeout(() => setShiftChangeSubmittedFlash(false), 2800);
          setMemberShiftChangeError('');
          setExpandedMemberRequestId('');
          setSelectedShiftChangeSource('');
          setShiftChangeForm({ requestedDate: '', requestedShift: '', reason: '' });
        },
        onError: (err) => {
          setMemberShiftChangeError(err.message || 'Failed to submit swap request.');
        },
      },
    );
  }, [
    availableShiftRequestDatesForSelection,
    availableShiftRequestTypes,
    createSwapRequest,
    scheduleData,
    selectedShiftChangeAssignmentObj,
    shiftChangeForm.requestedDate,
    shiftChangeForm.requestedShift,
  ]);

  if (scheduleQuery.isLoading || swapRequestsQuery.isLoading || datesQuery.isLoading) {
    return (
      <div className="py-12 text-center text-base" style={{ color: CONCEPT_THEME.muted }}>
        Loading shift data...
      </div>
    );
  }

  return (
    <div className="space-y-4 concept-font-body">
      <div className="rounded-2xl px-5 py-4 bg-white border shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <h3 className="concept-font-display text-2xl font-bold" style={{ color: CONCEPT_THEME.navy }}>Shift Change Request</h3>
        <p className="text-base mt-1" style={{ color: CONCEPT_THEME.muted }}>
          Select a current assigned shifts, then submit your request for reassignment.
        </p>
      </div>

      <div className="rounded-2xl px-5 py-4 bg-white border shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h4 className="concept-font-display text-base font-bold" style={{ color: CONCEPT_THEME.navy }}>Your Current Assigned Shifts</h4>
          <span className="rounded-lg px-2 py-1 text-sm font-semibold" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}>
            {sortedCurrentMemberAssignments.length} shifts
          </span>
        </div>
        {sortedCurrentMemberAssignments.length === 0 ? (
          <div className="text-base" style={{ color: CONCEPT_THEME.muted }}>
            No assigned shifts available yet. Once schedule assignments exist, you can submit requests here.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {sortedCurrentMemberAssignments.map((assignment, idx) => {
              const key = assignmentKey(assignment);
              const selected = selectedShiftChangeSource === key;
              const meta = SHIFT_UI_META[assignment.shift] || { label: assignment.shift, sub: '', color: CONCEPT_THEME.muted, bg: CONCEPT_THEME.sand };
              return (
                <button
                  key={`shift-change-source-${key}-${idx}`}
                  type="button"
                  onClick={() => setSelectedShiftChangeSource((prev) => (prev === key ? '' : key))}
                  className="text-left px-3 py-2.5 rounded-xl border transition-all"
                  style={{
                    background: selected ? meta.bg : CONCEPT_THEME.cream,
                    borderColor: selected ? meta.color : CONCEPT_THEME.borderLight,
                    boxShadow: selected ? `0 0 0 2px ${meta.color}22` : 'none',
                  }}
                >
                  <div className="text-base font-bold" style={{ color: CONCEPT_THEME.navy }}>{formatMemberShiftDate(assignment.assignedDate)}</div>
                  <div className="mt-0.5 text-sm" style={{ color: CONCEPT_THEME.text }}>{meta.label} ({meta.sub})</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedShiftChangeAssignmentObj && (
        <div className="rounded-2xl px-5 py-4 bg-white border shadow-sm concept-anim-scale" style={{ borderColor: CONCEPT_THEME.borderLight }}>
          <h4 className="concept-font-display text-base font-bold mb-3" style={{ color: CONCEPT_THEME.navy }}>New Request</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div className="rounded-xl px-3 py-2.5 border" style={{ background: `${CONCEPT_THEME.sky}08`, borderColor: `${CONCEPT_THEME.sky}33` }}>
              <div className="mb-1 text-sm font-bold uppercase tracking-wider" style={{ color: CONCEPT_THEME.sky }}>Changing From</div>
              <div className="text-base font-semibold" style={{ color: CONCEPT_THEME.navy }}>
                {formatMemberShiftDate(selectedShiftChangeAssignmentObj.assignedDate)}
              </div>
              <div className="text-base" style={{ color: CONCEPT_THEME.muted }}>
                {SHIFT_UI_META[selectedShiftChangeAssignmentObj.shift]?.label || selectedShiftChangeAssignmentObj.shift}
              </div>
            </div>
            <div className="rounded-xl px-3 py-2.5 border" style={{ background: `${CONCEPT_THEME.emerald}08`, borderColor: `${CONCEPT_THEME.emerald}33` }}>
              <div className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: CONCEPT_THEME.emerald }}>Preferred Replacement</div>
              <div className="text-base font-semibold" style={{ color: CONCEPT_THEME.navy }}>
                {shiftChangeForm.requestedDate ? formatMemberShiftDate(shiftChangeForm.requestedDate) : 'Select Date'}
              </div>
              <div className="text-base" style={{ color: CONCEPT_THEME.muted }}>
                {shiftChangeForm.requestedShift
                  ? (SHIFT_UI_META[shiftChangeForm.requestedShift]?.label || shiftChangeForm.requestedShift)
                  : 'Select Shift'}
              </div>
            </div>
          </div>

          <form className="grid grid-cols-1 md:grid-cols-2 gap-2.5" onSubmit={submitShiftChangeRequest}>
            <input
              type="date"
              value={shiftChangeForm.requestedDate}
              min={cycle.startDate}
              max={cycle.endDate}
              onChange={(e) => {
                const date = e.target.value;
                if (date && !availableShiftRequestDatesForSelection.includes(date)) return;
                setShiftChangeForm((prev) => ({ ...prev, requestedDate: date }));
              }}
              className="rounded-xl border px-3 py-2 text-base"
              style={{ borderColor: CONCEPT_THEME.border, background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}
            />
            <select
              value={shiftChangeForm.requestedShift}
              onChange={(e) => setShiftChangeForm((prev) => ({ ...prev, requestedShift: e.target.value }))}
              className="rounded-xl border px-3 py-2 text-base"
              style={{ borderColor: CONCEPT_THEME.border, background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}
            >
              <option value="">Select Shift</option>
              {(shiftChangeForm.requestedDate ? availableShiftRequestTypes : SHIFT_ORDER).map((shift) => (
                <option key={`shift-change-type-${shift}`} value={shift}>
                  {SHIFT_UI_META[shift]?.label || shift}
                </option>
              ))}
            </select>
            <div className="md:col-span-2 flex items-center gap-2">
              <button
                type="submit"
                className="rounded-xl px-4 py-2 text-base font-bold"
                style={{ background: CONCEPT_THEME.navy, color: 'white' }}
              >
                Submit Request
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedShiftChangeSource('');
                  setShiftChangeForm({ requestedDate: '', requestedShift: '', reason: '' });
                  setMemberShiftChangeError('');
                }}
                className="rounded-xl px-3 py-2 text-base font-semibold"
                style={{ color: CONCEPT_THEME.muted }}
              >
                Cancel
              </button>
            </div>
          </form>

          {memberShiftChangeError && (
            <div className="mt-2 text-base rounded px-2.5 py-2" style={{ background: CONCEPT_THEME.errorLight, color: CONCEPT_THEME.error, border: `1px solid ${CONCEPT_THEME.error}33` }}>
              {memberShiftChangeError}
            </div>
          )}
        </div>
      )}

      {shiftChangeSubmittedFlash && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border concept-anim-fade" style={{ background: CONCEPT_THEME.emeraldLight, borderColor: `${CONCEPT_THEME.emerald}33`, color: CONCEPT_THEME.emerald }}>
          <span className="text-base font-semibold">Request submitted. Admin will review this shortly.</span>
        </div>
      )}

      <div className="rounded-2xl px-5 py-4 bg-white border shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex items-center gap-2 mb-3">
          <h4 className="concept-font-display text-base font-bold" style={{ color: CONCEPT_THEME.navy }}>Request History</h4>
          {memberShiftChangeSummary.pending > 0 && (
            <span className="rounded-lg px-2 py-1 text-sm font-bold" style={{ background: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.accentOnAccent }}>
              {memberShiftChangeSummary.pending} pending
            </span>
          )}
        </div>

        {memberShiftRequests.length === 0 ? (
          <div className="text-base text-center py-3" style={{ color: CONCEPT_THEME.muted }}>No shift change requests yet.</div>
        ) : (
          <div className="space-y-2">
            {memberShiftRequests.map((request) => {
              const statusStyle = request.status === 'Approved'
                ? { bg: CONCEPT_THEME.emeraldLight, color: CONCEPT_THEME.emerald }
                : request.status === 'Rejected'
                  ? { bg: CONCEPT_THEME.errorLight, color: CONCEPT_THEME.error }
                  : { bg: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.accentOnAccent };
              const expanded = expandedMemberRequestId === request.id;
              return (
                <div key={request.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedMemberRequestId((prev) => (prev === request.id ? '' : request.id))}
                    className="w-full text-left px-3.5 py-3 rounded-xl border flex items-center gap-2"
                    style={{ background: CONCEPT_THEME.cream, borderColor: CONCEPT_THEME.borderLight }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold" style={{ color: CONCEPT_THEME.navy }}>
                        {formatMemberShiftDate(request.sourceDate)} | {SHIFT_UI_META[request.sourceShift]?.label || request.sourceShift || 'Unknown shift'}
                      </div>
                      {request.reason ? (
                        <div className="mt-0.5 truncate text-sm" style={{ color: CONCEPT_THEME.muted }}>{request.reason}</div>
                      ) : null}
                    </div>
                    <span className="rounded-lg px-2 py-1 text-sm font-bold" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                      {request.status}
                    </span>
                  </button>
                  {expanded && (
                    <div className="mt-1 ml-2 mr-1 rounded-xl px-3 py-2 border text-sm" style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border }}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <span className="font-semibold" style={{ color: CONCEPT_THEME.muted }}>Submitted:</span>{' '}
                          <span style={{ color: CONCEPT_THEME.text }}>{new Date(request.createdAt).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="font-semibold" style={{ color: CONCEPT_THEME.muted }}>Preferred:</span>{' '}
                          <span style={{ color: CONCEPT_THEME.text }}>
                            {request.requestedDate
                              ? `${formatMemberShiftDate(request.requestedDate)} | ${SHIFT_UI_META[request.requestedShift]?.label || request.requestedShift || 'Any shift'}`
                              : 'Any available slot'}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold" style={{ color: CONCEPT_THEME.muted }}>Admin Reassignment:</span>{' '}
                          <span style={{ color: request.reassignedDate ? CONCEPT_THEME.emerald : CONCEPT_THEME.text }}>
                            {request.reassignedDate
                              ? `${formatMemberShiftDate(request.reassignedDate)} | ${SHIFT_UI_META[request.reassignedShift]?.label || request.reassignedShift}`
                              : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold" style={{ color: CONCEPT_THEME.muted }}>Admin Note:</span>{' '}
                          <span style={{ color: CONCEPT_THEME.text }}>{request.adminNote || '-'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
