import React from 'react';
import CalendarResults from '../../components/CalendarResults';
import { COLORS } from '../../lib/theme';
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
    <div className="space-y-4">
      <div className="bg-white rounded-lg border p-4 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-2 text-sm">Engine & Schedule</h3>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button onClick={loadSamplePrefs} className="px-3 py-2 rounded bg-purple-100 text-purple-700 text-xs font-semibold hover:bg-purple-200">Load Sample Data</button>
          <button onClick={runEngine} disabled={engineProgress.running || activeMembers.length === 0} className={`px-4 py-2 rounded text-xs font-bold ${engineProgress.running || activeMembers.length === 0 ? 'bg-gray-200 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Generate Draft ({submittedCount}/{activeMembers.length} submitted)</button>
          {results && schedulePublication.status === 'draft' && <button onClick={publishSchedule} className="px-3 py-2 rounded bg-emerald-100 text-emerald-700 text-xs font-semibold hover:bg-emerald-200">Publish Schedule</button>}
          {results && schedulePublication.status === 'published' && <button onClick={markScheduleDraft} className="px-3 py-2 rounded bg-amber-100 text-amber-700 text-xs font-semibold hover:bg-amber-200">Move Back To Draft</button>}
          <span className={`px-2 py-1 rounded text-xs font-semibold ${schedulePublication.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{schedulePublication.status === 'published' ? 'Published' : 'Draft Review'}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded overflow-hidden"><div className="h-full bg-blue-600 transition-all" style={{ width: `${engineProgress.value}%` }} /></div>
        <div className="text-xs text-gray-500 mt-1">{engineProgress.message}</div>
      </div>

      <CalendarResults results={results} cycle={cycle} members={members} memberDirectory={memberDirectory} originalChoiceMarks={originalChoiceMarks} />

      {results && (
        <div className="bg-white rounded-lg border p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-2 text-sm">Generated Assignment Table</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b text-gray-500"><th className="text-left py-1 px-2">Member</th><th className="text-left py-1 px-2">Date</th><th className="text-left py-1 px-2">Shift</th><th className="text-left py-1 px-2">Type</th><th className="text-left py-1 px-2">Share</th></tr></thead>
              <tbody>{results.assignments.map((assignment, idx) => <tr key={`${assignment.memberId}-${assignment.date}-${assignment.shiftType}-${idx}`} className="border-b border-gray-50"><td className="py-1.5 px-2" style={{ color: COLORS[assignment.memberId] }}>{assignment.memberId}</td><td className="py-1.5 px-2">{assignment.date}</td><td className="py-1.5 px-2">{assignment.shiftType}</td><td className="py-1.5 px-2">{assignment.assignmentType}</td><td className="py-1.5 px-2">{assignment.shareIndex || '-'}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
