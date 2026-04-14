import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

const mockActivate = vi.fn();
const mockLogin = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    activate: mockActivate,
    login: mockLogin,
  }),
}));

import ActivateAccountScreen from './ActivateAccountScreen';
import LoginScreen from './LoginScreen';

beforeEach(() => {
  mockActivate.mockReset();
  mockLogin.mockReset();
});

test('submits activation details, shows success state, and hands off to /login with the activated email', async () => {
  const user = userEvent.setup();

  mockActivate.mockResolvedValue({
    user: {
      id: 'member-1',
      institutionName: 'Example Lab',
      name: 'Dr. Ada Lovelace',
      email: 'ada@example.edu',
    },
  });

  render(
    <MemoryRouter initialEntries={['/activate']}>
      <Routes>
        <Route path="/activate" element={<ActivateAccountScreen />} />
        <Route path="/login" element={<LoginScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  await user.type(screen.getByLabelText(/activation token/i), 'invite-token-123');
  await user.type(screen.getByLabelText(/set password/i), 'secret123');
  await user.type(screen.getByLabelText(/confirm password/i), 'secret123');
  await user.type(screen.getByLabelText(/phone/i), '555-0100');
  await user.click(screen.getByRole('button', { name: /activate account/i }));

  await waitFor(() => {
    expect(mockActivate).toHaveBeenCalledWith('invite-token-123', 'secret123', 'secret123', '555-0100');
  });

  expect(await screen.findByText(/activation complete/i)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /sign in now/i }));

  expect(await screen.findByLabelText(/email address/i)).toHaveValue('ada@example.edu');
});
