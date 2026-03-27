export const COLORS = {
  MIT: '#2563eb',
  Duke: '#7c3aed',
  UGA: '#dc2626',
  Emory: '#059669',
  MUSC: '#d97706',
  Tulane: '#ec4899',
};

export const MEMBER_BG = {
  MIT: '#dbeafe',
  Duke: '#ede9fe',
  UGA: '#fee2e2',
  Emory: '#d1fae5',
  MUSC: '#fef3c7',
  Tulane: '#fce7f3',
};

export const EXTRA_COLORS = ['#0f766e', '#be123c', '#4338ca', '#b45309', '#0369a1', '#4f46e5', '#15803d', '#9f1239'];
export const EXTRA_MEMBER_BG = ['#ccfbf1', '#ffe4e6', '#e0e7ff', '#fef3c7', '#dbeafe', '#e0e7ff', '#dcfce7', '#ffe4e6'];

export const CONCEPT_THEME = {
  navy: '#0f2a4a',
  navyLight: '#1d4270',
  navyMuted: '#3b6390',
  cream: '#f5f6f8',
  warmWhite: '#ffffff',
  sand: '#ebedf1',
  sandDark: '#dde0e5',
  amber: '#c8920a',
  amberLight: '#faf0d4',
  amberSoft: '#f5e8c0',
  accentText: '#8a6500',
  accentOnAccent: '#6d5000',
  amberText: '#8a6500',
  amberOnAmber: '#6d5000',
  emerald: '#1a7a4c',
  emeraldLight: '#e6f5ed',
  error: '#b42828',
  errorLight: '#fee2e2',
  sky: '#2b7bb5',
  skyLight: '#e3f0fa',
  teal: '#0c6e6d',
  tealLight: '#e0f2f1',
  text: '#1a2332',
  muted: '#556270',
  subtle: '#8b95a2',
  border: '#d4d9e0',
  borderLight: '#e8ebf0',
  morning: '#1a5f8f',
  afternoon: '#6d3ac9',
  night: '#0f2a4a',
  morningBg: '#e0eef8',
  afternoonBg: '#ede8f8',
  nightBg: '#e2e6ee',
};

export function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function ensureMemberPalette(memberId, indexHint = 0) {
  if (!COLORS[memberId]) {
    COLORS[memberId] = EXTRA_COLORS[(simpleHash(memberId) + indexHint) % EXTRA_COLORS.length];
  }
  if (!MEMBER_BG[memberId]) {
    MEMBER_BG[memberId] = EXTRA_MEMBER_BG[(simpleHash(memberId) + indexHint) % EXTRA_MEMBER_BG.length];
  }
}
