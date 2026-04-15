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

  it('pages through all user results when all: true is requested', async () => {
    apiGet
      .mockResolvedValueOnce({
        data: {
          data: [{ id: 'user-1' }, { id: 'user-2' }],
          pagination: { page: 1, limit: 100, total: 3, totalPages: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ id: 'user-3' }],
          pagination: { page: 2, limit: 100, total: 3, totalPages: 2 },
        },
      });

    const query = useUsers({ all: true });
    const result = await query.queryFn();

    expect(query.queryKey).toEqual(['users', { all: true }]);
    expect(apiGet).toHaveBeenNthCalledWith(1, '/users?limit=100&page=1');
    expect(apiGet).toHaveBeenNthCalledWith(2, '/users?limit=100&page=2');
    expect(result).toEqual({
      data: [{ id: 'user-1' }, { id: 'user-2' }, { id: 'user-3' }],
      pagination: { page: 2, limit: 100, total: 3, totalPages: 2 },
    });
  });
});
