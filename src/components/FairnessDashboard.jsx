import React from 'react';
import { COLORS } from '../lib/theme';

export default function FairnessDashboard({ results, initialQueue }) {
  if (!results) return null;
  const { memberSatisfaction, updatedPriorityQueue, workingQueueFinal, deviation } = results.fairness;
  const maxScore = Math.max(...memberSatisfaction.map((m) => m.averageSatisfaction), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border p-3 shadow-sm text-center">
          <div className="text-2xl font-bold text-gray-800">{deviation.mean.toFixed(3)}</div>
          <div className="text-xs text-gray-500">Mean Satisfaction</div>
        </div>
        <div className="bg-white rounded-lg border p-3 shadow-sm text-center">
          <div className="text-2xl font-bold text-gray-800">{deviation.stdDev.toFixed(3)}</div>
          <div className="text-xs text-gray-500">Std Deviation</div>
        </div>
        <div className="bg-white rounded-lg border p-3 shadow-sm text-center">
          <div className="text-2xl font-bold text-gray-800">{results.metadata.totalConflicts}</div>
          <div className="text-xs text-gray-500">Conflicts Resolved</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4 shadow-sm">
        <h4 className="font-semibold text-gray-700 text-sm mb-3">Member Satisfaction Scores</h4>
        <div className="space-y-2">
          {[...memberSatisfaction].sort((a, b) => b.averageSatisfaction - a.averageSatisfaction).map((m) => (
            <div key={m.memberId} className="flex items-center gap-3">
              <span className="w-16 text-xs font-semibold" style={{ color: COLORS[m.memberId] }}>{m.memberId}</span>
              <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
                <div className="h-full rounded-full transition-all" style={{ width: `${(m.averageSatisfaction / maxScore) * 100}%`, backgroundColor: COLORS[m.memberId] }} />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">{m.averageSatisfaction.toFixed(3)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4 shadow-sm">
        <h4 className="font-semibold text-gray-700 text-sm mb-3">Priority Queue Evolution</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-gray-500"><th className="text-left py-1 px-2">Member</th><th className="text-right py-1 px-2">Initial Deficit</th><th className="text-right py-1 px-2">After Engine</th><th className="text-right py-1 px-2">Next Cycle</th><th className="text-right py-1 px-2">Delta</th></tr></thead>
            <tbody>
              {updatedPriorityQueue.map((q) => {
                const init = initialQueue.find((iq) => iq.memberId === q.memberId)?.deficitScore || 0;
                const after = workingQueueFinal.find((wq) => wq.memberId === q.memberId)?.deficitScore || 0;
                const delta = q.deficitScore - init;
                return (
                  <tr key={q.memberId} className="border-b border-gray-50">
                    <td className="py-1.5 px-2 font-semibold" style={{ color: COLORS[q.memberId] }}>{q.memberId}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{init.toFixed(4)}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{after.toFixed(4)}</td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold">{q.deficitScore.toFixed(4)}</td>
                    <td className={`py-1.5 px-2 text-right font-mono ${delta > 0 ? 'text-red-600' : delta < 0 ? 'text-green-600' : 'text-gray-400'}`}>{delta >= 0 ? '+' : ''}{delta.toFixed(4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
