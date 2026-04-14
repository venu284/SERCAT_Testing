import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

import MemberComments from './MemberComments';

const useComments = vi.fn();
const useCreateComment = vi.fn();

vi.mock('../../hooks/useApiData', () => ({
  useComments: () => useComments(),
  useCreateComment: () => useCreateComment(),
}));

beforeEach(() => {
  useComments.mockReturnValue({
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
  });

  useCreateComment.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  });
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
