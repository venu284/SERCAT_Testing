import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

const mockLogin = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

import LoginScreen from './LoginScreen';

beforeEach(() => {
  mockLogin.mockReset();
  mockLogin.mockResolvedValue({ id: 'user-1' });
});

test('prefills the email from route state, signs in with trimmed lowercase credentials, and navigates home on success', async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state: { email: 'INVITE@Example.edu' } }]}>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/" element={<div>Signed In Home</div>} />
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.getByLabelText(/email address/i)).toHaveValue('INVITE@Example.edu');

  await user.clear(screen.getByLabelText(/email address/i));
  await user.type(screen.getByLabelText(/email address/i), ' Invite@Example.edu ');
  await user.type(screen.getByLabelText(/password/i), 'secret123');
  await user.click(screen.getByRole('button', { name: /sign in/i }));

  await waitFor(() => {
    expect(mockLogin).toHaveBeenCalledWith('invite@example.edu', 'secret123');
  });

  expect(await screen.findByText('Signed In Home')).toBeInTheDocument();
});

test('navigates to /activate from the activation call to action', async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/activate" element={<div>Activate Route Screen</div>} />
      </Routes>
    </MemoryRouter>,
  );

  await user.click(screen.getByRole('button', { name: /activate your account/i }));

  expect(await screen.findByText('Activate Route Screen')).toBeInTheDocument();
});

test('navigates to /forgot-password from the forgot password action', async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/forgot-password" element={<div>Forgot Password Route Screen</div>} />
      </Routes>
    </MemoryRouter>,
  );

  await user.click(screen.getByRole('button', { name: /forgot password\\?/i }));

  expect(await screen.findByText('Forgot Password Route Screen')).toBeInTheDocument();
});
