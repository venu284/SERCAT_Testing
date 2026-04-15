export function computeEntitlements(members = []) {
  return (members || [])
    .filter((member) => member.status !== 'DEACTIVATED')
    .map((member) => {
      const shares = Number(member.shares) || 0;
      const wholeShares = Math.floor(shares);
      const fractionalHours = Number(((shares - wholeShares) * 24).toFixed(2));
      return {
        memberId: member.id,
        totalShares: shares,
        wholeShares,
        fractionalHours,
        nightShifts: wholeShares,
      };
    });
}
