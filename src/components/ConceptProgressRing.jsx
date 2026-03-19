import React from 'react';
import { CONCEPT_THEME } from '../lib/theme';

export default function ConceptProgressRing({ current, total, size = 52 }) {
  const pct = total > 0 ? Math.min(1, current / total) : 0;
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const done = current >= total;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={CONCEPT_THEME.border} strokeWidth={3.5} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={done ? CONCEPT_THEME.emerald : CONCEPT_THEME.amber}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.45s ease-out, stroke 0.2s linear' }}
        />
      </svg>
      <span className="absolute concept-font-body text-xs font-bold" style={{ color: done ? CONCEPT_THEME.emerald : CONCEPT_THEME.navy }}>
        {current}/{total}
      </span>
    </div>
  );
}
