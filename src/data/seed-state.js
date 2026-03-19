export function createSeedSnapshot() {
  return {
    queue: [],
    preferences: {},
    results: null,
    currentView: 'admin',
    memberTab: 'dashboard',
    adminTab: 'dashboard',
    schedulePublication: { status: 'draft', publishedAt: '', draftedAt: '' },
    shiftChangeRequests: [],
    registrationRequests: [],
    memberAccessAccounts: [],
    dbStatus: 'Browser storage: local mode',
  };
}
