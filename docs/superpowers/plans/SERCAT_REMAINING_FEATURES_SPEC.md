# SERCAT — Remaining Features Implementation Spec

> **Purpose**: Agent-executable spec to build the three remaining backend features and wire them into the existing frontend bridge
> **Prerequisite**: Steps 1–7 complete (DB, Auth, CRUD APIs, Email, Cron, Scheduling Engine)
> **Scope**: Comments system (new), Notifications API (new), Swap Requests API (new)
> **After this**: Full production migration (separate spec)

---

## Project Context

- **Stack**: Vercel serverless functions, Neon PostgreSQL, Drizzle ORM, Zod validation, JWT auth
- **Frontend**: React/Vite with TanStack Query. All screens currently consume `useMockApp()` from `src/lib/mock-state.js`
- **Bridge pattern**: `mock-state.js` checks `externalSession !== undefined` — when true, it routes reads through `useServerSync` (real API) and writes through `api.post()`/`api.put()`. When false, it falls back to localStorage (demo mode).
- **Goal**: Build backend APIs + frontend hooks, then wire them into the existing bridge so all features work end-to-end before the production migration.

---

## File Conventions (Match Existing Patterns)

### API Route Pattern
```js
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';           // adjust depth
import { tableName } from '../../db/schema/table.js';
import { withAuth } from '../../lib/middleware/with-auth.js';
import { withAdmin } from '../../lib/middleware/with-admin.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { logAudit } from '../../lib/audit.js';

async function handler(req, res) {
  try {
    // req.user = { userId, role, email, institutionId } (set by middleware)
    // req.query = URL params (e.g., req.query.id for [id].js routes)
    // req.body = parsed JSON body

    return res.status(200).json({ data: result });
  } catch (err) {
    console.error('Descriptive error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

// Single method:
export default withMethod('GET', withAuth(handler));
// Multi-method:
export default withMethod(['GET', 'POST'], withAuth(handler));
// Admin only:
export default withMethod('POST', withAdmin(handler));
```

### Response Format
```js
// Success
res.status(200).json({ data: { ... } });
res.status(201).json({ data: { ... } });

// Error
res.status(400).json({ error: 'Human-readable message', code: 'VALIDATION_ERROR' });
res.status(404).json({ error: 'Resource not found', code: 'NOT_FOUND' });
```

### Zod Validation Pattern
```js
import { z } from 'zod';

const mySchema = z.object({
  field: z.string().min(1, 'Field is required'),
});

// In handler:
let body;
try {
  body = mySchema.parse(req.body);
} catch (err) {
  return res.status(400).json({
    error: err.issues?.[0]?.message || 'Invalid request',
    code: 'VALIDATION_ERROR',
  });
}
```

---

## Feature 1: Comments System

### 1A. Database Schema

Create file: `db/schema/comments.js`

```js
import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const commentStatusEnum = pgEnum('comment_status', ['sent', 'read', 'replied']);

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  piId: uuid('pi_id').notNull().references(() => users.id),
  institutionId: uuid('institution_id'),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: commentStatusEnum('status').notNull().default('sent'),
  readAt: timestamp('read_at', { withTimezone: true }),
  adminReply: text('admin_reply'),
  adminReplyBy: uuid('admin_reply_by').references(() => users.id),
  adminReplyAt: timestamp('admin_reply_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 1B. Register Schema in DB Index

Edit `db/index.js` — add:
```js
import * as comments from './schema/comments.js';
```
And add `...comments,` to the schema object.

### 1C. Generate Migration

Run: `npm run db:generate` then `npm run db:push` (or `npm run db:migrate`)

### 1D. API Routes

#### `api/comments/index.js` — GET (list) + POST (create)

```
GET /api/comments
  - Auth: withAuth (any logged-in user)
  - If role === 'admin': returns ALL comments, newest first, with PI name/email/institution joined
  - If role === 'pi': returns only comments where piId === req.user.userId, newest first
  - Response: { data: comments[] }

POST /api/comments
  - Auth: withAuth (PI only — admins don't create comments, they reply)
  - If req.user.role !== 'pi', return 403
  - Body: { subject: string (required, min 1), message: string (required, min 1) }
  - Creates comment with piId = req.user.userId, institutionId = req.user.institutionId, status = 'sent'
  - Response: { data: comment }
```

Implementation details for GET:
- Join with `users` table to get PI name and email
- Join with `institutions` table to get institution name and abbreviation
- Order by `createdAt` DESC
- For admin: include all. For PI: filter `eq(comments.piId, req.user.userId)`

Implementation details for POST:
- Validate body with Zod
- Insert into comments table
- Return the created comment

#### `api/comments/[id].js` — PUT (admin: mark read + reply)

```
PUT /api/comments/:id
  - Auth: withAdmin
  - Body (all optional):
    - status: 'read' | 'replied' (optional)
    - adminReply: string (optional, required if status === 'replied')
  - Logic:
    - Fetch comment by id, 404 if not found
    - If adminReply is provided and non-empty:
      - Set status = 'replied', adminReply = body.adminReply, adminReplyBy = req.user.userId, adminReplyAt = now
      - If readAt was null, also set readAt = now
    - Else if status === 'read' and current status === 'sent':
      - Set status = 'read', readAt = now
    - logAudit(req.user.userId, 'comment.update', { commentId, status })
    - Return updated comment
  - Response: { data: comment }
```

### 1E. Frontend Hooks

Add to `src/hooks/useApiData.js`:

```js
export function useComments() {
  return useQuery({
    queryKey: ['comments'],
    queryFn: () => api.get('/comments').then((r) => r.data),
  });
}

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/comments', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments'] }),
  });
}

export function useUpdateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/comments/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments'] }),
  });
}
```

### 1F. Bridge Wiring in mock-state.js

The comments screens (`MemberComments.jsx`, `AdminComments.jsx`) consume these from `useMockApp()`:
- `memberComments` — object keyed by memberId, each value is array of comment objects
- `memberDirectory` — lookup object (already exists, no change needed)
- `submitMemberComment(memberId, { subject, message })` — returns `{ ok, comment }`
- `markMemberCommentRead(memberId, commentId)` — returns `{ ok, comment }`
- `replyToMemberComment(memberId, commentId, replyText)` — returns `{ ok, comment }`

**Changes needed in `src/lib/mock-state.js`:**

1. Import the api client at the top (already imported):
   ```js
   import { api } from './api.js';
   ```

2. Add a TanStack Query for comments in `useServerSync.js`:
   ```js
   const commentsQuery = useQuery({
     queryKey: ['comments'],
     queryFn: () => api.get('/comments').then((r) => r.data),
     enabled: isAuthenticated,
     staleTime: 30_000,
   });
   ```
   
   Pass `commentsQuery` back from `useServerSync` return value.

3. In `MockStateProvider`, add an effect that maps server comments to the `memberComments` state shape:

   ```js
   useEffect(() => {
     if (externalSession === undefined || !serverSync.commentsQuery?.data) return;
     const serverComments = serverSync.commentsQuery.data;
     if (!Array.isArray(serverComments)) return;
     
     const grouped = {};
     serverComments.forEach((c) => {
       // Map API comment to mock-state shape
       // Find the member abbreviation from memberDirectory
       const member = members.find((m) => m._piUserId === c.piId);
       const memberId = member?.id || c.piId;
       if (!grouped[memberId]) grouped[memberId] = [];
       grouped[memberId].push({
         id: c.id,
         memberId,
         subject: c.subject,
         message: c.message,
         status: c.status === 'sent' ? 'Sent' : c.status === 'read' ? 'Read' : 'Replied',
         createdAt: c.createdAt,
         updatedAt: c.updatedAt,
         readAt: c.readAt || '',
         adminReply: c.adminReply || '',
         adminReplyAt: c.adminReplyAt || '',
       });
     });
     setMemberComments(grouped);
   }, [serverSync.commentsQuery?.data, members, externalSession]);
   ```

4. Update `submitMemberComment` to hit the real API when `externalSession !== undefined`:

   ```js
   const submitMemberComment = useCallback((memberId, payload) => {
     // ... existing validation ...
     
     if (externalSession !== undefined) {
       const subject = String(payload.subject || '').trim();
       const message = String(payload.message || '').trim();
       if (!subject) return { ok: false, error: 'Subject is required.' };
       if (!message) return { ok: false, error: 'Message is required.' };
       
       api.post('/comments', { subject, message })
         .then(() => serverSync.commentsQuery?.refetch?.())
         .catch((err) => console.error('Failed to submit comment:', err));
       
       return { ok: true, comment: { subject, message } };
     }
     
     // ... existing mock logic ...
   }, [members, externalSession, serverSync]);
   ```

5. Update `markMemberCommentRead` — when `externalSession !== undefined`:
   ```js
   if (externalSession !== undefined) {
     const comment = (memberComments[memberId] || []).find((e) => e.id === commentId);
     if (!comment || comment.status !== 'Sent') return { ok: true, comment };
     api.put(`/comments/${commentId}`, { status: 'read' })
       .then(() => serverSync.commentsQuery?.refetch?.())
       .catch((err) => console.error('Failed to mark comment read:', err));
     return { ok: true, comment };
   }
   ```

6. Update `replyToMemberComment` — when `externalSession !== undefined`:
   ```js
   if (externalSession !== undefined) {
     const adminReply = String(replyText || '').trim();
     if (!adminReply) return { ok: false, error: 'Reply message is required.' };
     api.put(`/comments/${commentId}`, { adminReply })
       .then(() => serverSync.commentsQuery?.refetch?.())
       .catch((err) => console.error('Failed to reply to comment:', err));
     return { ok: true, comment: { adminReply } };
   }
   ```

---

## Feature 2: Notifications API

### 2A. API Routes

The DB schema already exists at `db/schema/notifications.js`. The schema is already registered in `db/index.js`.

#### `api/notifications/index.js` — GET (list) + PUT (mark all read)

Delete the `.gitkeep` file first.

```
GET /api/notifications
  - Auth: withAuth
  - Returns current user's notifications, newest first
  - Filter: eq(notifications.userId, req.user.userId)
  - Order by createdAt DESC
  - Limit to 50 most recent
  - Response: { data: notifications[] }

PUT /api/notifications (body: { action: 'read-all' })
  - Auth: withAuth
  - Updates all unread notifications for current user: set isRead = true
  - Response: { data: { updated: count } }
```

#### `api/notifications/[id].js` — PUT (mark single read)

```
PUT /api/notifications/:id
  - Auth: withAuth
  - Fetch notification by id where userId = req.user.userId (404 if not found or not owned)
  - Set isRead = true
  - Response: { data: notification }
```

### 2B. Notification Helper Utility

Create file: `lib/notifications.js`

```js
import { db } from '../db/index.js';
import { notifications } from '../db/schema/notifications.js';

/**
 * Create a notification record for a user.
 * Non-blocking — errors are logged but never throw.
 */
export async function createNotification({ userId, type, title, message }) {
  try {
    await db.insert(notifications).values({ userId, type, title, message });
  } catch (err) {
    console.error('[NOTIFICATION ERROR] Failed to create notification:', err.message);
  }
}

/**
 * Create notifications for multiple users at once.
 */
export async function createBulkNotifications(entries) {
  // entries = [{ userId, type, title, message }, ...]
  try {
    if (entries.length === 0) return;
    await db.insert(notifications).values(entries);
  } catch (err) {
    console.error('[NOTIFICATION ERROR] Bulk insert failed:', err.message);
  }
}
```

### 2C. Integrate Notifications into Existing Actions

The following existing API routes already send emails. Add notification record creation alongside each email send. Import `createNotification` or `createBulkNotifications` from `../../lib/notifications.js` (adjust path depth).

#### 1. Schedule Published — `api/schedules/[id]/publish.js`

After the email sending loop (around line 140-150), add:

```js
// After the email loop, create notification records for each PI
const notificationEntries = Object.keys(piAssignments).map((piId) => ({
  userId: piId,
  type: 'schedule_published',
  title: 'Schedule Published',
  message: `The schedule for ${cycle?.name || 'the current cycle'} has been published. View your assigned shifts in the app.`,
}));
await createBulkNotifications(notificationEntries);
```

#### 2. Preference Confirmed — `api/cycles/[id]/preferences/index.js`

In the POST handler, after the `sendEmail` call for preference confirmation (around line 221), add:

```js
await createNotification({
  userId: req.user.userId,
  type: 'preference_confirmed',
  title: 'Preferences Submitted',
  message: `Your preferences for ${cycle.name || 'the current cycle'} have been recorded.`,
});
```

#### 3. Deadline Reminders (Cron) — `api/cron/send-reminders.js`

After each `sendEmail` call inside the PI loop (around line 78), add:

```js
// Need the piId — get it from the shares query
// The existing code iterates over shares. Each share has piId.
await createNotification({
  userId: share.piId,  // adjust variable name to match existing code
  type: 'deadline_reminder',
  title: `Preference Deadline: ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`,
  message: `Submit your beam time preferences for ${cycle.name} before ${cycle.preferenceDeadline}.`,
});
```

#### 4. Manual Reminder — `api/admin/send-reminder.js`

After the email sending loop (around line 53), add:

```js
await createNotification({
  userId: pi.id,  // adjust variable name to match existing code
  type: 'deadline_reminder',
  title: 'Reminder from Admin',
  message: body.message || `Please submit your beam time preferences for the current cycle.`,
});
```

#### 5. Swap Request Update — (will be added when swap request API is built, see Feature 3)

### 2D. Frontend Hook

Already exists in `src/hooks/useApiData.js`:

```js
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data),
    refetchInterval: 60000,
  });
}
```

Add these two mutation hooks:

```js
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.put(`/notifications/${id}`, { isRead: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.put('/notifications', { action: 'read-all' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
```

### 2E. Notification Bell Component

Create file: `src/components/NotificationBell.jsx`

This component should:
- Use `useNotifications()` hook to fetch notifications
- Show a bell icon in the header with an unread count badge
- On click, toggle a dropdown showing recent notifications (most recent 20)
- Each notification shows: title, message preview (truncated), time ago, read/unread state
- Clicking a notification marks it as read via `useMarkNotificationRead()`
- "Mark all read" button at top of dropdown uses `useMarkAllNotificationsRead()`
- Style using CONCEPT_THEME from `src/lib/theme.js` to match existing design

UI specs:
- Bell icon: simple SVG, 20x20
- Badge: small red circle with white count, positioned top-right of bell
- Dropdown: absolute positioned, max-height 400px with scroll, rounded-2xl border, shadow-lg
- Notification item: padding, border-bottom, bold title if unread, muted if read
- Empty state: "No notifications yet"

### 2F. Add Notification Bell to App.jsx Header

In `App.jsx`, the header section for both admin and member views contains the user info / sign out button. Add `<NotificationBell />` next to it.

Find the header area in the admin layout (search for the sign-out button) and member layout, and add:

```jsx
import NotificationBell from './components/NotificationBell';

// In the header, before the sign-out button:
<NotificationBell />
```

This works without any mock-state changes because it uses TanStack Query hooks directly.

---

## Feature 3: Swap Requests API

### 3A. API Routes

The DB schema already exists at `db/schema/swap-requests.js`. The schema is already registered in `db/index.js`.

Delete the `.gitkeep` file in `api/swap-requests/` first.

#### `api/swap-requests/index.js` — GET (list) + POST (create)

```
GET /api/swap-requests
  - Auth: withAuth
  - If role === 'admin': returns all swap requests with PI name, email, institution, assignment details
  - If role === 'pi': returns only requests where requesterId === req.user.userId
  - Join with:
    - users (to get requester name, email)
    - institutions (to get institution name, abbreviation)
    - schedule_assignments (to get the target assignment details: assignedDate, shift, shareIndex)
    - schedules (to get cycle info / schedule status)
  - Order by createdAt DESC
  - Response: { data: swapRequests[] }

POST /api/swap-requests
  - Auth: withAuth (PI only — admins resolve, PIs create)
  - If req.user.role === 'admin', return 403 with message 'Only PIs can create swap requests'
  - Body schema:
    {
      scheduleId: uuid (required),
      targetAssignmentId: uuid (required),
      preferredDates: string[] (optional, array of YYYY-MM-DD date strings)
    }
  - Validation:
    - scheduleId must reference an existing published schedule
    - targetAssignmentId must reference an assignment that belongs to req.user.userId
    - preferredDates, if provided, must all be valid YYYY-MM-DD strings
  - Insert into swap_requests with status = 'pending', requesterId = req.user.userId
  - logAudit(req.user.userId, 'swap_request.create', { scheduleId, targetAssignmentId })
  - Response: { data: swapRequest }
```

#### `api/swap-requests/[id].js` — GET (detail) + PUT (admin resolve)

```
GET /api/swap-requests/:id
  - Auth: withAuth
  - Fetch swap request by id
  - If role === 'pi' and requesterId !== req.user.userId, return 403
  - Join same tables as list endpoint
  - Response: { data: swapRequest }

PUT /api/swap-requests/:id
  - Auth: withAdmin
  - Body schema:
    {
      status: 'approved' | 'denied' (required),
      adminNotes: string (optional),
      reassignedDate: YYYY-MM-DD string (required if status === 'approved'),
      reassignedShift: 'DS1' | 'DS2' | 'NS' (required if status === 'approved')
    }
  - Validation:
    - Fetch swap request by id, 404 if not found
    - If current status !== 'pending', return 400 'Swap request already resolved'
    - If status === 'approved':
      - reassignedDate and reassignedShift are required
      - Fetch the target assignment
      - Check no other assignment exists on (reassignedDate, reassignedShift) for the same schedule
      - Update the schedule_assignment: set assignedDate = reassignedDate, shift = reassignedShift, isManualOverride = true
  - Update swap_requests: set status, adminNotes, reviewedBy = req.user.userId, reviewedAt = now
  - Create notification for requester:
    ```js
    await createNotification({
      userId: swapRequest.requesterId,
      type: 'swap_update',
      title: `Swap Request ${status === 'approved' ? 'Approved' : 'Denied'}`,
      message: status === 'approved'
        ? `Your shift change request has been approved. New assignment: ${reassignedDate} ${reassignedShift}.`
        : `Your shift change request has been denied.${adminNotes ? ' Note: ' + adminNotes : ''}`,
    });
    ```
  - Send email using existing `swapRequestUpdateEmail` template:
    ```js
    import { swapRequestUpdateEmail } from '../../lib/email-templates.js';
    import { sendEmail } from '../../lib/email.js';

    // Fetch requester user record for name and email
    void sendEmail({
      to: requesterUser.email,
      ...swapRequestUpdateEmail({
        name: requesterUser.name,
        cycleName: cycle.name,
        status: status === 'approved' ? 'Approved' : 'Denied',
        adminNotes: adminNotes || '',
      }),
    });
    ```
  - logAudit(req.user.userId, 'swap_request.resolve', { swapRequestId: id, status, reassignedDate, reassignedShift })
  - Response: { data: updatedSwapRequest }
```

### 3B. Frontend Hooks

Add to `src/hooks/useApiData.js`:

```js
export function useSwapRequests() {
  return useQuery({
    queryKey: ['swap-requests'],
    queryFn: () => api.get('/swap-requests').then((r) => r.data),
  });
}

export function useCreateSwapRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/swap-requests', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['swap-requests'] }),
  });
}

export function useResolveSwapRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/swap-requests/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['swap-requests'] });
      qc.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
}
```

### 3C. Bridge Wiring in mock-state.js

The shift change screens consume from `useMockApp()`:

**Member side (`ShiftChanges.jsx`):**
- `shiftChangeRequests` (via `memberShiftRequests` filtered for active member)
- `submitShiftChangeRequest(event)`
- Various form state: `selectedShiftChangeSource`, `shiftChangeForm`, `shiftChangeSubmittedFlash`, `memberShiftChangeError`, etc.

**Admin side (`ShiftChangeAdmin.jsx`):**
- `sortedShiftRequests`
- `adminShiftDrafts`, `adminShiftActionErrors`
- `updateShiftDraft(requestId, patch)`
- `resolveShiftChange(requestId, status)`

**Changes needed in `src/lib/mock-state.js`:**

1. Add a swap requests query in `useServerSync.js`:

   ```js
   const swapRequestsQuery = useQuery({
     queryKey: ['swap-requests'],
     queryFn: () => api.get('/swap-requests').then((r) => r.data),
     enabled: isAuthenticated,
     staleTime: 30_000,
   });
   ```

   Return `swapRequestsQuery` from `useServerSync`.

2. In `MockStateProvider`, add an effect that maps server swap requests to `shiftChangeRequests` state shape:

   ```js
   useEffect(() => {
     if (externalSession === undefined || !serverSync.swapRequestsQuery?.data) return;
     const serverSwaps = serverSync.swapRequestsQuery.data;
     if (!Array.isArray(serverSwaps)) return;

     const mapped = serverSwaps.map((swap) => {
       const member = members.find((m) => m._piUserId === swap.requesterId);
       return {
         id: swap.id,
         memberId: member?.id || swap.requesterId,
         sourceDate: swap.targetAssignment?.assignedDate || '',
         sourceShift: swap.targetAssignment?.shift || '',
         requestedDate: Array.isArray(swap.preferredDates) ? swap.preferredDates[0] || '' : '',
         requestedShift: '',
         reason: '',
         status: swap.status === 'pending' ? 'Pending' : swap.status === 'approved' ? 'Approved' : 'Rejected',
         createdAt: swap.createdAt,
         adminNote: swap.adminNotes || '',
         reassignedDate: swap.status === 'approved' ? swap.targetAssignment?.assignedDate || '' : '',
         reassignedShift: swap.status === 'approved' ? swap.targetAssignment?.shift || '' : '',
         resolvedAt: swap.reviewedAt || '',
         _swapId: swap.id,
         _scheduleId: swap.scheduleId,
         _targetAssignmentId: swap.targetAssignmentId,
       };
     });

     setShiftChangeRequests(mapped);
   }, [serverSync.swapRequestsQuery?.data, members, externalSession]);
   ```

3. Update `submitShiftChangeRequest` — when `externalSession !== undefined`:

   After the existing validation block, before the mock insert, add:

   ```js
   if (externalSession !== undefined && results?._scheduleId) {
     // Find the real assignment ID from results
     const assignment = results.assignments?.find((a) =>
       a.assignedDate === selectedShiftChangeAssignmentObj.assignedDate
       && a.shift === selectedShiftChangeAssignmentObj.shift
       && (members.find((m) => m.id === activeMember.id)?._piUserId === a.piId
         || a.memberId === activeMember.id)
     );

     if (!assignment) {
       setMemberShiftChangeError('Could not find the assignment. Try refreshing.');
       return;
     }

     const preferredDates = shiftChangeForm.requestedDate ? [shiftChangeForm.requestedDate] : [];

     api.post('/swap-requests', {
       scheduleId: results._scheduleId,
       targetAssignmentId: assignment.id || assignment._id,
       preferredDates,
     }).then(() => {
       serverSync.swapRequestsQuery?.refetch?.();
       setShiftChangeSubmittedFlash(true);
       window.setTimeout(() => setShiftChangeSubmittedFlash(false), 2800);
       setMemberShiftChangeError('');
       setSelectedShiftChangeSource('');
       setShiftChangeForm({ requestedDate: '', requestedShift: '', reason: '' });
     }).catch((err) => {
       setMemberShiftChangeError(err.message || 'Failed to submit swap request.');
     });
     return;
   }
   ```

4. Update `resolveShiftChange` — when `externalSession !== undefined`:

   At the top of the function, after finding the request, add:

   ```js
   if (externalSession !== undefined && request._swapId) {
     const draft = adminShiftDrafts[requestId] || {};

     if (status === 'Rejected') {
       api.put(`/swap-requests/${request._swapId}`, {
         status: 'denied',
         adminNotes: String(draft.adminNote || '').trim(),
       }).then(() => {
         serverSync.swapRequestsQuery?.refetch?.();
         serverSync.refetchAll();
       }).catch((err) => {
         setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: err.message }));
       });
       return;
     }

     const targetDate = String(draft.reassignedDate || request.requestedDate || '').trim();
     const targetShift = String(draft.reassignedShift || request.requestedShift || '').trim();
     const adminNote = String(draft.adminNote || '').trim();

     if (!targetDate || !targetShift) {
       setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: 'Select reassigned date and shift before approval.' }));
       return;
     }

     api.put(`/swap-requests/${request._swapId}`, {
       status: 'approved',
       adminNotes: adminNote,
       reassignedDate: targetDate,
       reassignedShift: targetShift,
     }).then(() => {
       serverSync.swapRequestsQuery?.refetch?.();
       serverSync.refetchAll();
     }).catch((err) => {
       setAdminShiftActionErrors((prev) => ({ ...prev, [requestId]: err.message }));
     });
     return;
   }
   ```

---

## Implementation Checklist

### Feature 1: Comments
- [ ] Create `db/schema/comments.js`
- [ ] Register in `db/index.js`
- [ ] Generate and run migration
- [ ] Create `api/comments/index.js` (GET + POST)
- [ ] Create `api/comments/[id].js` (PUT)
- [ ] Add hooks to `src/hooks/useApiData.js`
- [ ] Add comments query to `src/hooks/useServerSync.js`
- [ ] Wire `submitMemberComment` to real API in `mock-state.js`
- [ ] Wire `markMemberCommentRead` to real API in `mock-state.js`
- [ ] Wire `replyToMemberComment` to real API in `mock-state.js`
- [ ] Test: PI submits comment → appears in admin inbox → admin marks read → admin replies → PI sees reply

### Feature 2: Notifications
- [ ] Delete `api/notifications/.gitkeep`
- [ ] Create `api/notifications/index.js` (GET + PUT mark-all-read)
- [ ] Create `api/notifications/[id].js` (PUT mark single read)
- [ ] Create `lib/notifications.js` helper utility
- [ ] Add notification creation to `api/schedules/[id]/publish.js`
- [ ] Add notification creation to `api/cycles/[id]/preferences/index.js` (POST handler)
- [ ] Add notification creation to `api/cron/send-reminders.js`
- [ ] Add notification creation to `api/admin/send-reminder.js`
- [ ] Add mutation hooks to `src/hooks/useApiData.js`
- [ ] Create `src/components/NotificationBell.jsx`
- [ ] Add NotificationBell to header in `src/App.jsx`
- [ ] Test: publish schedule → notification appears in bell → click marks read → mark all read works

### Feature 3: Swap Requests
- [ ] Delete `api/swap-requests/.gitkeep`
- [ ] Create `api/swap-requests/index.js` (GET + POST)
- [ ] Create `api/swap-requests/[id].js` (GET + PUT)
- [ ] Add hooks to `src/hooks/useApiData.js`
- [ ] Add swap requests query to `src/hooks/useServerSync.js`
- [ ] Wire `submitShiftChangeRequest` to real API in `mock-state.js`
- [ ] Wire `resolveShiftChange` to real API in `mock-state.js`
- [ ] Test: PI creates swap request → admin sees in queue → admin approves with new date/shift → assignment updates → PI gets notification + email

### Integration Tests
- [ ] Full cycle: create cycle → collect preferences → generate → publish → PI gets notification
- [ ] PI submits comment → admin replies → PI sees reply
- [ ] PI requests swap → admin approves → assignment changes → PI notified
- [ ] PI requests swap → admin denies → PI notified with notes
- [ ] Notification bell shows correct unread count
- [ ] Cron reminders create notification records

---

## Files Modified (Summary)

### New Files
| File | Purpose |
|------|---------|
| `db/schema/comments.js` | Comments table schema |
| `api/comments/index.js` | GET list + POST create comment |
| `api/comments/[id].js` | PUT update/reply to comment |
| `api/notifications/index.js` | GET list + PUT mark-all-read |
| `api/notifications/[id].js` | PUT mark single read |
| `api/swap-requests/index.js` | GET list + POST create swap request |
| `api/swap-requests/[id].js` | GET detail + PUT resolve swap request |
| `lib/notifications.js` | Notification creation helper utility |
| `src/components/NotificationBell.jsx` | Notification bell header component |

### Modified Files
| File | Change |
|------|--------|
| `db/index.js` | Add comments schema import |
| `db/migrations/` | New migration for comments table |
| `src/hooks/useApiData.js` | Add comments, notification mutation, swap request hooks |
| `src/hooks/useServerSync.js` | Add comments + swap requests queries |
| `src/lib/mock-state.js` | Wire comments, swap requests to real APIs (externalSession path) |
| `src/App.jsx` | Add NotificationBell component to header |
| `api/schedules/[id]/publish.js` | Add notification creation |
| `api/cycles/[id]/preferences/index.js` | Add notification creation |
| `api/cron/send-reminders.js` | Add notification creation |
| `api/admin/send-reminder.js` | Add notification creation |

### Deleted Files
| File | Reason |
|------|--------|
| `api/notifications/.gitkeep` | Replaced by real route files |
| `api/swap-requests/.gitkeep` | Replaced by real route files |
