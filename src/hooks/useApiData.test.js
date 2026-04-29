import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useQuery, useMutation, useQueryClient, invalidateQueries, apiGet, apiPost } = vi.hoisted(() => ({
  useQuery: vi.fn((config) => config),
  useMutation: vi.fn((config) => config),
  useQueryClient: vi.fn(),
  invalidateQueries: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (config) => useQuery(config),
  useMutation,
  useQueryClient,
}));

vi.mock('../lib/api', () => ({
  api: {
    get: (...args) => apiGet(...args),
    post: (...args) => apiPost(...args),
  },
}));

import { useCreateInstitution, usePublishSchedule, useSchedule, useUsers } from './useApiData';

describe('useUsers', () => {
  beforeEach(() => {
    useQuery.mockClear();
    useMutation.mockClear();
    apiGet.mockReset();
    apiPost.mockReset();
    invalidateQueries.mockReset();
    useQueryClient.mockReturnValue({ invalidateQueries });
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

describe('useCreateInstitution', () => {
  beforeEach(() => {
    useMutation.mockClear();
    apiPost.mockReset();
    invalidateQueries.mockReset();
    useQueryClient.mockReturnValue({ invalidateQueries });
  });

  it('posts to /institutions and invalidates institution queries on success', async () => {
    const mutation = useCreateInstitution();

    await mutation.mutationFn({ name: 'University of Georgia', abbreviation: 'UGA' });
    mutation.onSuccess();

    expect(apiPost).toHaveBeenCalledWith('/institutions', {
      name: 'University of Georgia',
      abbreviation: 'UGA',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['institutions'] });
  });
});

describe('useSchedule', () => {
  beforeEach(() => {
    useQuery.mockClear();
    apiGet.mockReset();
    apiPost.mockReset();
    invalidateQueries.mockReset();
    useQueryClient.mockReturnValue({ invalidateQueries });
    apiGet.mockResolvedValue({ data: { data: null } });
  });

  it('fetches cycle schedules with fresh-on-mount polling defaults', async () => {
    const query = useSchedule('cycle-1');

    await query.queryFn();

    expect(query.queryKey).toEqual(['schedule', 'cycle-1']);
    expect(query.enabled).toBe(true);
    expect(query.staleTime).toBe(0);
    expect(query.refetchInterval).toBe(30000);
    expect(apiGet).toHaveBeenCalledWith('/cycles/cycle-1/schedules');
  });

  it('allows callers to override schedule polling options and disable the query', () => {
    const query = useSchedule('cycle-1', {
      enabled: false,
      refetchInterval: false,
      staleTime: 120000,
    });

    expect(query.enabled).toBe(false);
    expect(query.refetchInterval).toBe(false);
    expect(query.staleTime).toBe(120000);
  });
});

describe('usePublishSchedule', () => {
  beforeEach(() => {
    useMutation.mockClear();
    apiPost.mockReset();
    invalidateQueries.mockReset();
    useQueryClient.mockReturnValue({ invalidateQueries });
  });

  it('publishes schedules and invalidates schedule and cycle queries', async () => {
    const mutation = usePublishSchedule();

    await mutation.mutationFn('schedule-1');
    mutation.onSuccess();

    expect(apiPost).toHaveBeenCalledWith('/schedules/schedule-1/publish');
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['schedule'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['cycles'] });
  });
});
