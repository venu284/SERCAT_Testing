import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

const mockLogin = vi.fn();
const mockActivate = vi.fn();
const mockLogout = vi.fn();

vi.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: mockLogin,
    activate: mockActivate,
    logout: mockLogout,
  }),
}));

vi.mock('./hooks/useAppShell', () => ({
  useAppShell: () => ({
    user: null,
    authLoading: false,
    logout: vi.fn(),
    isAuthenticated: false,
    isAdmin: false,
    currentView: 'admin',
    setCurrentView: vi.fn(),
    memberTab: 'dashboard',
    setMemberTab: vi.fn(),
    adminTab: 'dashboard',
    setAdminTab: vi.fn(),
    cycle: { id: '2031-2', startDate: '', endDate: '', preferenceDeadline: '', _dbId: null, _status: '' },
    activeCycleId: null,
    members: [],
    activeMember: null,
    hasGeneratedSchedule: false,
    pendingRegistrationCount: 0,
    memberTabBadges: {},
    dataReady: false,
    dataLoading: false,
  }),
}));

import App from './App';

beforeEach(() => {
  mockLogin.mockReset();
  mockActivate.mockReset();
  mockLogout.mockReset();
  mockLogin.mockResolvedValue({ id: 'user-1' });
});

test('unknown unauthenticated routes redirect to /login and the activate CTA reaches /activate with the live cycle shown', async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={['/unknown']}>
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  expect(screen.getByText('Cycle 2031-2')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /activate your account/i }));

  expect(await screen.findByRole('heading', { name: /complete your account/i })).toBeInTheDocument();
  expect(screen.getByText('Cycle 2031-2')).toBeInTheDocument();
});

test('the real app auth routes hand activation off to /login with the email prefilled and the live cycle shown', async () => {
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
      <App />
    </MemoryRouter>,
  );

  expect(await screen.findByRole('heading', { name: /complete your account/i })).toBeInTheDocument();
  expect(screen.getByText('Cycle 2031-2')).toBeInTheDocument();

  await user.type(screen.getByLabelText(/activation token/i), 'invite-token-123');
  await user.type(screen.getByLabelText(/set password/i), 'secret123');
  await user.type(screen.getByLabelText(/confirm password/i), 'secret123');
  await user.click(screen.getByRole('button', { name: /activate account/i }));

  await waitFor(() => {
    expect(mockActivate).toHaveBeenCalledWith('invite-token-123', 'secret123', 'secret123', '');
  });

  expect(await screen.findByText(/activation complete/i)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /sign in now/i }));

  expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/email address/i)).toHaveValue('ada@example.edu');
  expect(screen.getByText('Cycle 2031-2')).toBeInTheDocument();
});
