import React, { useMemo, useState } from 'react';
import ShiftSlotCalendar from './ShiftSlotCalendar';
import { COLORS, MEMBER_BG } from '../lib/theme';

export default function CalendarResults({ results, cycle, members, memberDirectory = {}, originalChoiceMarks = {} }) {
  const [filterMember, setFilterMember] = useState('all');
  const [showOriginalChoices, setShowOriginalChoices] = useState(false);
  const visibleOriginalChoiceMarks = useMemo(() => {
    if (!showOriginalChoices) return {};
    if (filterMember === 'all') return originalChoiceMarks;
    const filtered = {};
    Object.entries(originalChoiceMarks).forEach(([slotKey, marks]) => {
      const keep = marks.filter((mark) => mark.startsWith(`${filterMember} `));
      if (keep.length > 0) filtered[slotKey] = keep;
    });
    return filtered;
  }, [showOriginalChoices, filterMember, originalChoiceMarks]);

  if (!results) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-gray-600">Filter:</span>
        <button onClick={() => setFilterMember('all')} className={`px-3 py-1 rounded text-xs font-medium ${filterMember === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All Members</button>
        {members.map((m) => (
          <button
            key={m.id}
            onClick={() => setFilterMember(m.id)}
            className="px-3 py-1 rounded text-xs font-medium transition-all"
            style={filterMember === m.id ? { backgroundColor: COLORS[m.id], color: 'white' } : { backgroundColor: MEMBER_BG[m.id], color: COLORS[m.id] }}
          >
            {m.id}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowOriginalChoices((prev) => !prev)}
          className={`px-3 py-1 rounded text-xs font-medium border ${showOriginalChoices ? 'bg-slate-700 text-white border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'}`}
        >
          {showOriginalChoices ? 'Hide Original Choices' : 'Show Original Choices'}
        </button>
      </div>
      <ShiftSlotCalendar
        cycle={cycle}
        assignments={results.assignments}
        editable={false}
        filterMember={filterMember}
        memberDirectory={memberDirectory}
        preferenceMarks={visibleOriginalChoiceMarks}
        showPreferenceOverlay={showOriginalChoices}
      />
      <div className="bg-white rounded-lg border p-3 shadow-sm">
        <h4 className="font-semibold text-gray-700 text-sm mb-2">Calendar Summary</h4>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">Assigned Slots: {results.assignments.filter((a) => filterMember === 'all' || a.memberId === filterMember).length}</span>
          <span className="px-2 py-1 rounded bg-green-100 text-green-700">First Choice: {results.assignments.filter((a) => (filterMember === 'all' || a.memberId === filterMember) && a.assignmentType === 'FIRST_CHOICE').length}</span>
          <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700">Second Choice: {results.assignments.filter((a) => (filterMember === 'all' || a.memberId === filterMember) && a.assignmentType === 'SECOND_CHOICE').length}</span>
          <span className="px-2 py-1 rounded bg-orange-100 text-orange-700">Proximity: {results.assignments.filter((a) => (filterMember === 'all' || a.memberId === filterMember) && a.assignmentType === 'PROXIMITY').length}</span>
          <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">Backfill: {results.assignments.filter((a) => (filterMember === 'all' || a.memberId === filterMember) && a.assignmentType === 'BACKFILL_ASSIGNED').length}</span>
          <span className="px-2 py-1 rounded bg-red-100 text-red-700">Auto: {results.assignments.filter((a) => (filterMember === 'all' || a.memberId === filterMember) && a.assignmentType === 'AUTO_ASSIGNED').length}</span>
        </div>
      </div>
    </div>
  );
}
