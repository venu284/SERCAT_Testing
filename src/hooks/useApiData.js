import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useInstitutions() {
  return useQuery({
    queryKey: ['institutions'],
    queryFn: () => api.get('/institutions').then((r) => r.data),
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/users', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useCycles() {
  return useQuery({
    queryKey: ['cycles'],
    queryFn: () => api.get('/cycles').then((r) => r.data),
  });
}

export function useCreateCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/cycles', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cycles'] }),
  });
}

export function useUpdateCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/cycles/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cycles'] }),
  });
}

export function useAvailableDates(cycleId) {
  return useQuery({
    queryKey: ['available-dates', cycleId],
    queryFn: () => api.get(`/cycles/${cycleId}/dates`).then((r) => r.data),
    enabled: Boolean(cycleId),
  });
}

export function useSetAvailableDates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cycleId, dates }) => api.post(`/cycles/${cycleId}/dates`, { dates }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['available-dates', vars.cycleId] }),
  });
}

export function useMasterShares() {
  return useQuery({
    queryKey: ['master-shares'],
    queryFn: () => api.get('/shares').then((r) => r.data),
  });
}

export function useUploadShares() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/shares/upload', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['master-shares'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['institutions'] });
    },
  });
}

export function useCycleShares(cycleId) {
  return useQuery({
    queryKey: ['cycle-shares', cycleId],
    queryFn: () => api.get(`/cycles/${cycleId}/shares`).then((r) => r.data),
    enabled: Boolean(cycleId),
  });
}

export function useSnapshotShares() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cycleId) => api.post(`/cycles/${cycleId}/shares/snapshot`),
    onSuccess: (_, cycleId) => qc.invalidateQueries({ queryKey: ['cycle-shares', cycleId] }),
  });
}

export function usePreferences(cycleId) {
  return useQuery({
    queryKey: ['preferences', cycleId],
    queryFn: () => api.get(`/cycles/${cycleId}/preferences`).then((r) => r.data),
    enabled: Boolean(cycleId),
  });
}

export function useSubmitPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cycleId, preferences }) => api.post(`/cycles/${cycleId}/preferences`, { preferences }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['preferences', vars.cycleId] }),
  });
}

export function usePreferenceStatus(cycleId) {
  return useQuery({
    queryKey: ['preference-status', cycleId],
    queryFn: () => api.get(`/cycles/${cycleId}/preferences/status`).then((r) => r.data),
    enabled: Boolean(cycleId),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data),
    refetchInterval: 60000,
  });
}

export function useAuditLog(page = 1) {
  return useQuery({
    queryKey: ['audit-log', page],
    queryFn: () => api.get(`/admin/audit-log?page=${page}`),
  });
}
