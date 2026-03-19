import React from 'react';
import { SHIFT_ORDER, SHIFT_UI_META } from '../../lib/constants';
import { CONCEPT_THEME, COLORS } from '../../lib/theme';
import { formatCalendarDate } from '../../lib/dates';
import { useMockApp } from '../../lib/mock-state';

export default function ShiftChangeAdmin() {
  const {
    sortedShiftRequests,
    adminShiftDrafts,
    adminShiftActionErrors,
    updateShiftDraft,
    resolveShiftChange,
  } = useMockApp();

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border p-4 shadow-sm">
        <h3 className="concept-font-display text-base font-bold mb-2" style={{ color: CONCEPT_THEME.navy }}>Shift Change Admin Queue</h3>
        <p className="text-xs mb-1" style={{ color: CONCEPT_THEME.muted }}>
          Approvals update schedule assignments immediately. Only open slots can be used for reassignment.
        </p>
      </div>

      {sortedShiftRequests.length === 0 && (
        <div className="bg-white rounded-lg border p-4 shadow-sm text-xs text-gray-500">No shift change requests submitted.</div>
      )}

      {sortedShiftRequests.map((request) => {
        const draft = adminShiftDrafts[request.id] || {};
        const statusStyle = request.status === 'Approved'
          ? { bg: CONCEPT_THEME.emeraldLight, color: CONCEPT_THEME.emerald }
          : request.status === 'Rejected'
            ? { bg: '#fee2e2', color: '#b91c1c' }
            : { bg: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.amber };
        const sourceDate = request.sourceDate || '';
        const sourceShiftType = request.sourceShiftType || '';
        const effectiveRequestedDate = request.requestedDate || '';
        const effectiveRequestedShift = request.requestedShiftType || '';
        const effectiveReassignedDate = draft.reassignedDate || request.reassignedDate || effectiveRequestedDate || '';
        const effectiveReassignedShift = draft.reassignedShiftType || request.reassignedShiftType || effectiveRequestedShift || '';
        return (
          <div key={request.id} className="bg-white rounded-lg border p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold" style={{ color: COLORS[request.memberId] || CONCEPT_THEME.navy }}>
                  {request.memberId || 'Unknown Member'}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: CONCEPT_THEME.muted }}>
                  Submitted {request.createdAt ? new Date(request.createdAt).toLocaleString() : 'Unknown time'}
                </div>
              </div>
              <span className="px-2 py-1 rounded text-[11px] font-bold" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                {request.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg px-3 py-2" style={{ background: CONCEPT_THEME.sand }}>
                <div className="font-semibold mb-0.5" style={{ color: CONCEPT_THEME.muted }}>Source Assignment</div>
                <div style={{ color: CONCEPT_THEME.text }}>
                  {sourceDate ? `${formatCalendarDate(sourceDate)} | ${SHIFT_UI_META[sourceShiftType]?.label || sourceShiftType}` : 'Missing source assignment in request'}
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <input
                type="date"
                value={effectiveReassignedDate}
                onChange={(e) => updateShiftDraft(request.id, { reassignedDate: e.target.value })}
                className="border rounded px-2 py-1.5"
              />
              <select
                value={effectiveReassignedShift}
                onChange={(e) => updateShiftDraft(request.id, { reassignedShiftType: e.target.value })}
                className="border rounded px-2 py-1.5"
              >
                <option value="">Select Shift</option>
                {SHIFT_ORDER.map((shiftType) => (
                  <option key={`${request.id}-shift-${shiftType}`} value={shiftType}>
                    {SHIFT_UI_META[shiftType]?.label || shiftType}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={draft.adminNote || request.adminNote || ''}
                onChange={(e) => updateShiftDraft(request.id, { adminNote: e.target.value })}
                placeholder="Admin note"
                className="border rounded px-2 py-1.5"
              />
            </div>

            {adminShiftActionErrors[request.id] && (
              <div className="text-xs rounded px-2.5 py-2" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                {adminShiftActionErrors[request.id]}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => resolveShiftChange(request.id, 'Approved')} className="px-3 py-1.5 rounded bg-emerald-100 text-emerald-700 text-xs font-semibold">
                Approve
              </button>
              <button type="button" onClick={() => resolveShiftChange(request.id, 'Rejected')} className="px-3 py-1.5 rounded bg-red-100 text-red-700 text-xs font-semibold">
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
