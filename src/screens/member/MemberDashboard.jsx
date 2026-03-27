import React from 'react';
import { useNavigate } from 'react-router-dom';
import ConceptShiftBadge from '../../components/ConceptShiftBadge';
import { addDays, formatCalendarDate, localTodayDateStr, toDateStr } from '../../lib/dates';
import { CONCEPT_THEME } from '../../lib/theme';
import { useMockApp } from '../../lib/mock-state';

export default function MemberDashboard() {
  const navigate = useNavigate();
  const {
    activeMember,
    activeMemberEntitlement,
    cycle,
    preferenceDeadline,
    daysUntilPreferenceDeadline,
    isPreferenceSubmitted,
    schedulePublication,
    currentMemberAssignments,
    memberShiftCounts,
  } = useMockApp();

  if (!activeMember) return null;

  const fractionalBlocks = Math.ceil((activeMemberEntitlement.fractionalHours || 0) / 6);
  const totalSlots = activeMemberEntitlement.wholeShares * 3 + fractionalBlocks;
  const totalChoices = totalSlots * 2;
  const published = schedulePublication.status === 'published';
  const heroTitle = isPreferenceSubmitted ? 'Preferences already submitted' : 'Submit Your Preferences';
  const heroDetail = isPreferenceSubmitted
    ? (published
      ? 'Schedule is published. Review your assigned shifts.'
      : 'Submission received. Waiting for admin schedule publication.')
    : (daysUntilPreferenceDeadline < 0
      ? `Deadline passed ${Math.abs(daysUntilPreferenceDeadline)} days(s) ago.`
      : daysUntilPreferenceDeadline === 0
        ? 'Deadline is today. Submit now.'
        : `${daysUntilPreferenceDeadline} day(s) left before deadline.`);

  const timeline = [
    { label: 'Cycle Starts', date: cycle.startDate, done: localTodayDateStr() >= cycle.startDate },
    { label: 'Deadline', date: preferenceDeadline || addDays(cycle.startDate, -7), done: isPreferenceSubmitted, active: !isPreferenceSubmitted },
    { label: 'Schedule', date: published ? (schedulePublication.publishedAt ? toDateStr(new Date(schedulePublication.publishedAt)) : 'Published') : 'Pending', done: published, active: !published },
    { label: 'Cycle Ends', date: cycle.endDate, done: localTodayDateStr() > cycle.endDate },
  ];

  return (
    <div className="space-y-5 concept-font-body concept-anim-fade">
      <div className="rounded-2xl overflow-hidden concept-anim-pulse" style={{ background: `linear-gradient(135deg, ${CONCEPT_THEME.amberLight} 0%, ${CONCEPT_THEME.amberSoft} 100%)`, border: `1px solid ${CONCEPT_THEME.amber}44` }}>
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${CONCEPT_THEME.amber}20` }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={CONCEPT_THEME.amber} strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="concept-font-display text-2xl font-bold" style={{ color: CONCEPT_THEME.navy }}>{heroTitle}</div>
            <p className="mt-1 text-lg" style={{ color: CONCEPT_THEME.text }}>{heroDetail}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(isPreferenceSubmitted ? (published ? '/member/schedule' : '/member/preferences') : '/member/preferences')}
            className="px-6 py-3 rounded-xl text-base font-bold flex-shrink-0"
            style={{ background: CONCEPT_THEME.navy, color: 'white' }}
          >
            {isPreferenceSubmitted ? (published ? 'Open My Schedule' : 'Review Preferences') : 'Start Now ->'}
          </button>
        </div>
        <div className="px-6 pb-4 text-base font-semibold" style={{ color: CONCEPT_THEME.accentOnAccent }}>
          Deadline: {formatCalendarDate(preferenceDeadline)}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Shares', value: activeMember.shares.toFixed(2), accent: CONCEPT_THEME.sky },
          { label: 'Whole Shares', value: activeMemberEntitlement.wholeShares, accent: CONCEPT_THEME.navy },
          { label: 'Fractional Share', value: `${(activeMemberEntitlement.fractionalHours || 0).toFixed(2)} hours`, accent: CONCEPT_THEME.afternoon },

        ].map((stat) => (
          <div key={stat.label} className="rounded-xl px-4 py-3" style={{ background: CONCEPT_THEME.warmWhite, border: `1px solid ${CONCEPT_THEME.borderLight}` }}>
            <div className="mb-1 text-base font-bold" style={{ color: CONCEPT_THEME.text }}>{stat.label}</div>
            <div className="concept-font-display text-2xl font-bold" style={{ color: stat.accent }}>{stat.value}</div>
            <div className="mt-0.5 text-base font-semibold" style={{ color: CONCEPT_THEME.text }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl px-6 py-5" style={{ background: CONCEPT_THEME.warmWhite, border: `1px solid ${CONCEPT_THEME.borderLight}` }}>
        <h3 className="concept-font-display text-base font-bold mb-4" style={{ color: CONCEPT_THEME.navy }}>Cycle Timeline</h3>
        <div className="h-1.5 rounded-full" style={{ background: CONCEPT_THEME.sand }}>
          <div className="h-full rounded-full" style={{ width: `${published ? 75 : 38}%`, background: `linear-gradient(90deg, ${CONCEPT_THEME.emerald}, ${CONCEPT_THEME.sky})` }} />
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
              <div className="mt-1 text-sm font-semibold text-center" style={{ color: item.done ? CONCEPT_THEME.emerald : item.active ? CONCEPT_THEME.accentText : CONCEPT_THEME.muted }}>
                {item.label}
              </div>
              <div className="text-sm text-center" style={{ color: CONCEPT_THEME.muted }}>
                {item.date === 'Pending' || item.date === 'Published' ? item.date : formatCalendarDate(item.date)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl px-6 py-5" style={{ background: CONCEPT_THEME.warmWhite, border: `1px solid ${CONCEPT_THEME.borderLight}` }}>
        <h3 className="concept-font-display text-lg font-bold mb-3" style={{ color: CONCEPT_THEME.navy }}>Shift Allocation</h3>
        <p className="mb-4 text-base" style={{ color: CONCEPT_THEME.text }}>
          Whole shares include Morning, Afternoon, and Night shifts. Fractional Share include Morning or Afternoon shifts.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: activeMemberEntitlement.wholeShares }, (_, idx) => idx + 1).map((shareIndex) => (
            <div key={`share-${shareIndex}`} className="rounded-xl p-3.5" style={{ background: CONCEPT_THEME.sand, border: `1px solid ${CONCEPT_THEME.border}` }}>
              <div className="mb-2 text-base font-bold" style={{ color: CONCEPT_THEME.navy }}>Whole Share {shareIndex}</div>
              <div className="flex flex-wrap gap-2">
                <ConceptShiftBadge shiftType="DS1" />
                <ConceptShiftBadge shiftType="DS2" />
                <ConceptShiftBadge shiftType="NS" />
              </div>
            </div>
          ))}
          {fractionalBlocks > 0 ? (
            <div className="rounded-xl p-3.5" style={{ background: CONCEPT_THEME.sand, border: `1px solid ${CONCEPT_THEME.border}` }}>
              <div className="mb-2 text-base font-bold" style={{ color: CONCEPT_THEME.navy }}>
                Fractional Share ({(activeMemberEntitlement.fractionalHours || 0).toFixed(2)} hours)
              </div>
              <div className="flex flex-wrap gap-2">
                <ConceptShiftBadge shiftType="DS1" />
                <ConceptShiftBadge shiftType="DS2" />
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-4 text-base" style={{ color: CONCEPT_THEME.text }}>
          Assigned now: {currentMemberAssignments.length} total ({memberShiftCounts.DS1 || 0} DS1, {memberShiftCounts.DS2 || 0} DS2, {memberShiftCounts.NS || 0} NS).
        </div>
      </div>
    </div>
  );
}
