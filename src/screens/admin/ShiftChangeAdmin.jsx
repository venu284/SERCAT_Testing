import React, { useCallback, useMemo, useState } from 'react';
import { useResolveSwapRequest, useSwapRequests } from '../../hooks/useApiData';
import { SHIFT_ORDER, SHIFT_UI_META } from '../../lib/constants';
import { CONCEPT_THEME, COLORS } from '../../lib/theme';
import { formatCalendarDate } from '../../lib/dates';

export default function ShiftChangeAdmin() {
  const swapRequestsQuery = useSwapRequests();
  const resolveSwapMutation = useResolveSwapRequest();
  const [adminShiftDrafts, setAdminShiftDrafts] = useState({});
  const [adminShiftActionErrors, setAdminShiftActionErrors] = useState({});

  const sortedShiftRequests = useMemo(() => {
    const swaps = Array.isArray(swapRequestsQuery.data?.data) ? swapRequestsQuery.data.data : [];
    return swaps
      .map((swap) => {
        const targetAssignment = swap.targetAssignment || {};
        const approved = swap.status === 'approved';
        return {
          id: swap.id,
          _swapId: swap.id,
          memberId: swap.institutionAbbreviation || swap.requesterName || 'Unknown',
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

  const updateShiftDraft = useCallback((requestId, patch) => {
    setAdminShiftDrafts((prev) => ({
      ...prev,
      [requestId]: { ...(prev[requestId] || {}), ...patch },
    }));
    setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: '' }));
  }, []);

  const resolveShiftChange = useCallback((requestId, status) => {
    const request = sortedShiftRequests.find((entry) => entry.id === requestId);
    if (!request) return;

    const draft = adminShiftDrafts[requestId] || {};

    if (status === 'Rejected') {
      resolveSwapMutation.mutate(
        {
          id: request._swapId,
          status: 'denied',
          adminNotes: String(draft.adminNote || '').trim(),
        },
        {
          onSuccess: () => setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: '' })),
          onError: (err) => setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: err.message })),
        },
      );
      return;
    }

    const targetDate = String(draft.reassignedDate || request.requestedDate || '').trim();
    const targetShift = String(draft.reassignedShift || request.requestedShift || '').trim();
    const adminNote = String(draft.adminNote || '').trim();

    if (!targetDate || !targetShift) {
      setAdminShiftActionErrors((prev) => ({
        ...prev,
        [requestId]: 'Select reassigned date and shift before approval.',
      }));
      return;
    }

    resolveSwapMutation.mutate(
      {
        id: request._swapId,
        status: 'approved',
        adminNotes: adminNote,
        reassignedDate: targetDate,
        reassignedShift: targetShift,
      },
      {
        onSuccess: () => setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: '' })),
        onError: (err) => setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: err.message })),
      },
    );
  }, [adminShiftDrafts, resolveSwapMutation, sortedShiftRequests]);

  if (swapRequestsQuery.isLoading) {
    return (
      <div className="bg-white rounded-lg border p-4 shadow-sm text-sm" style={{ color: CONCEPT_THEME.muted }}>
        Loading shift change requests...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border p-4 shadow-sm">
        <h3 className="concept-font-display text-base font-bold mb-2" style={{ color: CONCEPT_THEME.navy }}>Shift Change Admin Queue</h3>
        <p className="text-sm mb-1" style={{ color: CONCEPT_THEME.muted }}>
          Approvals update schedule assignments immediately. Only open slots can be used for reassignment.
        </p>
      </div>

      {sortedShiftRequests.length === 0 && (
        <div className="bg-white rounded-lg border p-4 shadow-sm text-sm" style={{ color: CONCEPT_THEME.muted, borderColor: CONCEPT_THEME.borderLight }}>No shift change requests submitted.</div>
      )}

      {sortedShiftRequests.map((request) => {
        const draft = adminShiftDrafts[request.id] || {};
        const statusStyle = request.status === 'Approved'
          ? { bg: CONCEPT_THEME.emeraldLight, color: CONCEPT_THEME.emerald }
          : request.status === 'Rejected'
            ? { bg: CONCEPT_THEME.errorLight, color: CONCEPT_THEME.error }
            : { bg: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.accentOnAccent };
        const sourceDate = request.sourceDate || '';
        const sourceShift = request.sourceShift || '';
        const effectiveRequestedDate = request.requestedDate || '';
        const effectiveRequestedShift = request.requestedShift || '';
        const effectiveReassignedDate = draft.reassignedDate || request.reassignedDate || effectiveRequestedDate || '';
        const effectiveReassignedShift = draft.reassignedShift || request.reassignedShift || effectiveRequestedShift || '';
        return (
          <div key={request.id} className="bg-white rounded-lg border p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold" style={{ color: COLORS[request.memberId] || CONCEPT_THEME.navy }}>
                  {request.memberId || 'Unknown Member'}
                </div>
                <div className="mt-0.5 text-xs" style={{ color: CONCEPT_THEME.muted }}>
                  Submitted {request.createdAt ? new Date(request.createdAt).toLocaleString() : 'Unknown time'}
                </div>
              </div>
              <span className="rounded px-2 py-1 text-xs font-bold" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                {request.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg px-3 py-2" style={{ background: CONCEPT_THEME.sand }}>
                <div className="font-semibold mb-0.5" style={{ color: CONCEPT_THEME.muted }}>Source Assignment</div>
                <div style={{ color: CONCEPT_THEME.text }}>
                  {sourceDate ? `${formatCalendarDate(sourceDate)} | ${SHIFT_UI_META[sourceShift]?.label || sourceShift}` : 'Missing source assignment in request'}
                </div>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: CONCEPT_THEME.sand }}>
                <div className="font-semibold mb-0.5" style={{ color: CONCEPT_THEME.muted }}>Member Preferred Target</div>
                <div style={{ color: CONCEPT_THEME.text }}>
                  {effectiveRequestedDate
                    ? `${formatCalendarDate(effectiveRequestedDate)} | ${SHIFT_UI_META[effectiveRequestedShift]?.label || effectiveRequestedShift || 'Any shift'}`
                    : 'No preferred replacement provided'}
                </div>
              </div>
            </div>

            <div className="text-xs">
              <span className="font-semibold" style={{ color: CONCEPT_THEME.muted }}>Reason:</span>{' '}
              <span style={{ color: CONCEPT_THEME.text }}>{request.reason || '-'}</span>
            </div>

            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
              <input
                type="date"
                value={effectiveReassignedDate}
                onChange={(e) => updateShiftDraft(request.id, { reassignedDate: e.target.value })}
                className="rounded border px-2 py-1.5 text-sm"
              />
              <select
                value={effectiveReassignedShift}
                onChange={(e) => updateShiftDraft(request.id, { reassignedShift: e.target.value })}
                className="rounded border px-2 py-1.5 text-sm"
              >
                <option value="">Select Shift</option>
                {SHIFT_ORDER.map((shift) => (
                  <option key={`${request.id}-shift-${shift}`} value={shift}>
                    {SHIFT_UI_META[shift]?.label || shift}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={draft.adminNote || request.adminNote || ''}
                onChange={(e) => updateShiftDraft(request.id, { adminNote: e.target.value })}
                placeholder="Admin note"
                className="rounded border px-2 py-1.5 text-sm"
              />
            </div>

            {adminShiftActionErrors[request.id] && (
              <div className="text-sm rounded px-2.5 py-2" style={{ background: CONCEPT_THEME.errorLight, color: CONCEPT_THEME.error, border: `1px solid ${CONCEPT_THEME.error}33` }}>
                {adminShiftActionErrors[request.id]}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => resolveShiftChange(request.id, 'Approved')} className="rounded bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                Approve
              </button>
              <button type="button" onClick={() => resolveShiftChange(request.id, 'Rejected')} className="rounded bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-700">
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
