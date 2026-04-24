import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

const mockSetNewPassword = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    setNewPassword: mockSetNewPassword,
  }),
}));

import ResetPasswordScreen from './ResetPasswordScreen';

beforeEach(() => {
  mockSetNewPassword.mockReset();
  mockSetNewPassword.mockResolvedValue({
    message: 'Password updated successfully. You can now sign in.',
  });
});

test('submits new password and shows success state', async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={['/reset-password?token=abc123']}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordScreen />} />
        <Route path="/login" element={<div>Login Screen</div>} />
      </Routes>
    </MemoryRouter>,
  );

  await user.type(screen.getByLabelText(/^new password$/i), 'Strong@123');
  await user.type(screen.getByLabelText(/confirm password/i), 'Strong@123');
  await user.click(screen.getByRole('button', { name: /reset password/i }));

  await waitFor(() => {
    expect(mockSetNewPassword).toHaveBeenCalledWith('abc123', 'Strong@123', 'Strong@123');
  });

  expect(await screen.findByRole('heading', { name: /password updated/i })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /sign in now/i }));

  expect(await screen.findByText('Login Screen')).toBeInTheDocument();
});

test('shows error when token is missing', () => {
  render(
    <MemoryRouter initialEntries={['/reset-password']}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.getByRole('heading', { name: /invalid reset link/i })).toBeInTheDocument();
  expect(screen.queryByLabelText(/^new password$/i)).not.toBeInTheDocument();
});

test('shows error when passwords do not match', async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={['/reset-password?token=abc123']}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  await user.type(screen.getByLabelText(/^new password$/i), 'Strong@123');
  await user.type(screen.getByLabelText(/confirm password/i), 'Different@123');
  await user.click(screen.getByRole('button', { name: /reset password/i }));

  expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  expect(mockSetNewPassword).not.toHaveBeenCalled();
});

test('shows error when server returns INVALID_TOKEN', async () => {
  const user = userEvent.setup();
  mockSetNewPassword.mockRejectedValue({
    message: 'Invalid or expired reset token',
    code: 'INVALID_TOKEN',
  });

  render(
    <MemoryRouter initialEntries={['/reset-password?token=abc123']}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordScreen />} />
        <Route path="/forgot-password" element={<div>Forgot Password Screen</div>} />
      </Routes>
    </MemoryRouter>,
  );

  await user.type(screen.getByLabelText(/^new password$/i), 'Strong@123');
  await user.type(screen.getByLabelText(/confirm password/i), 'Strong@123');
  await user.click(screen.getByRole('button', { name: /reset password/i }));

  expect(await screen.findByText(/expired or already been used/i)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /request new reset link/i }));

  expect(await screen.findByText('Forgot Password Screen')).toBeInTheDocument();
});
