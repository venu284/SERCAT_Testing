import React from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, formatCalendarDate, localTodayDateStr, toDateStr } from '../../lib/dates';
import { CONCEPT_THEME } from '../../lib/theme';
import { useMockApp } from '../../lib/mock-state';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const {
    activeMembers,
    pendingMembers,
    submittedCount,
    schedulePublication,
    cycle,
  } = useMockApp();

  const preferenceDeadline = cycle.preferenceDeadline || addDays(cycle.startDate, -7);
  const published = schedulePublication.status === 'published';
  const submissionPct = activeMembers.length > 0 ? Math.round((submittedCount / activeMembers.length) * 100) : 0;
  const timeline = [
    { label: 'Cycle Start', date: cycle.startDate, done: localTodayDateStr() >= cycle.startDate },
    { label: 'Deadline', date: preferenceDeadline, done: localTodayDateStr() > preferenceDeadline },
    { label: 'Schedule', date: published ? (schedulePublication.publishedAt ? toDateStr(new Date(schedulePublication.publishedAt)) : 'Published') : 'Pending', done: published, active: !published },
    { label: 'Cycle End', date: cycle.endDate, done: localTodayDateStr() > cycle.endDate },
  ];

  return (
    <div className="space-y-5 concept-font-body concept-anim-fade">
      <div className="rounded-2xl overflow-hidden concept-anim-pulse" style={{ background: `linear-gradient(135deg, ${CONCEPT_THEME.amberLight} 0%, ${CONCEPT_THEME.amberSoft} 100%)`, border: `1px solid ${CONCEPT_THEME.amber}44` }}>
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${CONCEPT_THEME.amber}20` }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={CONCEPT_THEME.amber} strokeWidth="2" strokeLinecap="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="concept-font-display text-2xl font-bold" style={{ color: CONCEPT_THEME.navy }}>
              {published ? 'Schedule Is Published' : 'Run Cycle Requires Action'}
            </div>
            <p className="text-sm mt-1" style={{ color: CONCEPT_THEME.navyMuted }}>
              {published
                ? 'Members can now view assignments. Use Engine & Schedule to revise or move back to draft.'
                : `${submittedCount}/${activeMembers.length} active members submitted. Open Engine & Schedule to generate or publish.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/engine')}
            className="px-6 py-3 rounded-xl text-sm font-bold flex-shrink-0"
            style={{ background: CONCEPT_THEME.navy, color: 'white' }}
          >
            {'Open Engine ->'}
          </button>
        </div>
        <div className="px-6 pb-4 text-sm font-semibold" style={{ color: CONCEPT_THEME.amberOnAmber }}>
          Cycle {cycle.id} | Preference deadline: {formatCalendarDate(preferenceDeadline)}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Members', value: activeMembers.length, sub: 'in cycle', accent: CONCEPT_THEME.navy },
          { label: 'Invited Members', value: pendingMembers.length, sub: 'awaiting activation', accent: CONCEPT_THEME.amberText },
          { label: 'Submissions', value: `${submittedCount}/${activeMembers.length || 0}`, sub: `${submissionPct}% complete`, accent: CONCEPT_THEME.sky },
          { label: 'Publication', value: published ? 'Published' : 'Draft', sub: published ? 'member-visible' : 'review mode', accent: published ? CONCEPT_THEME.emerald : CONCEPT_THEME.navyMuted },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl px-4 py-3" style={{ background: CONCEPT_THEME.warmWhite, border: `1px solid ${CONCEPT_THEME.borderLight}` }}>
            <div className="mb-1 text-sm font-semibold" style={{ color: CONCEPT_THEME.muted }}>{stat.label}</div>
            <div className="concept-font-display text-2xl font-bold" style={{ color: stat.accent }}>{stat.value}</div>
            <div className="mt-0.5 text-sm" style={{ color: CONCEPT_THEME.muted }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl px-6 py-5" style={{ background: CONCEPT_THEME.warmWhite, border: `1px solid ${CONCEPT_THEME.borderLight}` }}>
        <h3 className="concept-font-display text-base font-bold mb-4" style={{ color: CONCEPT_THEME.navy }}>Cycle Timeline</h3>
        <div className="h-1.5 rounded-full" style={{ background: CONCEPT_THEME.sand }}>
          <div className="h-full rounded-full" style={{ width: `${published ? 82 : 46}%`, background: `linear-gradient(90deg, ${CONCEPT_THEME.emerald}, ${CONCEPT_THEME.sky})` }} />
        </div>
        <div className="flex justify-between mt-3 gap-2">
          {timeline.map((item) => (
            <div key={item.label} className="flex flex-col items-center min-w-[66px]">
              <div
                className="w-3 h-3 rounded-full border-2"
                style={{
                  background: item.done ? CONCEPT_THEME.emerald : item.active ? CONCEPT_THEME.amber : CONCEPT_THEME.sand,
                  borderColor: item.done ? CONCEPT_THEME.emerald : item.active ? CONCEPT_THEME.amber : CONCEPT_THEME.sandDark,
                }}
              />
              <div className="mt-1 text-xs font-semibold text-center" style={{ color: item.done ? CONCEPT_THEME.emerald : item.active ? CONCEPT_THEME.amberText : CONCEPT_THEME.muted }}>
                {item.label}
              </div>
              <div className="text-xs text-center" style={{ color: CONCEPT_THEME.muted }}>
                {item.date === 'Pending' || item.date === 'Published' ? item.date : formatCalendarDate(item.date)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl px-6 py-5" style={{ background: CONCEPT_THEME.warmWhite, border: `1px solid ${CONCEPT_THEME.borderLight}` }}>
        <h3 className="concept-font-display text-base font-bold" style={{ color: CONCEPT_THEME.navy }}>Submission Readiness</h3>
        <p className="text-xs mt-1" style={{ color: CONCEPT_THEME.muted }}>
          Track member submissions before generating a draft schedule.
        </p>
        <div className="mt-4 h-2 rounded overflow-hidden" style={{ background: CONCEPT_THEME.sand }}>
          <div className="h-full" style={{ width: `${submissionPct}%`, background: CONCEPT_THEME.sky }} />
        </div>
        <div className="text-xs mt-2" style={{ color: CONCEPT_THEME.muted }}>
          {submissionPct}% of active members submitted preferences.
        </div>
      </div>
    </div>
  );
}
