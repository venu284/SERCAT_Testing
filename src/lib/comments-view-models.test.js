import { expect, test } from 'vitest';

import {
  toAdminCommentInbox,
  toMemberCommentHistory,
} from './comments-view-models';

test('toMemberCommentHistory sorts newest first and normalizes optional fields', () => {
  const result = toMemberCommentHistory([
    {
      id: 'comment-1',
      subject: 'Older question',
      message: 'Older message',
      status: 'read',
      createdAt: '2026-04-10T09:00:00Z',
      updatedAt: '2026-04-10T09:15:00Z',
      readAt: '2026-04-10T09:30:00Z',
      adminReply: 'Thanks',
      adminReplyAt: '2026-04-10T10:00:00Z',
    },
    {
      id: 'comment-2',
      subject: 'Newer question',
      message: 'Newer message',
      status: undefined,
      createdAt: '2026-04-11T09:00:00Z',
      updatedAt: '2026-04-11T09:15:00Z',
      readAt: null,
      adminReply: null,
      adminReplyAt: null,
    },
  ]);

  expect(result).toEqual([
    {
      id: 'comment-2',
      subject: 'Newer question',
      message: 'Newer message',
      status: 'Sent',
      createdAt: '2026-04-11T09:00:00Z',
      updatedAt: '2026-04-11T09:15:00Z',
      readAt: '',
      adminReply: '',
      adminReplyAt: '',
    },
    {
      id: 'comment-1',
      subject: 'Older question',
      message: 'Older message',
      status: 'Read',
      createdAt: '2026-04-10T09:00:00Z',
      updatedAt: '2026-04-10T09:15:00Z',
      readAt: '2026-04-10T09:30:00Z',
      adminReply: 'Thanks',
      adminReplyAt: '2026-04-10T10:00:00Z',
    },
  ]);
});

test('toAdminCommentInbox maps institution and PI fields onto the inbox model', () => {
  const result = toAdminCommentInbox([
    {
      id: 'comment-3',
      subject: 'Reply requested',
      message: 'Please send an update.',
      status: 'replied',
      createdAt: '2026-04-12T09:00:00Z',
      updatedAt: '2026-04-12T09:15:00Z',
      readAt: null,
      adminReply: null,
      adminReplyAt: null,
      institutionAbbreviation: 'UGA',
      institutionName: 'University of Georgia',
      piName: 'Dr. Ada Lovelace',
      piEmail: 'ada@example.edu',
    },
    {
      id: 'comment-4',
      subject: 'General note',
      message: 'No reply yet.',
      status: 'sent',
      createdAt: '2026-04-13T09:00:00Z',
      updatedAt: '2026-04-13T09:15:00Z',
      readAt: '',
      adminReply: 'Already replied',
      adminReplyAt: '2026-04-13T10:00:00Z',
      institutionAbbreviation: 'MIT',
      institutionName: 'Massachusetts Institute of Technology',
      piName: 'Dr. Grace Hopper',
      piEmail: 'grace@example.edu',
    },
  ]);

  expect(result).toEqual([
    {
      id: 'comment-4',
      subject: 'General note',
      message: 'No reply yet.',
      status: 'Sent',
      createdAt: '2026-04-13T09:00:00Z',
      updatedAt: '2026-04-13T09:15:00Z',
      readAt: '',
      adminReply: 'Already replied',
      adminReplyAt: '2026-04-13T10:00:00Z',
      memberId: 'MIT',
      memberName: 'Massachusetts Institute of Technology',
      piName: 'Dr. Grace Hopper',
      piEmail: 'grace@example.edu',
    },
    {
      id: 'comment-3',
      subject: 'Reply requested',
      message: 'Please send an update.',
      status: 'Replied',
      createdAt: '2026-04-12T09:00:00Z',
      updatedAt: '2026-04-12T09:15:00Z',
      readAt: '',
      adminReply: '',
      adminReplyAt: '',
      memberId: 'UGA',
      memberName: 'University of Georgia',
      piName: 'Dr. Ada Lovelace',
      piEmail: 'ada@example.edu',
    },
  ]);
});

test('toAdminCommentInbox falls back to screen-safe labels when institution and PI metadata are null', () => {
  const result = toAdminCommentInbox([
    {
      id: 'comment-5',
      subject: 'Missing metadata',
      message: 'This comment has no institution details.',
      status: 'sent',
      createdAt: '2026-04-14T09:00:00Z',
      updatedAt: '2026-04-14T09:15:00Z',
      readAt: null,
      adminReply: null,
      adminReplyAt: null,
      institutionAbbreviation: null,
      institutionName: null,
      piName: null,
      piEmail: null,
    },
  ]);

  expect(result).toEqual([
    {
      id: 'comment-5',
      subject: 'Missing metadata',
      message: 'This comment has no institution details.',
      status: 'Sent',
      createdAt: '2026-04-14T09:00:00Z',
      updatedAt: '2026-04-14T09:15:00Z',
      readAt: '',
      adminReply: '',
      adminReplyAt: '',
      memberId: 'PI',
      memberName: 'Unknown institution',
      piName: 'Principal Investigator',
      piEmail: '-',
    },
  ]);
});
