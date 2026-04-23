# Frontend Migration Pattern Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** migrate the auth screens and both comments screens off `useMockApp()` while keeping the current UI nearly unchanged and leaving the rest of the application on the legacy bridge temporarily.

**Architecture:** keep the app in a hybrid state. `src/App.jsx` remains the top-level router and shell, but unauthenticated routing becomes URL-based (`/login`, `/activate`) and the comments screens move directly onto the existing React Query hooks. A small comments view-model adapter isolates API shape differences so the current JSX can stay visually stable without depending on `mock-state.js`.

**Tech Stack:** Vite, React 18, React Router 6, TanStack Query, Vitest, Testing Library, Vercel serverless APIs

---

## File Map

**Create**

- `vitest.config.js`
- `src/test/setup.js`
- `src/lib/comments-view-models.js`
- `src/lib/comments-view-models.test.js`
- `src/screens/member/MemberComments.test.jsx`
- `src/screens/admin/AdminComments.test.jsx`
- `src/screens/auth/LoginScreen.test.jsx`
- `src/screens/auth/ActivateAccountScreen.test.jsx`

**Modify**

- `package.json`
- `src/App.jsx`
- `src/screens/member/MemberComments.jsx`
- `src/screens/admin/AdminComments.jsx`
- `src/screens/auth/LoginScreen.jsx`
- `src/screens/auth/ActivateAccountScreen.jsx`

**Why this structure**

- The comments adapter is the smallest safe seam between the API and the old UI shape, so it should be built first and tested in isolation.
- `MemberComments` and `AdminComments` are the first full production screens because the backend already exists and the cross-role behavior is easy to verify.
- Auth screens come after the comments pattern is proven, because moving them to URL-based routing requires more careful `App.jsx` wiring than the comments screens.
- `mock-state.js` and `useServerSync.js` stay in place for every non-migrated route so this slice does not become a full-app rewrite.

### Task 1: Add Frontend Test Harness And Comments View Models

**Files:**

- Create: `vitest.config.js`
- Create: `src/test/setup.js`
- Create: `src/lib/comments-view-models.js`
- Create: `src/lib/comments-view-models.test.js`
- Modify: `package.json`

- [ ] **Step 1: Install React screen test tooling**

Run:

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Expected: npm adds the five dev dependencies without changing production dependencies.

- [ ] **Step 2: Add the test scripts and Vitest configuration**

Modify `package.json` so the `scripts` section becomes:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "node --test lib/scheduling/engine.test.js src/lib/data-mappers.test.js src/lib/server-bridge.test.js src/lib/notification-bell-utils.test.js lib/swap-request-utils.test.js && vite build",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:seed": "node db/seed.js",
    "db:studio": "drizzle-kit studio"
  }
}
```

Create `vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
});
```

Create `src/test/setup.js`:

```js
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Write the failing comments view-model tests**

Create `src/lib/comments-view-models.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { toAdminCommentInbox, toMemberCommentHistory } from './comments-view-models';

describe('toMemberCommentHistory', () => {
  it('sorts newest first and normalizes optional fields', () => {
    const result = toMemberCommentHistory([
      {
        id: 'comment-1',
        subject: 'Older',
        message: 'First message',
        status: 'sent',
        createdAt: '2026-04-12T09:00:00Z',
        updatedAt: '2026-04-12T09:00:00Z',
        readAt: null,
        adminReply: null,
        adminReplyAt: null,
      },
      {
        id: 'comment-2',
        subject: 'Newest',
        message: 'Second message',
        status: 'replied',
        createdAt: '2026-04-13T09:00:00Z',
        updatedAt: '2026-04-13T09:30:00Z',
        readAt: '2026-04-13T09:10:00Z',
        adminReply: 'Reply sent',
        adminReplyAt: '2026-04-13T09:30:00Z',
      },
    ]);

    expect(result).toEqual([
      {
        id: 'comment-2',
        subject: 'Newest',
        message: 'Second message',
        status: 'Replied',
        createdAt: '2026-04-13T09:00:00Z',
        updatedAt: '2026-04-13T09:30:00Z',
        readAt: '2026-04-13T09:10:00Z',
        adminReply: 'Reply sent',
        adminReplyAt: '2026-04-13T09:30:00Z',
      },
      {
        id: 'comment-1',
        subject: 'Older',
        message: 'First message',
        status: 'Sent',
        createdAt: '2026-04-12T09:00:00Z',
        updatedAt: '2026-04-12T09:00:00Z',
        readAt: '',
        adminReply: '',
        adminReplyAt: '',
      },
    ]);
  });
});

describe('toAdminCommentInbox', () => {
  it('adds institution and PI labels for the admin inbox cards', () => {
    const result = toAdminCommentInbox([
      {
        id: 'comment-3',
        subject: 'Detector issue',
        message: 'Need help',
        status: 'read',
        createdAt: '2026-04-14T09:00:00Z',
        updatedAt: '2026-04-14T09:05:00Z',
        readAt: '2026-04-14T09:05:00Z',
        adminReply: null,
        adminReplyAt: null,
        institutionName: 'University of Georgia',
        institutionAbbreviation: 'UGA',
        piName: 'Dr. Rowan',
        piEmail: 'rowan@uga.edu',
      },
    ]);

    expect(result).toEqual([
      {
        id: 'comment-3',
        subject: 'Detector issue',
        message: 'Need help',
        status: 'Read',
        createdAt: '2026-04-14T09:00:00Z',
        updatedAt: '2026-04-14T09:05:00Z',
        readAt: '2026-04-14T09:05:00Z',
        adminReply: '',
        adminReplyAt: '',
        memberId: 'UGA',
        memberName: 'University of Georgia',
        piName: 'Dr. Rowan',
        piEmail: 'rowan@uga.edu',
      },
    ]);
  });
});
```

- [ ] **Step 4: Run the new test to verify it fails**

Run:

```bash
npx vitest run src/lib/comments-view-models.test.js
```

Expected: FAIL with a module resolution error for `./comments-view-models` or missing export failures.

- [ ] **Step 5: Implement the comments view-model adapter**

Create `src/lib/comments-view-models.js`:

```js
const STATUS_LABELS = {
  sent: 'Sent',
  read: 'Read',
  replied: 'Replied',
};

function sortNewestFirst(a, b) {
  return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
}

function normalizeBaseComment(comment = {}) {
  return {
    id: comment.id,
    subject: comment.subject || '',
    message: comment.message || '',
    status: STATUS_LABELS[comment.status] || 'Sent',
    createdAt: comment.createdAt || '',
    updatedAt: comment.updatedAt || '',
    readAt: comment.readAt || '',
    adminReply: comment.adminReply || '',
    adminReplyAt: comment.adminReplyAt || '',
  };
}

export function toMemberCommentHistory(comments = []) {
  return [...(Array.isArray(comments) ? comments : [])]
    .map(normalizeBaseComment)
    .sort(sortNewestFirst);
}

export function toAdminCommentInbox(comments = []) {
  return [...(Array.isArray(comments) ? comments : [])]
    .map((comment) => ({
      ...normalizeBaseComment(comment),
      memberId: comment.institutionAbbreviation || comment.institutionName || 'PI',
      memberName: comment.institutionName || comment.institutionAbbreviation || 'Unknown institution',
      piName: comment.piName || 'Principal Investigator',
      piEmail: comment.piEmail || '-',
    }))
    .sort(sortNewestFirst);
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run:

```bash
npx vitest run src/lib/comments-view-models.test.js
```

Expected:

```text
✓ src/lib/comments-view-models.test.js
```

- [ ] **Step 7: Commit**

Run:

```bash
git add package.json package-lock.json vitest.config.js src/test/setup.js src/lib/comments-view-models.js src/lib/comments-view-models.test.js
git commit -m "test: add frontend migration harness"
```

### Task 2: Migrate Member Comments To React Query

**Files:**

- Modify: `src/screens/member/MemberComments.jsx`
- Test: `src/screens/member/MemberComments.test.jsx`

- [ ] **Step 1: Write the failing member comments screen test**

Create `src/screens/member/MemberComments.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MemberComments from './MemberComments';

const useCommentsMock = vi.fn();
const useCreateCommentMock = vi.fn();

vi.mock('../../hooks/useApiData', () => ({
  useComments: () => useCommentsMock(),
  useCreateComment: () => useCreateCommentMock(),
}));

describe('MemberComments', () => {
  beforeEach(() => {
    useCommentsMock.mockReset();
    useCreateCommentMock.mockReset();
  });

  it('renders API-backed history and submits a new comment', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ data: { id: 'comment-new' } });

    useCommentsMock.mockReturnValue({
      data: [
        {
          id: 'comment-2',
          subject: 'Beamline question',
          message: 'Need clarification',
          status: 'replied',
          createdAt: '2026-04-13T10:00:00Z',
          updatedAt: '2026-04-13T10:30:00Z',
          readAt: '2026-04-13T10:05:00Z',
          adminReply: 'Reply sent',
          adminReplyAt: '2026-04-13T10:30:00Z',
        },
      ],
      isLoading: false,
      error: null,
    });
    useCreateCommentMock.mockReturnValue({ mutateAsync, isPending: false });

    render(<MemberComments />);

    expect(screen.getByText('Beamline question')).toBeInTheDocument();
    expect(screen.getByText('Replied')).toBeInTheDocument();
    expect(screen.getByText('Reply sent')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Subject'), 'Need a follow-up');
    await userEvent.type(screen.getByLabelText('Message'), 'Can admin confirm detector setup?');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        subject: 'Need a follow-up',
        message: 'Can admin confirm detector setup?',
      });
    });

    expect(screen.getByText('Comment sent to the scheduling team.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the screen test to verify it fails**

Run:

```bash
npx vitest run src/screens/member/MemberComments.test.jsx
```

Expected: FAIL because `MemberComments` still calls `useMockApp()` and does not read the mocked API hooks.

- [ ] **Step 3: Rewrite the screen to use the real hooks**

Modify `src/screens/member/MemberComments.jsx` so the screen logic becomes:

```jsx
import React, { useMemo, useState } from 'react';
import { useComments, useCreateComment } from '../../hooks/useApiData';
import { toMemberCommentHistory } from '../../lib/comments-view-models';
import { CONCEPT_THEME } from '../../lib/theme';

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

  const history = useMemo(
    () => toMemberCommentHistory(commentsQuery.data),
    [commentsQuery.data],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const nextSubject = subject.trim();
    const nextMessage = message.trim();
    if (!nextSubject || !nextMessage) {
      setError('Both subject and message are required.');
      return;
    }

    try {
      await createComment.mutateAsync({
        subject: nextSubject,
        message: nextMessage,
      });
      setSubject('');
      setMessage('');
      setSuccess('Comment sent to the scheduling team.');
    } catch (err) {
      setError(err.message || 'Unable to submit your comment.');
    }
  };
}
```

In the history card section, replace the old empty-state branch with:

```jsx
{commentsQuery.isLoading ? (
  <div className="rounded-xl px-4 py-3 text-sm" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.muted }}>
    Loading comments...
  </div>
) : commentsQuery.error ? (
  <div className="rounded-xl px-4 py-3 text-sm" style={{ background: CONCEPT_THEME.errorLight, color: CONCEPT_THEME.error }}>
    Unable to load comment history.
  </div>
) : history.length === 0 ? (
  <div className="rounded-xl px-4 py-3 text-sm" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.muted }}>
    No comments submitted yet.
  </div>
) : (
  <div className="space-y-3">
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
```

In the submit button section, replace the old button with:

```jsx
<div className="mt-5">
  <button
    type="submit"
    disabled={createComment.isPending}
    className="rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
    style={{ background: CONCEPT_THEME.navy, color: 'white' }}
  >
    {createComment.isPending ? 'Submitting...' : 'Submit'}
  </button>
</div>
```

Retain the existing outer wrapper cards, form field markup, and success/error banner placement from the current component.

- [ ] **Step 4: Run the screen test to verify it passes**

Run:

```bash
npx vitest run src/screens/member/MemberComments.test.jsx
```

Expected:

```text
✓ src/screens/member/MemberComments.test.jsx
```

- [ ] **Step 5: Commit**

Run:

```bash
git add src/screens/member/MemberComments.jsx src/screens/member/MemberComments.test.jsx src/lib/comments-view-models.js
git commit -m "feat: migrate member comments to api hooks"
```

### Task 3: Migrate Admin Comments To React Query

**Files:**

- Modify: `src/screens/admin/AdminComments.jsx`
- Test: `src/screens/admin/AdminComments.test.jsx`

- [ ] **Step 1: Write the failing admin comments screen test**

Create `src/screens/admin/AdminComments.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminComments from './AdminComments';

const useCommentsMock = vi.fn();
const useUpdateCommentMock = vi.fn();

vi.mock('../../hooks/useApiData', () => ({
  useComments: () => useCommentsMock(),
  useUpdateComment: () => useUpdateCommentMock(),
}));

describe('AdminComments', () => {
  beforeEach(() => {
    useCommentsMock.mockReset();
    useUpdateCommentMock.mockReset();
  });

  it('marks unread comments as read on expand and saves replies through the api', async () => {
    const mutate = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue({ data: { id: 'comment-1' } });

    useCommentsMock.mockReturnValue({
      data: [
        {
          id: 'comment-1',
          subject: 'Slot request',
          message: 'Can this move to Friday?',
          status: 'sent',
          createdAt: '2026-04-14T09:00:00Z',
          updatedAt: '2026-04-14T09:00:00Z',
          readAt: null,
          adminReply: null,
          adminReplyAt: null,
          institutionName: 'University of Georgia',
          institutionAbbreviation: 'UGA',
          piName: 'Dr. Rowan',
          piEmail: 'rowan@uga.edu',
        },
      ],
      isLoading: false,
      error: null,
    });
    useUpdateCommentMock.mockReturnValue({ mutate, mutateAsync, isPending: false });

    render(<AdminComments />);

    await userEvent.click(screen.getByRole('button', { name: /slot request/i }));
    expect(mutate).toHaveBeenCalledWith({ id: 'comment-1', status: 'read' });

    const replyBox = screen.getByLabelText('Admin Reply');
    await userEvent.type(replyBox, 'Yes, we can move this request.');
    await userEvent.click(screen.getByRole('button', { name: 'Send Reply' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        id: 'comment-1',
        adminReply: 'Yes, we can move this request.',
      });
    });

    expect(screen.getByText('Reply saved.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the screen test to verify it fails**

Run:

```bash
npx vitest run src/screens/admin/AdminComments.test.jsx
```

Expected: FAIL because `AdminComments` still depends on `useMockApp()` and member-directory bridge data.

- [ ] **Step 3: Rewrite the admin screen to use the real hooks**

Modify `src/screens/admin/AdminComments.jsx` so the screen logic becomes:

```jsx
import React, { useMemo, useState } from 'react';
import { useComments, useUpdateComment } from '../../hooks/useApiData';
import { toAdminCommentInbox } from '../../lib/comments-view-models';
import { CONCEPT_THEME } from '../../lib/theme';

function buildStatusTone(status) {
  if (status === 'Read') {
    return { bg: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.accentOnAccent };
  }
  if (status === 'Replied') {
    return { bg: CONCEPT_THEME.tealLight, color: CONCEPT_THEME.teal };
  }
  return { bg: CONCEPT_THEME.skyLight, color: CONCEPT_THEME.sky };
}

export default function AdminComments() {
  const commentsQuery = useComments();
  const updateComment = useUpdateComment();
  const [expandedCommentId, setExpandedCommentId] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyError, setReplyError] = useState('');
  const [replySuccessId, setReplySuccessId] = useState('');

  const inbox = useMemo(
    () => toAdminCommentInbox(commentsQuery.data),
    [commentsQuery.data],
  );

  const handleToggle = (entry) => {
    const nextExpanded = expandedCommentId === entry.id ? '' : entry.id;
    setExpandedCommentId(nextExpanded);
    setReplyError('');
    setReplySuccessId('');

    if (nextExpanded && entry.status === 'Sent') {
      updateComment.mutate({ id: entry.id, status: 'read' });
    }
  };

  const handleReplySubmit = async (entry) => {
    const replyText = String(replyDrafts[entry.id] ?? entry.adminReply ?? '').trim();
    if (!replyText) {
      setReplyError('Reply message is required.');
      setReplySuccessId('');
      return;
    }

    try {
      await updateComment.mutateAsync({
        id: entry.id,
        adminReply: replyText,
      });
      setReplyError('');
      setReplySuccessId(entry.id);
    } catch (err) {
      setReplyError(err.message || 'Unable to save reply.');
      setReplySuccessId('');
    }
  };
}
```

Inside the inbox card mapping, replace the member-directory lookups with the direct fields from `entry`:

```jsx
const institutionName = entry.memberName;
const piName = entry.piName;
const piEmail = entry.piEmail;
```

Use the query states for the empty-state branch:

```jsx
{commentsQuery.isLoading ? (
  <div className="rounded-xl px-4 py-3 text-sm" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.muted }}>
    Loading member comments...
  </div>
) : commentsQuery.error ? (
  <div className="rounded-xl px-4 py-3 text-sm" style={{ background: CONCEPT_THEME.errorLight, color: CONCEPT_THEME.error }}>
    Unable to load the comments inbox.
  </div>
) : inbox.length === 0 ? (
  <div className="rounded-xl px-4 py-3 text-sm" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.muted }}>
    No member comments available yet.
  </div>
) : (
  <div className="space-y-3">
    {inbox.map((entry) => {
      const tone = buildStatusTone(entry.status);
      const expanded = expandedCommentId === entry.id;
      const replyValue = replyDrafts[entry.id] ?? entry.adminReply ?? '';
      const institutionName = entry.memberName;
      const piName = entry.piName;
      const piEmail = entry.piEmail;

      return (
        <div key={entry.id} className="rounded-2xl border" style={{ background: CONCEPT_THEME.warmWhite, borderColor: CONCEPT_THEME.borderLight }}>
          <button
            type="button"
            onClick={() => handleToggle(entry)}
            className="w-full px-4 py-4 text-left"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}>
                    {entry.memberId}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: CONCEPT_THEME.navy }}>
                    {institutionName}
                  </span>
                </div>
                <div className="mt-2 text-base font-semibold" style={{ color: CONCEPT_THEME.text }}>
                  {entry.subject || 'Untitled message'}
                </div>
                <div className="mt-1 text-xs" style={{ color: CONCEPT_THEME.muted }}>
                  PI: {piName} | {piEmail}
                </div>
                <div className="mt-1 text-xs" style={{ color: CONCEPT_THEME.muted }}>
                  Submitted {new Date(entry.createdAt).toLocaleString()}
                </div>
                <div className="mt-2 truncate text-sm" style={{ color: CONCEPT_THEME.muted }}>
                  {entry.message}
                </div>
              </div>
              <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: tone.bg, color: tone.color }}>
                {entry.status}
              </span>
            </div>
          </button>
          {expanded ? (
            <div className="border-t px-4 py-4" style={{ borderColor: CONCEPT_THEME.borderLight }}>
              <div className="rounded-2xl border px-4 py-4" style={{ background: CONCEPT_THEME.cream, borderColor: CONCEPT_THEME.border }}>
                <div className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.navyMuted }}>
                  Member Message
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6" style={{ color: CONCEPT_THEME.text }}>
                  {entry.message}
                </p>
              </div>
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-semibold" style={{ color: CONCEPT_THEME.text }}>
                  Admin Reply
                </label>
                <textarea
                  value={replyValue}
                  onChange={(event) => {
                    setReplyDrafts((prev) => ({ ...prev, [entry.id]: event.target.value }));
                    setReplyError('');
                    if (replySuccessId === entry.id) setReplySuccessId('');
                  }}
                  rows={4}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition"
                  style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text, resize: 'vertical' }}
                  placeholder="Type a reply back to this member."
                />
              </div>
            </div>
          ) : null}
        </div>
      );
    })}
  </div>
)}
```

Keep the existing reply success/error banners and the existing expand/collapse card structure, but populate them from `inbox` instead of `memberComments`.

- [ ] **Step 4: Run the screen test to verify it passes**

Run:

```bash
npx vitest run src/screens/admin/AdminComments.test.jsx
```

Expected:

```text
✓ src/screens/admin/AdminComments.test.jsx
```

- [ ] **Step 5: Commit**

Run:

```bash
git add src/screens/admin/AdminComments.jsx src/screens/admin/AdminComments.test.jsx src/lib/comments-view-models.js
git commit -m "feat: migrate admin comments to api hooks"
```

### Task 4: Migrate Login Screen To AuthContext

**Files:**

- Modify: `src/screens/auth/LoginScreen.jsx`
- Test: `src/screens/auth/LoginScreen.test.jsx`

- [ ] **Step 1: Write the failing login screen test**

Create `src/screens/auth/LoginScreen.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginScreen from './LoginScreen';

const loginMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: loginMock,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ state: { email: 'pi@uga.edu' } }),
  };
});

describe('LoginScreen', () => {
  beforeEach(() => {
    loginMock.mockReset();
    navigateMock.mockReset();
  });

  it('prefills activation email and signs in through AuthContext', async () => {
    loginMock.mockResolvedValue({ role: 'pi' });

    render(
      <MemoryRouter>
        <LoginScreen />
      </MemoryRouter>,
    );

    expect(screen.getByDisplayValue('pi@uga.edu')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Password'), 'SecurePass123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('pi@uga.edu', 'SecurePass123');
    });

    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true });
  });
});
```

- [ ] **Step 2: Run the login screen test to verify it fails**

Run:

```bash
npx vitest run src/screens/auth/LoginScreen.test.jsx
```

Expected: FAIL because `LoginScreen` still requires `loginForm`, `setLoginForm`, and `handleSignIn` props instead of using `AuthContext`.

- [ ] **Step 3: Rewrite the login screen as a self-contained route component**

Modify `src/screens/auth/LoginScreen.jsx` so the screen logic becomes:

```jsx
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { CONCEPT_THEME } from '../../lib/theme';

const DEFAULT_LOGIN_FORM = { username: '', password: '' };

export default function LoginScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loginForm, setLoginForm] = useState(DEFAULT_LOGIN_FORM);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    if (location.state?.email) {
      setLoginForm((prev) => ({ ...prev, username: location.state.email }));
    }
  }, [location.state]);

  const handleSignIn = async (event) => {
    event.preventDefault();
    setLoginError('');

    const email = loginForm.username.trim().toLowerCase();
    const password = loginForm.password;
    if (!email || !password) {
      setLoginError('Enter both email and password.');
      return;
    }

    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setLoginError(err.message || 'Invalid email or password.');
    }
  };
}
```

For the activation CTA button, replace the old callback with direct navigation:

```jsx
<button
  type="button"
  onClick={() => navigate('/activate')}
  className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5"
  style={{ background: CONCEPT_THEME.tealLight, color: CONCEPT_THEME.teal }}
>
  Activate your account
</button>
```

Delete the entire "Reset Demo Data" section at the bottom of the component.

Retain the existing header, email field, password field, "Need access?" card, and activation CTA layout from the current component.

- [ ] **Step 4: Run the login screen test to verify it passes**

Run:

```bash
npx vitest run src/screens/auth/LoginScreen.test.jsx
```

Expected:

```text
✓ src/screens/auth/LoginScreen.test.jsx
```

- [ ] **Step 5: Commit**

Run:

```bash
git add src/screens/auth/LoginScreen.jsx src/screens/auth/LoginScreen.test.jsx
git commit -m "feat: migrate login screen to auth context"
```

### Task 5: Migrate Activation Screen And Route Unauthenticated Users By URL

**Files:**

- Modify: `src/screens/auth/ActivateAccountScreen.jsx`
- Modify: `src/App.jsx`
- Modify: `package.json`
- Test: `src/screens/auth/ActivateAccountScreen.test.jsx`

- [ ] **Step 1: Write the failing activation screen test**

Create `src/screens/auth/ActivateAccountScreen.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ActivateAccountScreen from './ActivateAccountScreen';

const activateMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    activate: activateMock,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('ActivateAccountScreen', () => {
  beforeEach(() => {
    activateMock.mockReset();
    navigateMock.mockReset();
  });

  it('activates the account and transitions to the success state', async () => {
    activateMock.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'pi@uga.edu',
        name: 'Dr. Rowan',
        institutionName: 'University of Georgia',
      },
    });

    render(
      <MemoryRouter>
        <ActivateAccountScreen />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('Activation Token'), 'token-123');
    await userEvent.type(screen.getByLabelText('Set Password'), 'SecurePass123');
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'SecurePass123');
    await userEvent.click(screen.getByRole('button', { name: 'Activate Account' }));

    await waitFor(() => {
      expect(activateMock).toHaveBeenCalledWith('token-123', 'SecurePass123', 'SecurePass123', '');
    });

    expect(screen.getByText("You're All Set!")).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sign In Now' }));
    expect(navigateMock).toHaveBeenCalledWith('/login', {
      replace: true,
      state: { email: 'pi@uga.edu' },
    });
  });
});
```

- [ ] **Step 2: Run the activation screen test to verify it fails**

Run:

```bash
npx vitest run src/screens/auth/ActivateAccountScreen.test.jsx
```

Expected: FAIL because `ActivateAccountScreen` still depends on prop-driven state and member-token preview data from the legacy bridge.

- [ ] **Step 3: Rewrite the activation screen as a self-contained route component**

Modify `src/screens/auth/ActivateAccountScreen.jsx` so the top of the file becomes:

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { CONCEPT_THEME } from '../../lib/theme';

export default function ActivateAccountScreen() {
  const { activate } = useAuth();
  const navigate = useNavigate();
  const [activateToken, setActivateToken] = useState('');
  const [activateForm, setActivateForm] = useState({
    password: '',
    confirmPassword: '',
    phone: '',
  });
  const [loginError, setLoginError] = useState('');
  const [activationSummary, setActivationSummary] = useState(null);

  const handleActivate = async (event) => {
    event.preventDefault();
    setLoginError('');

    const token = activateToken.trim();
    const { password, confirmPassword, phone } = activateForm;

    if (!token) {
      setLoginError('Enter the activation token from your invite email.');
      return;
    }
    if (!password || password.length < 8) {
      setLoginError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setLoginError('Passwords do not match.');
      return;
    }

    try {
      const result = await activate(token, password, confirmPassword, phone);
      setActivationSummary({
        memberId: result.user?.id || '',
        memberName: result.user?.institutionName || '',
        piName: result.user?.name || '',
        piEmail: result.user?.email || '',
      });
      setLoginError('');
      setActivateToken('');
      setActivateForm({ password: '', confirmPassword: '', phone: '' });
    } catch (err) {
      setLoginError(err.message || 'Invalid or expired activation token.');
    }
  };

  const isSuccess = Boolean(activationSummary);
}
```

Leave the existing `BrandingPanel` implementation in place without modifying its JSX.

In the success button, replace the old callback with direct navigation:

```jsx
<button
  type="button"
  onClick={() => navigate('/login', {
    replace: true,
    state: { email: activationSummary?.piEmail || '' },
  })}
  className="mt-8 w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5"
  style={{ background: CONCEPT_THEME.navy }}
>
  Sign In Now
</button>
```

In the pre-submit header, remove the token-preview state branch and use a fixed label:

```jsx
<p className="text-sm uppercase tracking-[0.24em]" style={{ color: CONCEPT_THEME.accentText }}>
  Activate Access
</p>
```

Delete the `ReadOnlyInvitationCard` helper entirely.

In the form branch, keep the existing token, password, confirm-password, and phone field layout, but remove the `invitedMember`-gated conditional so the fields always render during the pre-submit state.

For the success branch, keep the existing success card layout and bind its values to `activationSummary` instead of the old `authScreen` and prop-driven summary fields.

- [ ] **Step 4: Route unauthenticated users by URL in `App.jsx`**

Modify `src/App.jsx` with these three changes:

1. Remove the auth-screen prop plumbing from `AppContent` and `App`.

Replace:

```jsx
      <AppContent
        authUser={user}
        authLogin={login}
        authLogout={logout}
        authActivate={activate}
        authRequestReset={requestReset}
      />
```

with:

```jsx
      <AppContent
        authUser={user}
        authLogout={logout}
      />
```

2. In `AppContent`, remove the old login/activation handlers and stop redirecting unauthenticated users inside the main effect.

Replace:

```jsx
  useEffect(() => {
    if (!session) {
      if (location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
      return;
    }
    // ...
  }, [session, location.pathname, navigate]);
```

with:

```jsx
  useEffect(() => {
    if (!session) return;

    if (session.role === 'admin') {
      if (location.pathname === '/' || location.pathname === '/login') {
        navigate('/admin/dashboard', { replace: true });
      }
      return;
    }

    if (location.pathname === '/' || location.pathname === '/login' || location.pathname.startsWith('/admin/')) {
      navigate('/member/dashboard', { replace: true });
    }
  }, [session, location.pathname, navigate]);
```

3. Replace the old unauthenticated branch with route-based auth pages.

Replace the entire old `if (!session) { ... }` block with:

```jsx
  if (!session) {
    return (
      <>
        <ConceptFontStyles />
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/activate" element={<ActivateAccountScreen />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </>
    );
  }
```

Also update the member comments route so it no longer depends on `activeMember`:

```jsx
<Route path="/member/comments" element={session.role === 'member' ? <MemberComments /> : <MemberRouteFallback />} />
```

- [ ] **Step 5: Run the auth screen tests to verify they pass**

Run:

```bash
npx vitest run src/screens/auth/LoginScreen.test.jsx src/screens/auth/ActivateAccountScreen.test.jsx
```

Expected:

```text
✓ src/screens/auth/LoginScreen.test.jsx
✓ src/screens/auth/ActivateAccountScreen.test.jsx
```

- [ ] **Step 6: Add the new Vitest suite to the repo verification command**

Modify the `check` script in `package.json` to:

```json
{
  "scripts": {
    "check": "node --test lib/scheduling/engine.test.js src/lib/data-mappers.test.js src/lib/server-bridge.test.js src/lib/notification-bell-utils.test.js lib/swap-request-utils.test.js && vitest run src/lib/comments-view-models.test.js src/screens/member/MemberComments.test.jsx src/screens/admin/AdminComments.test.jsx src/screens/auth/LoginScreen.test.jsx src/screens/auth/ActivateAccountScreen.test.jsx && vite build"
  }
}
```

- [ ] **Step 7: Run full verification**

Run:

```bash
npm run check
```

Expected:

```text
node:test suites pass
vitest suites pass
vite build completes successfully
```

- [ ] **Step 8: Commit**

Run:

```bash
git add src/App.jsx src/screens/auth/LoginScreen.jsx src/screens/auth/LoginScreen.test.jsx src/screens/auth/ActivateAccountScreen.jsx src/screens/auth/ActivateAccountScreen.test.jsx package.json package-lock.json
git commit -m "feat: route auth screens directly"
```
