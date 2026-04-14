import React, { useMemo, useState } from 'react';
import { CONCEPT_THEME } from '../../lib/theme';
import { useComments, useCreateComment } from '../../hooks/useApiData';
import { toMemberCommentHistory } from '../../lib/comments-view-models';

function buildStatusTone(status) {
  if (status === 'Read') {
    return { bg: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.accentOnAccent };
  }
  if (status === 'Replied') {
    return { bg: CONCEPT_THEME.tealLight, color: CONCEPT_THEME.teal };
  }
  return { bg: CONCEPT_THEME.skyLight, color: CONCEPT_THEME.sky };
}

export default function MemberComments() {
  const commentsQuery = useComments();
  const createComment = useCreateComment();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const history = useMemo(() => toMemberCommentHistory(commentsQuery.data), [commentsQuery.data]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!trimmedSubject || !trimmedMessage) {
      setError('Both subject and message are required.');
      setSuccess('');
      return;
    }

    try {
      await createComment.mutateAsync({ subject: trimmedSubject, message: trimmedMessage });
      setSubject('');
      setMessage('');
      setError('');
      setSuccess('Comment sent to the scheduling team.');
    } catch (err) {
      setError(err?.message || 'Unable to submit your comment.');
      setSuccess('');
    }
  };

  return (
    <div className="space-y-4 concept-font-body concept-anim-fade">
      <div className="rounded-2xl border bg-white px-5 py-4 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <h3 className="concept-font-display text-xl font-bold" style={{ color: CONCEPT_THEME.navy }}>Comments & Concerns</h3>
        <p className="mt-1 text-sm" style={{ color: CONCEPT_THEME.muted }}>
          Share scheduling questions, beamline concerns, or follow-up notes with the admin team.
        </p>
      </div>

      <form className="rounded-2xl border bg-white px-5 py-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }} onSubmit={handleSubmit}>
        <div className="grid gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold" style={{ color: CONCEPT_THEME.text }}>Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition"
              style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text }}
              placeholder="What would you like help with?"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold" style={{ color: CONCEPT_THEME.text }}>Message</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition"
              style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text, resize: 'vertical' }}
              placeholder="Add the details the admin team should know."
            />
          </label>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border px-3 py-2 text-sm" style={{ background: CONCEPT_THEME.errorLight, borderColor: `${CONCEPT_THEME.error}33`, color: CONCEPT_THEME.error }}>
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mt-4 rounded-xl border px-3 py-2 text-sm" style={{ background: CONCEPT_THEME.emeraldLight, borderColor: `${CONCEPT_THEME.emerald}33`, color: CONCEPT_THEME.emerald }}>
            {success}
          </div>
        ) : null}

        <div className="mt-5">
          <button
            type="submit"
            disabled={createComment.isPending}
            className="rounded-xl px-4 py-2.5 text-sm font-bold"
            style={{ background: CONCEPT_THEME.navy, color: 'white', opacity: createComment.isPending ? 0.7 : 1 }}
          >
            {createComment.isPending ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border bg-white px-5 py-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="concept-font-display text-lg font-bold" style={{ color: CONCEPT_THEME.navy }}>History</h4>
          <span className="rounded-xl px-3 py-1.5 text-xs font-semibold" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}>
            {history.length} messages
          </span>
        </div>

        {commentsQuery.isLoading ? (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.muted }}>
            Loading comments...
          </div>
        ) : !history.length && commentsQuery.isError ? (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.muted }}>
            Unable to load comment history.
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.muted }}>
            No comments submitted yet.
          </div>
        ) : (
          <div className="space-y-3">
            {commentsQuery.isError ? (
              <div className="rounded-xl border px-4 py-3 text-sm" style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.borderLight, color: CONCEPT_THEME.muted }}>
                Unable to load comment history.
              </div>
            ) : null}
            {history.map((entry) => {
              const tone = buildStatusTone(entry.status);
              return (
                <div key={entry.id} className="rounded-2xl border px-4 py-4" style={{ background: CONCEPT_THEME.warmWhite, borderColor: CONCEPT_THEME.borderLight }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold" style={{ color: CONCEPT_THEME.text }}>{entry.subject || 'Untitled message'}</div>
                      <div className="mt-1 text-xs" style={{ color: CONCEPT_THEME.muted }}>
                        Submitted {new Date(entry.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: tone.bg, color: tone.color }}>
                      {entry.status}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6" style={{ color: CONCEPT_THEME.text }}>
                    {entry.message}
                  </p>
                  {entry.adminReply ? (
                    <div className="mt-4 rounded-2xl border px-4 py-3" style={{ background: CONCEPT_THEME.tealLight, borderColor: `${CONCEPT_THEME.teal}33` }}>
                      <div className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.teal }}>
                        Admin Reply
                      </div>
                      <div className="mt-1 text-xs" style={{ color: CONCEPT_THEME.muted }}>
                        {entry.adminReplyAt ? `Sent ${new Date(entry.adminReplyAt).toLocaleString()}` : 'Sent by admin'}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6" style={{ color: CONCEPT_THEME.text }}>
                        {entry.adminReply}
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
