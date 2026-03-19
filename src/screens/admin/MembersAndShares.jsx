import React from 'react';
import { COLORS, CONCEPT_THEME } from '../../lib/theme';
import { useMockApp } from '../../lib/mock-state';

export default function MembersAndShares() {
  const {
    pendingRegistrationCount,
    pendingRegistrationRequests,
    registrationApprovalDrafts,
    registrationActionErrors,
    setRegistrationApprovalDraft,
    approveRegistrationRequest,
    rejectRegistrationRequest,
    memberDirectory,
    resolvedRegistrationRequests,
    memberStatusFilter,
    setMemberStatusFilter,
    filteredMembersForAdmin,
    updateMember,
    newMemberForm,
    setNewMemberForm,
    addMember,
    testAccounts,
    memberLoginAccounts,
    piAccessAccounts,
    submittedPreferenceNotes,
  } = useMockApp();

  return (
    <div className="space-y-4">
      <div className={`bg-white rounded-lg border p-4 shadow-sm ${pendingRegistrationCount > 0 ? 'ring-1 ring-amber-200' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-semibold text-gray-800 text-sm">PI Registration Requests</h3>
          <span className={`px-2 py-1 rounded text-xs font-semibold ${pendingRegistrationCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
            Pending: {pendingRegistrationCount}
          </span>
        </div>
        {pendingRegistrationCount === 0 ? (
          <div className="text-xs text-gray-500">No pending registration requests.</div>
        ) : (
          <div className="space-y-3">
            {pendingRegistrationRequests.map((request) => {
              const draft = registrationApprovalDrafts[request.id] || {};
              const actionError = registrationActionErrors[request.id];
              const institutionDisplayName = request.institutionLabel || memberDirectory[request.institutionMemberId]?.name || request.institutionMemberId;
              return (
                <div key={request.id} className="rounded border border-amber-100 bg-amber-50/40 p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs mb-2">
                    <div><span className="font-semibold text-gray-700">Institution:</span> {institutionDisplayName} ({request.institutionMemberId})</div>
                    <div><span className="font-semibold text-gray-700">Email:</span> {request.institutionalEmail}</div>
                    <div><span className="font-semibold text-gray-700">Requested shares:</span> {request.requestedShares}</div>
                    <div><span className="font-semibold text-gray-700">Requested at:</span> {new Date(request.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mb-2">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={draft.approvedShares ?? request.requestedShares}
                      onChange={(e) => setRegistrationApprovalDraft(request.id, { approvedShares: e.target.value })}
                      className="border rounded px-2 py-1.5 text-xs"
                      placeholder="Approved shares"
                    />
                    <input
                      type="text"
                      value={draft.adminNote || ''}
                      onChange={(e) => setRegistrationApprovalDraft(request.id, { adminNote: e.target.value })}
                      className="border rounded px-2 py-1.5 text-xs lg:col-span-2"
                      placeholder="Admin note (optional)"
                    />
                  </div>
                  {actionError ? <div className="text-xs text-red-700 mb-2">{actionError}</div> : null}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => approveRegistrationRequest(request.id)} className="px-3 py-1.5 rounded bg-emerald-100 text-emerald-700 text-xs font-semibold hover:bg-emerald-200">
                      Approve
                    </button>
                    <button onClick={() => rejectRegistrationRequest(request.id)} className="px-3 py-1.5 rounded bg-red-100 text-red-700 text-xs font-semibold hover:bg-red-200">
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {resolvedRegistrationRequests.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <h4 className="font-semibold text-gray-700 text-xs mb-2">Recently Resolved</h4>
            <div className="space-y-2">
              {resolvedRegistrationRequests.slice(0, 6).map((request) => {
                const institutionDisplayName = request.institutionLabel || memberDirectory[request.institutionMemberId]?.name || request.institutionMemberId;
                return (
                  <div key={request.id} className="rounded border border-gray-100 bg-gray-50 p-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-700">{institutionDisplayName} ({request.institutionMemberId})</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${request.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{request.status}</span>
                      <span className="text-gray-500">{request.institutionalEmail}</span>
                    </div>
                    <div className="text-gray-600 mt-1">
                      Shares: {request.requestedShares} | Resolved: {request.resolvedAt ? new Date(request.resolvedAt).toLocaleString() : 'N/A'}
                      {request.adminNote ? ` | Note: ${request.adminNote}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border p-4 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-2 text-sm">Members & Shares</h3>
        <div className="flex gap-2 mb-3">
          <button onClick={() => setMemberStatusFilter('active')} className={`px-3 py-1.5 rounded text-xs font-semibold ${memberStatusFilter === 'active' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'}`}>Active</button>
          <button onClick={() => setMemberStatusFilter('pending')} className={`px-3 py-1.5 rounded text-xs font-semibold ${memberStatusFilter === 'pending' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'}`}>Pending</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-gray-500"><th className="text-left py-1 px-2">Member</th><th className="text-left py-1 px-2">Name</th><th className="text-right py-1 px-2">Shares</th><th className="text-left py-1 px-2">Status</th><th className="text-left py-1 px-2">Registration</th><th className="text-left py-1 px-2">Actions</th></tr></thead>
            <tbody>
              {filteredMembersForAdmin.length === 0 && <tr><td colSpan={6} className="py-2 px-2 text-gray-500">No members in this tab.</td></tr>}
              {filteredMembersForAdmin.map((member) => (
                <tr key={member.id} className="border-b border-gray-50">
                  <td className="py-1.5 px-2 font-semibold" style={{ color: COLORS[member.id] }}>{member.id}</td>
                  <td className="py-1.5 px-2">{member.name}</td>
                  <td className="py-1.5 px-2 text-right"><input type="number" min="0" step="0.01" value={member.shares} onChange={(e) => updateMember(member.id, { shares: e.target.value })} className="border rounded px-2 py-1 w-20 text-xs text-right" /></td>
                  <td className="py-1.5 px-2">{member.status}</td>
                  <td className="py-1.5 px-2">
                    <button
                      onClick={() => updateMember(member.id, { registrationEnabled: member.registrationEnabled === false })}
                      className={`px-2 py-1 rounded text-[11px] font-semibold ${member.registrationEnabled === false ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}
                    >
                      {member.registrationEnabled === false ? 'Disabled' : 'Enabled'}
                    </button>
                  </td>
                  <td className="py-1.5 px-2">
                    {member.status !== 'ACTIVE'
                      ? <button onClick={() => updateMember(member.id, { status: 'ACTIVE' })} className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 font-semibold">Approve</button>
                      : <button onClick={() => updateMember(member.id, { status: 'PENDING' })} className="px-2 py-1 rounded bg-amber-100 text-amber-700 font-semibold">Mark Pending</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-3 text-sm">Add New Member</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
          <input placeholder="Member ID" value={newMemberForm.id} onChange={(e) => setNewMemberForm((prev) => ({ ...prev, id: e.target.value }))} className="border rounded px-2 py-1.5" />
          <input placeholder="Display name" value={newMemberForm.name} onChange={(e) => setNewMemberForm((prev) => ({ ...prev, name: e.target.value }))} className="border rounded px-2 py-1.5" />
          <input type="number" min="0" step="0.01" placeholder="Shares" value={newMemberForm.shares} onChange={(e) => setNewMemberForm((prev) => ({ ...prev, shares: e.target.value }))} className="border rounded px-2 py-1.5" />
          <button onClick={addMember} className="px-3 py-1.5 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700">Add Member</button>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-2 text-sm">Testing Accounts</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-gray-500"><th className="text-left py-1 px-2">Role</th><th className="text-left py-1 px-2">Member</th><th className="text-left py-1 px-2">Username</th><th className="text-left py-1 px-2">Password</th></tr></thead>
            <tbody>
              <tr className="border-b border-gray-50"><td className="py-1.5 px-2 font-semibold text-slate-700">Admin</td><td className="py-1.5 px-2">System</td><td className="py-1.5 px-2 font-mono">{testAccounts.admin.username}</td><td className="py-1.5 px-2 font-mono">{testAccounts.admin.password}</td></tr>
              {memberLoginAccounts.map(({ member, account }) => <tr key={member.id} className="border-b border-gray-50"><td className="py-1.5 px-2 font-semibold text-emerald-700">Member</td><td className="py-1.5 px-2" style={{ color: COLORS[member.id] }}>{member.id} - {member.name}</td><td className="py-1.5 px-2 font-mono">{account.username}</td><td className="py-1.5 px-2 font-mono">{account.password}</td></tr>)}
              {piAccessAccounts.map((account) => (
                <tr key={account.id} className="border-b border-gray-50">
                  <td className="py-1.5 px-2 font-semibold text-blue-700">PI Access</td>
                  <td className="py-1.5 px-2" style={{ color: COLORS[account.memberId] || '#1f2937' }}>
                    {account.memberId} - {memberDirectory[account.memberId]?.name || account.memberId}
                  </td>
                  <td className="py-1.5 px-2 font-mono">{account.username}</td>
                  <td className="py-1.5 px-2 font-mono">{account.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-2 text-sm">Member Preference Notes</h3>
        <div className="space-y-2 text-xs">
          {submittedPreferenceNotes.length === 0 && (
            <div className="text-gray-500">No member notes submitted yet.</div>
          )}
          {submittedPreferenceNotes.map((entry) => (
            <div key={`${entry.memberId}-note`} className="border border-gray-100 rounded p-2">
              <div className="font-semibold" style={{ color: COLORS[entry.memberId] || CONCEPT_THEME.navy }}>
                {entry.memberId} - {entry.memberName}
              </div>
              <div className="text-[11px] text-gray-500 mb-1">
                {entry.submitted ? 'Submitted with preferences' : 'Draft note (not submitted yet)'}
              </div>
              <div className="text-gray-700 whitespace-pre-wrap">{entry.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
