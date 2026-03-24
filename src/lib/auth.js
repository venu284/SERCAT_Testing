export const ADMIN_ACCOUNT = { username: 'admin', password: 'Admin@123' };

export const sanitizeUsername = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

export const normalizeLoginKey = (value) => String(value || '').trim().toLowerCase();
export const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

export function buildTestAccounts(members, memberAccessAccounts = []) {
  const taken = new Set([ADMIN_ACCOUNT.username]);
  const activeMemberIds = new Set(
    (Array.isArray(members) ? members : [])
      .filter((member) => member?.status === 'ACTIVE')
      .map((member) => member.id),
  );
  const membersById = {};
  const membersByUsername = {};
  const membersByLogin = {};
  const approvedAccessAccounts = [];

  members
    .filter((member) => activeMemberIds.has(member.id))
    .forEach((member, idx) => {
    const fallback = `member${idx + 1}`;
    const base = sanitizeUsername(member.id) || fallback;
    let username = base;
    let suffix = 2;
    while (taken.has(username)) {
      username = `${base}${suffix}`;
      suffix += 1;
    }
    taken.add(username);
    const account = { role: 'member', memberId: member.id, username, password: `${username}@123`, accountType: 'legacy' };
    membersById[member.id] = account;
    membersByUsername[username] = account;
    membersByLogin[normalizeLoginKey(username)] = account;
    });

  memberAccessAccounts
    .filter((entry) => String(entry.status || 'ACTIVE') === 'ACTIVE' && activeMemberIds.has(entry.memberId))
    .forEach((entry) => {
      const email = normalizeEmail(entry.email);
      const username = normalizeLoginKey(entry.username || email);
      if (!email || !username || !entry.memberId) return;
      const account = {
        role: 'member',
        memberId: entry.memberId,
        username,
        email,
        password: String(entry.password || ''),
        accountType: 'pi',
        accessId: entry.id,
      };
      membersByLogin[email] = account;
      membersByLogin[username] = account;
      approvedAccessAccounts.push(account);
    });

  return {
    admin: { role: 'admin', ...ADMIN_ACCOUNT },
    membersById,
    membersByUsername,
    membersByLogin,
    approvedAccessAccounts,
  };
}
