import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useQuery, useMutation, useQueryClient, apiGet } = vi.hoisted(() => ({
  useQuery: vi.fn((config) => config),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
  apiGet: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (config) => useQuery(config),
  useMutation,
  useQueryClient,
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args) => apiGet(...args),
  },
}));

import { useUsers } from './useApiData';

describe('useUsers', () => {
  beforeEach(() => {
    useQuery.mockClear();
    apiGet.mockReset();
    apiGet.mockResolvedValue({ data: { data: [] } });
  });

  it('uses /users when no params are provided', async () => {
    const query = useUsers();

    await query.queryFn();

    expect(query.queryKey).toEqual(['users', {}]);
    expect(apiGet).toHaveBeenCalledWith('/users');
  });

  it('builds the /users query string explicitly when params are provided', async () => {
    const query = useUsers({ limit: 1000, page: 2 });

    await query.queryFn();

    expect(query.queryKey).toEqual(['users', { limit: 1000, page: 2 }]);
    expect(apiGet).toHaveBeenCalledWith('/users?limit=1000&page=2');
  });
});
