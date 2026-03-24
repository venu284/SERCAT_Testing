import React from 'react';
import { SHIFT_BADGE_META } from '../lib/constants';
import { CONCEPT_THEME } from '../lib/theme';

export default function ConceptShiftBadge({ shiftType }) {
  const meta = SHIFT_BADGE_META[shiftType] || { label: shiftType, sub: '', color: CONCEPT_THEME.muted, bg: CONCEPT_THEME.sand };
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg concept-font-body text-xs font-semibold"
      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}22` }}
    >
      <span>{meta.label}</span>
      {meta.sub ? <span className="opacity-70">{meta.sub}</span> : null}
    </div>
  );
}
