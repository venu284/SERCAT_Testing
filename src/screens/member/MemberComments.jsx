import React, { useMemo, useState } from 'react';
import { CONCEPT_THEME } from '../../lib/theme';
import { useComments, useCreateComment, useAddCommentMessage, useResolveComment } from '../../hooks/useApiData';
import { toMemberCommentHistory } from '../../lib/comments-view-models';

function buildStatusTone(status) {
  if (status === 'Read') {
    return { bg: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.accentOnAccent };
  }
  if (status === 'Replied') {
    return { bg: CONCEPT_THEME.tealLight, color: CONCEPT_THEME.teal };
  }
  if (status === 'Resolved') {
    return { bg: CONCEPT_THEME.sand, color: CONCEPT_THEME.muted };
  }
  return { bg: CONCEPT_THEME.skyLight, color: CONCEPT_THEME.sky };
}

function MessageBubble({ msg }) {
  const isMe = msg.role === 'pi';
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[80%] rounded-2xl px-4 py-3"
        style={{
          background: isMe ? CONCEPT_THEME.navy : CONCEPT_THEME.tealLight,
          color: isMe ? 'white' : CONCEPT_THEME.text,
        }}
      >
        {!isMe && (
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: CONCEPT_THEME.teal }}>
            Admin
          </div>
        )}
        <p className="whitespace-pre-wrap text-sm leading-6">{msg.body}</p>
        <div className="mt-1 text-xs" style={{ color: isMe ? 'rgba(255,255,255,0.55)' : CONCEPT_THEME.muted }}>
          {new Date(msg.createdAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

export default function MemberComments() {
  const commentsQuery = useComments();
  const createComment = useCreateComment();
  const addMessage = useAddCommentMessage();
  const resolveComment = useResolveComment();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyErrors, setReplyErrors] = useState({});
  const [replyPending, setReplyPending] = useState({});
  const [resolvePending, setResolvePending] = useState({});

  const history = useMemo(() => toMemberCommentHistory(commentsQuery.data), [commentsQuery.data]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!trimmedSubject || !trimmedMessage) {
      setFormError('Both subject and message are required.');
      setFormSuccess('');
      return;
    }

    try {
      await createComment.mutateAsync({ subject: trimmedSubject, message: trimmedMessage });
      setSubject('');
      setMessage('');
      setFormError('');
      setFormSuccess('Comment sent to the scheduling team.');
    } catch (err) {
      setFormError(err?.message || 'Unable to submit your comment.');
      setFormSuccess('');
    }
  };

  const handleReply = async (entry) => {
    const body = (replyDrafts[entry.id] ?? '').trim();
    if (!body) {
      setReplyErrors((prev) => ({ ...prev, [entry.id]: 'Reply cannot be empty.' }));
      return;
    }
    setReplyPending((prev) => ({ ...prev, [entry.id]: true }));
    setReplyErrors((prev) => ({ ...prev, [entry.id]: '' }));
    try {
      await addMessage.mutateAsync({ id: entry.id, body });
      setReplyDrafts((prev) => ({ ...prev, [entry.id]: '' }));
    } catch (err) {
      setReplyErrors((prev) => ({ ...prev, [entry.id]: err?.message || 'Unable to send reply.' }));
    } finally {
      setReplyPending((prev) => ({ ...prev, [entry.id]: false }));
    }
  };

  const handleResolve = async (entry) => {
    setResolvePending((prev) => ({ ...prev, [entry.id]: true }));
    try {
      await resolveComment.mutateAsync(entry.id);
    } catch {
      // silently ignore — UI will refresh from query
    } finally {
      setResolvePending((prev) => ({ ...prev, [entry.id]: false }));
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

        {formError ? (
          <div className="mt-4 rounded-xl border px-3 py-2 text-sm" style={{ background: CONCEPT_THEME.errorLight, borderColor: `${CONCEPT_THEME.error}33`, color: CONCEPT_THEME.error }}>
            {formError}
          </div>
        ) : null}
        {formSuccess ? (
          <div className="mt-4 rounded-xl border px-3 py-2 text-sm" style={{ background: CONCEPT_THEME.emeraldLight, borderColor: `${CONCEPT_THEME.emerald}33`, color: CONCEPT_THEME.emerald }}>
            {formSuccess}
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
          <h4 className="concept-font-display text-lg font-bold" style={{ color: CONCEPT_THEME.navy }}>Conversation History</h4>
          <span className="rounded-xl px-3 py-1.5 text-xs font-semibold" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}>
            {history.length} threads
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
          <div className="space-y-4">
            {history.map((entry) => {
              const tone = buildStatusTone(entry.status);
              const hasAdminReply = entry.messages.some((m) => m.role === 'admin');
              const isResolved = entry.status === 'Resolved';
              const draft = replyDrafts[entry.id] ?? '';
              const isPending = Boolean(replyPending[entry.id]);
              const isResolvePending = Boolean(resolvePending[entry.id]);
              const replyErr = replyErrors[entry.id] || '';

              return (
                <div key={entry.id} className="rounded-2xl border" style={{ background: CONCEPT_THEME.warmWhite, borderColor: CONCEPT_THEME.borderLight }}>
                  <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
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

                  <div className="mt-3 space-y-2 px-4">
                    {entry.messages.map((msg) => (
                      <MessageBubble key={msg.id} msg={msg} />
                    ))}
                  </div>

                  {!isResolved ? (
                    <div className="mt-4 border-t px-4 pb-4 pt-4" style={{ borderColor: CONCEPT_THEME.borderLight }}>
                      <label className="mb-1.5 block text-sm font-semibold" style={{ color: CONCEPT_THEME.text }}>
                        Reply
                      </label>
                      <textarea
                        value={draft}
                        onChange={(event) => setReplyDrafts((prev) => ({ ...prev, [entry.id]: event.target.value }))}
                        rows={3}
                        className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition"
                        style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text, resize: 'vertical' }}
                        placeholder="Type your reply..."
                      />
                      {replyErr ? (
                        <div className="mt-2 rounded-xl border px-3 py-2 text-sm" style={{ background: CONCEPT_THEME.errorLight, borderColor: `${CONCEPT_THEME.error}33`, color: CONCEPT_THEME.error }}>
                          {replyErr}
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleReply(entry)}
                          disabled={isPending}
                          className="rounded-xl px-4 py-2.5 text-sm font-bold"
                          style={{ background: CONCEPT_THEME.navy, color: 'white', opacity: isPending ? 0.7 : 1 }}
                        >
                          {isPending ? 'Sending...' : 'Send Reply'}
                        </button>
                        {hasAdminReply ? (
                          <button
                            type="button"
                            onClick={() => handleResolve(entry)}
                            disabled={isResolvePending}
                            className="rounded-xl px-4 py-2.5 text-sm font-bold"
                            style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.muted, opacity: isResolvePending ? 0.7 : 1 }}
                          >
                            {isResolvePending ? 'Resolving...' : 'Mark Resolved'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 pb-4 pt-3">
                      <span className="text-xs" style={{ color: CONCEPT_THEME.muted }}>This conversation has been resolved.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
