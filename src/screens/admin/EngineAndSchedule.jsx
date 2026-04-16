import React from 'react';
import CalendarResults from '../../components/CalendarResults';
import { ASSIGNMENT_REASON_LABELS } from '../../lib/constants';
import { COLORS, CONCEPT_THEME } from '../../lib/theme';
import { useMockApp } from '../../lib/mock-state';

export default function EngineAndSchedule() {
  const {
    loadSamplePrefs,
    runEngine,
    engineProgress,
    activeMembers,
    submittedCount,
    results,
    schedulePublication,
    publishSchedule,
    markScheduleDraft,
    cycle,
    members,
    memberDirectory,
    originalChoiceMarks,
  } = useMockApp();

  return (
    <div className="space-y-4 concept-font-body">
      <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <h3 className="concept-font-display text-lg font-bold mb-3" style={{ color: CONCEPT_THEME.navy }}>Schedule Generator</h3>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            onClick={loadSamplePrefs}
            className="rounded-xl px-3 py-2 text-sm font-semibold"
            style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text, border: `1px solid ${CONCEPT_THEME.border}` }}
          >
            Load Sample Data
          </button>
          <button
            onClick={runEngine}
            disabled={engineProgress.running || activeMembers.length === 0}
            className="rounded-xl px-4 py-2.5 text-sm font-bold transition-all disabled:cursor-not-allowed"
            style={{
              background: (engineProgress.running || activeMembers.length === 0) ? CONCEPT_THEME.sandDark : CONCEPT_THEME.navy,
              color: (engineProgress.running || activeMembers.length === 0) ? CONCEPT_THEME.muted : 'white',
            }}
          >
            Generate Schedule ({submittedCount}/{activeMembers.length} submitted)
          </button>
          {results && schedulePublication.status === 'draft' && (
            <button
              onClick={publishSchedule}
              className="rounded-xl px-4 py-2 text-sm font-bold"
              style={{ background: CONCEPT_THEME.emeraldLight, color: CONCEPT_THEME.emerald }}
            >
              Publish Schedule
            </button>
          )}
          {results && schedulePublication.status === 'published' && (
            <button
              onClick={markScheduleDraft}
              className="rounded-xl px-4 py-2 text-sm font-bold"
              style={{ background: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.accentOnAccent }}
            >
              Move Back To Draft
            </button>
          )}
          <span
            className="rounded-full px-3 py-1.5 text-xs font-bold"
            style={{
              background: schedulePublication.status === 'published' ? CONCEPT_THEME.emeraldLight : CONCEPT_THEME.amberLight,
              color: schedulePublication.status === 'published' ? CONCEPT_THEME.emerald : CONCEPT_THEME.accentOnAccent,
            }}
          >
            {schedulePublication.status === 'published' ? 'Published' : 'Draft Review'}
          </span>
        </div>
        <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: CONCEPT_THEME.sand }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${engineProgress.value}%`, background: CONCEPT_THEME.navy }} />
        </div>
        <div className="mt-1.5 text-xs" style={{ color: CONCEPT_THEME.muted }}>{engineProgress.message}</div>
      </div>

      <CalendarResults
        results={results}
        cycle={cycle}
        members={members}
        memberDirectory={memberDirectory}
        originalChoiceMarks={originalChoiceMarks}
        showShiftLegend={false}
      />

      {results && (
        <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
          <h3 className="concept-font-display text-base font-bold mb-3" style={{ color: CONCEPT_THEME.navy }}>Generated Assignment Table</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: CONCEPT_THEME.borderLight, color: CONCEPT_THEME.muted }}>
                  <th className="px-2 py-1 text-left">Member</th>
                  <th className="px-2 py-1 text-left">Date</th>
                  <th className="px-2 py-1 text-left">Shift</th>
                  <th className="px-2 py-1 text-left">Type</th>
                  <th className="px-2 py-1 text-left">Share</th>
                </tr>
              </thead>
              <tbody>
                {results.assignments.map((assignment, idx) => (
                  <tr key={`${assignment.memberId}-${assignment.assignedDate}-${assignment.shift}-${idx}`} className="border-b" style={{ borderColor: CONCEPT_THEME.borderLight }}>
                    <td className="px-2 py-1.5" style={{ color: COLORS[assignment.memberId] }}>{assignment.memberId}</td>
                    <td className="px-2 py-1.5" style={{ color: CONCEPT_THEME.text }}>{assignment.assignedDate}</td>
                    <td className="px-2 py-1.5" style={{ color: CONCEPT_THEME.text }}>{assignment.shift}</td>
                    <td className="px-2 py-1.5" style={{ color: CONCEPT_THEME.text }}>{ASSIGNMENT_REASON_LABELS[assignment.assignmentReason] || assignment.assignmentReason}</td>
                    <td className="px-2 py-1.5" style={{ color: CONCEPT_THEME.text }}>{assignment.shareIndex || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
