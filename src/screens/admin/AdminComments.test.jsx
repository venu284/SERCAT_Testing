import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

import AdminComments from './AdminComments';

const useComments = vi.fn();
const useUpdateComment = vi.fn();
let commentsState;
let updateCommentState;

vi.mock('../../hooks/useApiData', () => ({
  useComments: () => useComments(),
  useUpdateComment: () => useUpdateComment(),
}));

vi.mock('../../lib/mock-state', () => ({
  useMockApp: () => {
    throw new Error('useMockApp should not be called by AdminComments.');
  },
}));

beforeEach(() => {
  commentsState = {
    data: [
      {
        id: 'comment-2',
        institutionName: 'Riverside University',
        institutionAbbreviation: 'RIV',
        piName: 'Dr. Ada Lovelace',
        piEmail: 'ada@riverside.edu',
        subject: 'Already replied',
        message: 'Thanks for the update.',
        status: 'replied',
        createdAt: '2026-04-13T15:00:00Z',
        updatedAt: '2026-04-13T15:15:00Z',
        adminReply: 'We have it.',
        adminReplyAt: '2026-04-13T16:00:00Z',
      },
      {
        id: 'comment-1',
        institutionName: 'Midwest Institute of Science',
        institutionAbbreviation: 'MIS',
        piName: 'Dr. Grace Hopper',
        piEmail: 'grace@mis.edu',
        subject: 'Beamline timing clarification',
        message: 'Could you confirm the March weekend calibration window?',
        status: 'sent',
        createdAt: '2026-04-14T09:00:00Z',
        updatedAt: '2026-04-14T09:00:00Z',
        adminReply: '',
        adminReplyAt: '',
      },
    ],
    isLoading: false,
    isError: false,
  };

  updateCommentState = {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  };

  useComments.mockImplementation(() => commentsState);
  useUpdateComment.mockImplementation(() => updateCommentState);
});

test('renders API-backed inbox and uses the comments API hooks for read and reply actions', async () => {
  const user = userEvent.setup();
  const updateComment = useUpdateComment();

  render(<AdminComments />);

  expect(await screen.findByText('Midwest Institute of Science')).toBeInTheDocument();
  expect(screen.getByText('PI: Dr. Grace Hopper | grace@mis.edu')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /Beamline timing clarification/i }));

  await waitFor(() => {
    expect(updateComment.mutate).toHaveBeenCalledWith({ id: 'comment-1', status: 'read' });
  });

  await user.type(screen.getByPlaceholderText('Type a reply back to this member.'), '  Thanks for checking.  ');
  await user.click(screen.getByRole('button', { name: 'Send Reply' }));

  await waitFor(() => {
    expect(updateComment.mutateAsync).toHaveBeenCalledWith({
      id: 'comment-1',
      adminReply: 'Thanks for checking.',
    });
  });

  expect(await screen.findByText('Reply saved.')).toBeInTheDocument();
});

test('marks a sent comment read only once when it is reopened before refetch', async () => {
  const user = userEvent.setup();
  const updateComment = useUpdateComment();

  render(<AdminComments />);

  const sentCardButton = screen.getByRole('button', { name: /Beamline timing clarification/i });

  await user.click(sentCardButton);
  await user.click(sentCardButton);
  await user.click(sentCardButton);

  expect(updateComment.mutate).toHaveBeenCalledTimes(1);
  expect(updateComment.mutate).toHaveBeenCalledWith({ id: 'comment-1', status: 'read' });
});

test('saves a reply only once while the first save is still pending', async () => {
  const user = userEvent.setup();
  let resolveSave;
  const pendingSave = new Promise((resolve) => {
    resolveSave = resolve;
  });
  updateCommentState = {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockReturnValue(pendingSave),
    isPending: false,
  };

  render(<AdminComments />);

  await user.click(screen.getByRole('button', { name: /Beamline timing clarification/i }));
  const replyInput = screen.getByPlaceholderText('Type a reply back to this member.');
  await user.type(replyInput, 'Need to adjust the plan.');

  const sendButton = screen.getByRole('button', { name: 'Send Reply' });
  await user.click(sendButton);
  await user.click(sendButton);

  expect(updateCommentState.mutateAsync).toHaveBeenCalledTimes(1);
  expect(sendButton).toBeDisabled();

  resolveSave();
  await screen.findByText('Reply saved.');
});

test('shows the empty inbox state when the comments query returns no rows', async () => {
  commentsState = {
    data: [],
    isLoading: false,
    isError: false,
  };

  render(<AdminComments />);

  expect(await screen.findByText('No member comments available yet.')).toBeInTheDocument();
});

test('keeps stale inbox data visible when the query errors and surfaces a non-destructive message', async () => {
  commentsState = {
    data: [
      {
        id: 'comment-3',
        institutionName: 'Lakeside College',
        institutionAbbreviation: 'LKC',
        piName: 'Dr. Katherine Johnson',
        piEmail: 'kjohnson@lakeside.edu',
        subject: 'Cached inbox item',
        message: 'This should remain visible after a refetch failure.',
        status: 'read',
        createdAt: '2026-04-14T08:30:00Z',
        updatedAt: '2026-04-14T08:35:00Z',
        adminReply: '',
        adminReplyAt: '',
      },
    ],
    isLoading: false,
    isError: true,
  };

  render(<AdminComments />);

  expect(await screen.findByText('Cached inbox item')).toBeInTheDocument();
  expect(screen.getByText('Unable to load the comments inbox.')).toBeInTheDocument();
  expect(screen.getByText('Lakeside College')).toBeInTheDocument();
});

test('shows the loading state while the comments query is in flight', async () => {
  commentsState = {
    data: undefined,
    isLoading: true,
    isError: false,
  };

  render(<AdminComments />);

  expect(await screen.findByText('Loading member comments...')).toBeInTheDocument();
});

test('shows the hard error state when the inbox has no cached rows', async () => {
  commentsState = {
    data: undefined,
    isLoading: false,
    isError: true,
  };

  render(<AdminComments />);

  expect(await screen.findByText('Unable to load the comments inbox.')).toBeInTheDocument();
});

test('shows the API error text when saving a reply fails', async () => {
  const user = userEvent.setup();
  const submitError = new Error('Server rejected the reply');
  updateCommentState = {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockRejectedValue(submitError),
    isPending: false,
  };

  render(<AdminComments />);

  await user.click(screen.getByRole('button', { name: /Beamline timing clarification/i }));
  await user.type(screen.getByPlaceholderText('Type a reply back to this member.'), 'Need to adjust the plan.');
  await user.click(screen.getByRole('button', { name: 'Send Reply' }));

  expect(await screen.findByText('Server rejected the reply')).toBeInTheDocument();
});
