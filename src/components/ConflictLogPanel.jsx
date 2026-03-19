import React from 'react';

export default function ConflictLogPanel({ results }) {
  if (!results) return null;
  const phaseColors = { 'Phase 0': '#6b7280', 'Phase 1': '#6b7280', 'Phase 2': '#2563eb', 'Phase 3': '#7c3aed', 'Phase 4': '#d97706', 'Phase 5': '#dc2626', 'Phase 6': '#059669' };

  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      <div className="p-3 border-b bg-gray-50">
        <h4 className="font-semibold text-gray-700 text-sm">Engine Execution Log ({results.engineLog.length} entries)</h4>
        <div className="flex gap-3 mt-1 text-xs text-gray-500">
          <span>Rounds: {results.metadata.totalRounds}</span>
          <span>Conflicts: {results.metadata.totalConflicts}</span>
          <span>Proximity: {results.metadata.totalProximity}</span>
          <span>Auto-assigned: {results.metadata.totalAuto}</span>
          <span>Backfill-assigned: {results.metadata.totalBackfill || 0}</span>
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
        {results.engineLog.map((entry, i) => (
          <div key={i} className="px-3 py-1.5 text-xs flex items-start gap-2 hover:bg-gray-50">
            <span className="font-mono font-bold whitespace-nowrap px-1.5 py-0.5 rounded" style={{ color: phaseColors[entry.phase] || '#6b7280', backgroundColor: `${phaseColors[entry.phase] || '#6b7280'}15` }}>{entry.phase}</span>
            <span className="font-semibold text-gray-700 whitespace-nowrap min-w-24">{entry.action}</span>
            <span className="text-gray-500 break-all">{typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details)}</span>
          </div>
        ))}
      </div>
      {results.errors.length > 0 && (
        <div className="p-3 bg-red-50 border-t border-red-200">
          <h5 className="font-semibold text-red-700 text-xs mb-1">Hard Errors</h5>
          {results.errors.map((e, i) => <div key={i} className="text-xs text-red-600">• {e}</div>)}
        </div>
      )}
    </div>
  );
}
