import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

const mockRequestReset = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    requestReset: mockRequestReset,
  }),
}));

import ForgotPasswordScreen from './ForgotPasswordScreen';

beforeEach(() => {
  mockRequestReset.mockReset();
  mockRequestReset.mockResolvedValue({
    message: 'If that email is registered, a reset link has been sent.',
  });
});

test('submits email and shows success state', async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
        <Route path="/login" element={<div>Login Screen</div>} />
      </Routes>
    </MemoryRouter>,
  );

  await user.type(screen.getByLabelText(/email address/i), ' Ada@Example.org ');
  await user.click(screen.getByRole('button', { name: /send reset link/i }));

  await waitFor(() => {
    expect(mockRequestReset).toHaveBeenCalledWith('ada@example.org');
  });

  expect(await screen.findByRole('heading', { name: /check your email/i })).toBeInTheDocument();
  expect(screen.getByText(/reset link expires in 1 hour/i)).toBeInTheDocument();
});

test('shows error when email is empty', async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  await user.click(screen.getByRole('button', { name: /send reset link/i }));

  expect(screen.getByText(/enter your email address/i)).toBeInTheDocument();
  expect(mockRequestReset).not.toHaveBeenCalled();
});

test('navigates back to login from the success state', async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
        <Route path="/login" element={<div>Login Screen</div>} />
      </Routes>
    </MemoryRouter>,
  );

  await user.type(screen.getByLabelText(/email address/i), 'ada@example.org');
  await user.click(screen.getByRole('button', { name: /send reset link/i }));

  expect(await screen.findByRole('heading', { name: /check your email/i })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /back to sign in/i }));

  expect(await screen.findByText('Login Screen')).toBeInTheDocument();
});
