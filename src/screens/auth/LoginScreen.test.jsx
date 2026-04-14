import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

const mockNavigate = vi.fn();
const mockUseLocation = vi.fn();
const mockLogin = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useLocation: () => mockUseLocation(),
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

import LoginScreen from './LoginScreen';

beforeEach(() => {
  mockNavigate.mockReset();
  mockLogin.mockReset();
  mockUseLocation.mockReset();
  mockUseLocation.mockReturnValue({
    state: {
      email: 'INVITE@Example.edu',
    },
  });
  mockLogin.mockResolvedValue({ id: 'user-1' });
});

test('prefills the email from location state, signs in with trimmed lowercase credentials, and navigates home on success', async () => {
  const user = userEvent.setup();

  render(<LoginScreen />);

  expect(screen.getByLabelText(/email address/i)).toHaveValue('INVITE@Example.edu');

  await user.type(screen.getByLabelText(/password/i), 'secret123');
  await user.click(screen.getByRole('button', { name: /sign in/i }));

  await waitFor(() => {
    expect(mockLogin).toHaveBeenCalledWith('invite@example.edu', 'secret123');
  });

  expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
});
