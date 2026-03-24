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
  navy: '#1b2e4a',
  navyLight: '#2d4a6f',
  navyMuted: '#4a6585',
  cream: '#faf8f4',
  warmWhite: '#ffffff',
  sand: '#f0ece4',
  sandDark: '#e2dcd0',
  amber: '#d4930d',
  amberLight: '#fdf3dc',
  amberSoft: '#f9ecd0',
  amberText: '#8a6300',
  amberOnAmber: '#785200',
  emerald: '#1a7a4c',
  emeraldLight: '#e6f5ed',
  sky: '#2b7bb5',
  skyLight: '#e3f0fa',
  text: '#374151',
  muted: '#6b7280',
  subtle: '#9ca3af',
  border: '#e5e1d8',
  borderLight: '#eeebe4',
  morning: '#1a5f8f',
  afternoon: '#6d3ac9',
  night: '#1b2e4a',
  morningBg: '#e3f0fa',
  afternoonBg: '#f0ebff',
  nightBg: '#e8ecf2',
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
