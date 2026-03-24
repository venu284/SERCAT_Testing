import { ensureMemberPalette } from '../lib/theme';

const DEFAULT_ACTIVATED_AT = '2026-01-01T00:00:00Z';

function buildPlaceholderPiName(member) {
  return `PI Contact ${member.id}`;
}

function buildPlaceholderPiEmail(member) {
  const localPart = String(member.id || 'member')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  return `${localPart || 'member'}@member-demo.org`;
}

export const INITIAL_MEMBERS = [
  { id: 'UGA', name: 'University of Georgia', shares: 2.11, status: 'ACTIVE' },
  { id: 'RF', name: 'RF', shares: 0.53, status: 'ACTIVE' },
  { id: 'UAMS1', name: 'MASS1', shares: 1, status: 'ACTIVE' },
  { id: 'UAMS2', name: 'MASS2', shares: 0.5, status: 'ACTIVE' },
  { id: 'UMKC', name: 'KC', shares: 1, status: 'ACTIVE' },
  { id: 'UNC', name: 'University of North Carolina', shares: 2, status: 'ACTIVE' },
  { id: 'UND', name: 'ND', shares: 1, status: 'ACTIVE' },
  { id: 'USC', name: 'University of South Carolina', shares: 1, status: 'ACTIVE' },
  { id: 'USF', name: 'University of South Florida', shares: 1, status: 'ACTIVE' },
  { id: 'UTA', name: 'Anderson', shares: 2.2, status: 'ACTIVE' },
  { id: 'UVA', name: 'Virginia', shares: 2, status: 'ACTIVE' },
  { id: 'DUKE', name: 'DUKE', shares: 2, status: 'ACTIVE' },
  { id: 'Emory', name: 'Emory University', shares: 4, status: 'ACTIVE' },
  { id: 'GT', name: 'Georgia Institute of Technology', shares: 1, status: 'ACTIVE' },
  { id: 'BAYER', name: 'Bayer', shares: 1, status: 'ACTIVE' },
  { id: 'USFC', name: 'SFC', shares: 1, status: 'ACTIVE' },
  { id: 'St.Jude', name: 'St.Jude', shares: 3, status: 'ACTIVE' },
  { id: 'UKY', name: 'UKY', shares: 2, status: 'ACTIVE' },
  { id: 'NIH', name: 'NIH', shares: 5.5, status: 'ACTIVE' },
  { id: 'CDC', name: 'CDC', shares: 1, status: 'ACTIVE' },
].map((member, idx) => {
  ensureMemberPalette(member.id, idx);
  return {
    ...member,
    registrationEnabled: true,
    piName: buildPlaceholderPiName(member),
    piEmail: buildPlaceholderPiEmail(member),
    piPhone: '',
    piRole: '',
    inviteToken: null,
    invitedAt: null,
    activatedAt: member.status === 'ACTIVE' ? DEFAULT_ACTIVATED_AT : null,
  };
});
