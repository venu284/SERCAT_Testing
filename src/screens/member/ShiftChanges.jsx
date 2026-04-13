import React from 'react';
import { SHIFT_ORDER, SHIFT_UI_META } from '../../lib/constants';
import { CONCEPT_THEME } from '../../lib/theme';
import { useMockApp } from '../../lib/mock-state';

export default function ShiftChanges() {
  const {
    cycle,
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
        <h3 className="concept-font-display text-lg font-bold" style={{ color: CONCEPT_THEME.navy }}>Shift Change Request</h3>
        <p className="text-sm mt-1" style={{ color: CONCEPT_THEME.muted }}>
          Select a current assigned shifts, then submit your request for reassignment.
        </p>
      </div>

      <div className="rounded-2xl px-5 py-4 bg-white border shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h4 className="concept-font-display text-sm font-bold" style={{ color: CONCEPT_THEME.navy }}>Your Current Assigned Shifts</h4>
          <span className="rounded-lg px-2 py-1 text-xs font-semibold" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}>
            {sortedCurrentMemberAssignments.length} shifts
          </span>
        </div>
        {sortedCurrentMemberAssignments.length === 0 ? (
          <div className="text-sm" style={{ color: CONCEPT_THEME.muted }}>
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
                  <div className="text-sm font-bold" style={{ color: CONCEPT_THEME.navy }}>{formatMemberShiftDate(assignment.date)}</div>
                  <div className="mt-0.5 text-xs" style={{ color: CONCEPT_THEME.text }}>{meta.label} ({meta.sub})</div>
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
              <div className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: CONCEPT_THEME.sky }}>Changing From</div>
              <div className="text-sm font-semibold" style={{ color: CONCEPT_THEME.navy }}>
                {formatMemberShiftDate(selectedShiftChangeAssignmentObj.date)}
              </div>
              <div className="text-sm" style={{ color: CONCEPT_THEME.muted }}>
                {SHIFT_UI_META[selectedShiftChangeAssignmentObj.shiftType]?.label || selectedShiftChangeAssignmentObj.shiftType}
              </div>
            </div>
            <div className="rounded-xl px-3 py-2.5 border" style={{ background: `${CONCEPT_THEME.emerald}08`, borderColor: `${CONCEPT_THEME.emerald}33` }}>
              <div className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: CONCEPT_THEME.emerald }}>Preferred Replacement</div>
              <div className="text-sm font-semibold" style={{ color: CONCEPT_THEME.navy }}>
                {shiftChangeForm.requestedDate ? formatMemberShiftDate(shiftChangeForm.requestedDate) : 'Select Date'}
              </div>
              <div className="text-sm" style={{ color: CONCEPT_THEME.muted }}>
                {shiftChangeForm.requestedShiftType
                  ? (SHIFT_UI_META[shiftChangeForm.requestedShiftType]?.label || shiftChangeForm.requestedShiftType)
                  : 'Select Shift Type'}
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
              className="rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: CONCEPT_THEME.border, background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}
            />
            <select
              value={shiftChangeForm.requestedShiftType}
              onChange={(e) => setShiftChangeForm((prev) => ({ ...prev, requestedShiftType: e.target.value }))}
              className="rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: CONCEPT_THEME.border, background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}
            >
              <option value="">Select Shift Type</option>
              {(shiftChangeForm.requestedDate ? availableShiftRequestTypes : SHIFT_ORDER).map((shiftType) => (
                <option key={`shift-change-type-${shiftType}`} value={shiftType}>
                  {SHIFT_UI_META[shiftType]?.label || shiftType}
                </option>
              ))}
            </select>
            <div className="md:col-span-2 flex items-center gap-2">
              <button
                type="submit"
                className="rounded-xl px-4 py-2 text-sm font-bold"
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
                className="rounded-xl px-3 py-2 text-sm font-semibold"
                style={{ color: CONCEPT_THEME.muted }}
              >
                Cancel
              </button>
            </div>
          </form>

          {memberShiftChangeError && (
            <div className="mt-2 text-sm rounded px-2.5 py-2" style={{ background: CONCEPT_THEME.errorLight, color: CONCEPT_THEME.error, border: `1px solid ${CONCEPT_THEME.error}33` }}>
              {memberShiftChangeError}
            </div>
          )}
        </div>
      )}

      {shiftChangeSubmittedFlash && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border concept-anim-fade" style={{ background: CONCEPT_THEME.emeraldLight, borderColor: `${CONCEPT_THEME.emerald}33`, color: CONCEPT_THEME.emerald }}>
          <span className="text-sm font-semibold">Request submitted. Admin will review this shortly.</span>
        </div>
      )}

      <div className="rounded-2xl px-5 py-4 bg-white border shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="flex items-center gap-2 mb-3">
          <h4 className="concept-font-display text-sm font-bold" style={{ color: CONCEPT_THEME.navy }}>Request History</h4>
          {memberShiftChangeSummary.pending > 0 && (
            <span className="rounded-lg px-2 py-1 text-xs font-bold" style={{ background: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.accentOnAccent }}>
              {memberShiftChangeSummary.pending} pending
            </span>
          )}
        </div>

        {memberShiftRequests.length === 0 ? (
          <div className="text-sm text-center py-3" style={{ color: CONCEPT_THEME.muted }}>No shift change requests yet.</div>
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
                      <div className="text-sm font-semibold" style={{ color: CONCEPT_THEME.navy }}>
                        {formatMemberShiftDate(request.sourceDate)} | {SHIFT_UI_META[request.sourceShiftType]?.label || request.sourceShiftType || 'Unknown shift'}
                      </div>
                      {request.reason ? (
                        <div className="mt-0.5 truncate text-xs" style={{ color: CONCEPT_THEME.muted }}>{request.reason}</div>
                      ) : null}
                    </div>
                    <span className="rounded-lg px-2 py-1 text-xs font-bold" style={{ background: statusStyle.bg, color: statusStyle.color }}>
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
