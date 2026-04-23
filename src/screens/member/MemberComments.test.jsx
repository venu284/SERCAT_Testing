import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

import MemberComments from './MemberComments';

const useComments = vi.fn();
const useCreateComment = vi.fn();
let commentsState;
let createCommentState;

vi.mock('../../hooks/useApiData', () => ({
  useComments: () => useComments(),
  useCreateComment: () => useCreateComment(),
}));

beforeEach(() => {
  commentsState = {
    data: [
      {
        id: 'comment-2',
        subject: 'Follow-up question',
        message: 'Could you confirm the beamline time?',
        status: 'replied',
        createdAt: '2026-04-13T15:00:00Z',
        updatedAt: '2026-04-13T15:15:00Z',
        adminReply: 'Yes, your slot is confirmed.',
        adminReplyAt: '2026-04-13T16:00:00Z',
      },
      {
        id: 'comment-1',
        subject: 'Scheduling note',
        message: 'I may need to swap my shift.',
        status: 'sent',
        createdAt: '2026-04-12T15:00:00Z',
        updatedAt: '2026-04-12T15:15:00Z',
        adminReply: '',
        adminReplyAt: '',
      },
    ],
    isLoading: false,
    isError: false,
  };

  createCommentState = {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  };

  useComments.mockImplementation(() => commentsState);
  useCreateComment.mockImplementation(() => createCommentState);
});

test('renders API-backed history and submits a new comment through the API hook', async () => {
  const user = userEvent.setup();
  const createComment = useCreateComment();

  render(<MemberComments />);

  expect(await screen.findByText('Follow-up question')).toBeInTheDocument();
  expect(screen.getByText('Replied')).toBeInTheDocument();
  expect(screen.getByText('Yes, your slot is confirmed.')).toBeInTheDocument();
  expect(screen.getByText('Scheduling note')).toBeInTheDocument();

  await user.type(screen.getByLabelText('Subject'), '  Need help  ');
  await user.type(screen.getByLabelText('Message'), '  Please check my assignment.  ');
  await user.click(screen.getByRole('button', { name: 'Submit' }));

  await waitFor(() => {
    expect(createComment.mutateAsync).toHaveBeenCalledWith({
      subject: 'Need help',
      message: 'Please check my assignment.',
    });
  });

  expect(await screen.findByText('Comment sent to the scheduling team.')).toBeInTheDocument();
  expect(screen.getByLabelText('Subject')).toHaveValue('');
  expect(screen.getByLabelText('Message')).toHaveValue('');
});

test('shows empty history state when the API returns no comments', async () => {
  commentsState = {
    data: [],
    isLoading: false,
    isError: false,
  };

  render(<MemberComments />);

  expect(await screen.findByText('No comments submitted yet.')).toBeInTheDocument();
});

test('keeps stale history visible when the query errors and shows a non-destructive banner', async () => {
  commentsState = {
    data: [
      {
        id: 'comment-3',
        subject: 'Cached history',
        message: 'This comment should remain visible on refetch failure.',
        status: 'read',
        createdAt: '2026-04-14T09:00:00Z',
        updatedAt: '2026-04-14T09:15:00Z',
        readAt: '2026-04-14T09:30:00Z',
        adminReply: '',
        adminReplyAt: '',
      },
    ],
    isLoading: false,
    isError: true,
  };

  render(<MemberComments />);

  expect(await screen.findByText('Cached history')).toBeInTheDocument();
  expect(screen.getByText('Unable to load comment history.')).toBeInTheDocument();
  expect(screen.getByText('Read')).toBeInTheDocument();
});

test('shows the API error text when comment submission fails', async () => {
  const user = userEvent.setup();
  const submitError = new Error('Server rejected the comment');
  createCommentState = {
    mutateAsync: vi.fn().mockRejectedValue(submitError),
    isPending: false,
  };

  render(<MemberComments />);

  await user.type(screen.getByLabelText('Subject'), 'Need help');
  await user.type(screen.getByLabelText('Message'), 'Please check my assignment.');
  await user.click(screen.getByRole('button', { name: 'Submit' }));

  expect(await screen.findByText('Server rejected the comment')).toBeInTheDocument();
});
