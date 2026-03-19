import React from 'react';
import { SHIFT_ORDER, SHIFT_UI_META } from '../../lib/constants';
import { CONCEPT_THEME } from '../../lib/theme';
import { useMockApp } from '../../lib/mock-state';

export default function ShiftChanges() {
  const {
    sortedCurrentMemberAssignments,
    assignmentKey,
    selectedShiftChangeSource,
    setSelectedShiftChangeSource,
    formatMemberShiftDate,
    shiftChangeForm,
    setShiftChangeForm,
    submitShiftChangeRequest,
    selectedShiftChangeAssignmentObj,
    availableShiftRequestDatesForSelection,
    availableShiftRequestTypes,
    memberShiftChangeError,
    setMemberShiftChangeError,
    shiftChangeSubmittedFlash,
    memberShiftRequests,
    memberShiftChangeSummary,
    expandedMemberRequestId,
    setExpandedMemberRequestId,
  } = useMockApp();

  return (
    <div className="space-y-4 concept-font-body">
      <div className="rounded-2xl px-5 py-4 bg-white border shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <h3 className="concept-font-display text-lg font-bold" style={{ color: CONCEPT_THEME.navy }}>Shift Changes</h3>
        <p className="text-xs mt-1" style={{ color: CONCEPT_THEME.muted }}>
          Select a current assignment, then submit your request for reassignment.
        </p>
      </div>

      <div className="rounded-2xl px-5 py-4 bg-white border shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h4 className="concept-font-display text-sm font-bold" style={{ color: CONCEPT_THEME.navy }}>Your Current Assignments</h4>
          <span className="text-[10px] px-2 py-1 rounded-lg font-semibold" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.muted }}>
            {sortedCurrentMemberAssignments.length} shifts
          </span>
        </div>
        {sortedCurrentMemberAssignments.length === 0 ? (
          <div className="text-xs" style={{ color: CONCEPT_THEME.muted }}>
            No assigned shifts available yet. Once schedule assignments exist, you can submit requests here.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {sortedCurrentMemberAssignments.map((assignment, idx) => {
              const key = assignmentKey(assignment);
              const selected = selectedShiftChangeSource === key;
              const meta = SHIFT_UI_META[assignment.shiftType] || { label: assignment.shiftType, sub: '', color: CONCEPT_THEME.muted, bg: CONCEPT_THEME.sand };
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
                  <div className="text-xs font-bold" style={{ color: CONCEPT_THEME.navy }}>{formatMemberShiftDate(assignment.date)}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: CONCEPT_THEME.muted }}>{meta.label} ({meta.sub})</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedShiftChangeAssignmentObj && (
        <div className="rounded-2xl px-5 py-4 bg-white border shadow-sm concept-anim-scale" style={{ borderColor: CONCEPT_THEME.borderLight }}>
          <h4 className="concept-font-display text-sm font-bold mb-3" style={{ color: CONCEPT_THEME.navy }}>New Request</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div className="rounded-xl px-3 py-2.5 border" style={{ background: `${CONCEPT_THEME.sky}08`, borderColor: `${CONCEPT_THEME.sky}33` }}>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: CONCEPT_THEME.sky }}>Changing From</div>
              <div className="text-sm font-semibold" style={{ color: CONCEPT_THEME.navy }}>
                {formatMemberShiftDate(selectedShiftChangeAssignmentObj.date)}
              </div>
              <div className="text-xs" style={{ color: CONCEPT_THEME.muted }}>
                {SHIFT_UI_META[selectedShiftChangeAssignmentObj.shiftType]?.label || selectedShiftChangeAssignmentObj.shiftType}
              </div>
            </div>
            <div className="rounded-xl px-3 py-2.5 border" style={{ background: `${CONCEPT_THEME.emerald}08`, borderColor: `${CONCEPT_THEME.emerald}33` }}>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: CONCEPT_THEME.emerald }}>Preferred Replacement</div>
              <div className="text-sm font-semibold" style={{ color: CONCEPT_THEME.navy }}>
                {shiftChangeForm.requestedDate ? formatMemberShiftDate(shiftChangeForm.requestedDate) : 'Any available date'}
              </div>
              <div className="text-xs" style={{ color: CONCEPT_THEME.muted }}>
                {shiftChangeForm.requestedShiftType
                  ? (SHIFT_UI_META[shiftChangeForm.requestedShiftType]?.label || shiftChangeForm.requestedShiftType)
                  : 'Any shift'}
              </div>
            </div>
          </div>

          <form className="grid grid-cols-1 md:grid-cols-3 gap-2.5" onSubmit={submitShiftChangeRequest}>
            <select
              value={shiftChangeForm.requestedDate}
              onChange={(e) => setShiftChangeForm((prev) => ({ ...prev, requestedDate: e.target.value }))}
              className="px-3 py-2 rounded-xl text-xs border"
              style={{ borderColor: CONCEPT_THEME.border, background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}
            >
              <option value="">Any available date</option>
              {availableShiftRequestDatesForSelection.map((date) => (
                <option key={`shift-change-date-${date}`} value={date}>
                  {formatMemberShiftDate(date)} ({date})
                </option>
              ))}
            </select>
            <select
              value={shiftChangeForm.requestedShiftType}
              onChange={(e) => setShiftChangeForm((prev) => ({ ...prev, requestedShiftType: e.target.value }))}
              className="px-3 py-2 rounded-xl text-xs border"
              style={{ borderColor: CONCEPT_THEME.border, background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}
            >
              <option value="">Any shift</option>
              {(shiftChangeForm.requestedDate ? availableShiftRequestTypes : SHIFT_ORDER).map((shiftType) => (
                <option key={`shift-change-type-${shiftType}`} value={shiftType}>
                  {SHIFT_UI_META[shiftType]?.label || shiftType}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={shiftChangeForm.reason}
              onChange={(e) => setShiftChangeForm((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Reason (required)"
              className="px-3 py-2 rounded-xl text-xs border"
              style={{ borderColor: CONCEPT_THEME.border, background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}
            />
            <div className="md:col-span-3 flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: CONCEPT_THEME.navy, color: 'white' }}
              >
                Submit Request
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedShiftChangeSource('');
                  setShiftChangeForm({ requestedDate: '', requestedShiftType: '', reason: '' });
                  setMemberShiftChangeError('');
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ color: CONCEPT_THEME.muted }}
              >
                Cancel
              </button>
            </div>
          </form>

          {memberShiftChangeError && (
            <div className="mt-2 text-xs rounded px-2.5 py-2" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
              {memberShiftChangeError}
            </div>
          )}
        </div>
      )}

      {shiftChangeSubmittedFlash && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border concept-anim-fade" style={{ background: CONCEPT_THEME.emeraldLight, borderColor: `${CONCEPT_THEME.emerald}33`, color: CONCEPT_THEME.emerald }}>
          <span className="text-xs font-semibold">Request submitted. Admin will review this shortly.</span>
        </div>
      )}

      <div className="rounded-2xl px-5 py-4 bg-white border shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex items-center gap-2 mb-3">
          <h4 className="concept-font-display text-sm font-bold" style={{ color: CONCEPT_THEME.navy }}>Request History</h4>
          {memberShiftChangeSummary.pending > 0 && (
            <span className="text-[10px] px-2 py-1 rounded-lg font-bold" style={{ background: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.amber }}>
              {memberShiftChangeSummary.pending} pending
            </span>
          )}
        </div>

        {memberShiftRequests.length === 0 ? (
          <div className="text-xs text-center py-3" style={{ color: CONCEPT_THEME.muted }}>No shift change requests yet.</div>
        ) : (
          <div className="space-y-2">
            {memberShiftRequests.map((request) => {
              const statusStyle = request.status === 'Approved'
                ? { bg: CONCEPT_THEME.emeraldLight, color: CONCEPT_THEME.emerald }
                : request.status === 'Rejected'
                  ? { bg: '#fee2e2', color: '#b91c1c' }
                  : { bg: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.amber };
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
                      <div className="text-xs font-semibold" style={{ color: CONCEPT_THEME.navy }}>
                        {formatMemberShiftDate(request.sourceDate)} | {SHIFT_UI_META[request.sourceShiftType]?.label || request.sourceShiftType || 'Unknown shift'}
                      </div>
                      <div className="text-[11px] truncate mt-0.5" style={{ color: CONCEPT_THEME.muted }}>{request.reason || 'No reason provided'}</div>
                    </div>
                    <span className="px-2 py-1 rounded-lg text-[11px] font-bold" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                      {request.status}
                    </span>
                  </button>
                  {expanded && (
                    <div className="mt-1 ml-2 mr-1 rounded-xl px-3 py-2 border text-xs" style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border }}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <span className="font-semibold" style={{ color: CONCEPT_THEME.muted }}>Submitted:</span>{' '}
                          <span style={{ color: CONCEPT_THEME.text }}>{new Date(request.createdAt).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="font-semibold" style={{ color: CONCEPT_THEME.muted }}>Preferred:</span>{' '}
                          <span style={{ color: CONCEPT_THEME.text }}>
                            {request.requestedDate
                              ? `${formatMemberShiftDate(request.requestedDate)} | ${SHIFT_UI_META[request.requestedShiftType]?.label || request.requestedShiftType || 'Any shift'}`
                              : 'Any available slot'}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold" style={{ color: CONCEPT_THEME.muted }}>Admin Reassignment:</span>{' '}
                          <span style={{ color: request.reassignedDate ? CONCEPT_THEME.emerald : CONCEPT_THEME.text }}>
                            {request.reassignedDate
                              ? `${formatMemberShiftDate(request.reassignedDate)} | ${SHIFT_UI_META[request.reassignedShiftType]?.label || request.reassignedShiftType}`
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
