import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useInstitutions() {
  return useQuery({
    queryKey: ['institutions'],
    queryFn: () => api.get('/institutions').then((r) => r.data),
  });
}

export function useUsers(params = {}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => api.get('/users', { params }).then((r) => r.data),
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
    mutationFn: ({ cycleId, preferences, fractionalPreferences = [] }) =>
      api.post(`/cycles/${cycleId}/preferences`, { preferences, fractionalPreferences }),
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

export function useSchedule(cycleId) {
  return useQuery({
    queryKey: ['schedule', cycleId],
    queryFn: () => api.get(`/cycles/${cycleId}/schedules`).then((r) => r.data),
    enabled: Boolean(cycleId),
  });
}

export function useGenerateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cycleId) => api.post(`/cycles/${cycleId}/schedules/generate`),
    onSuccess: (_, cycleId) => qc.invalidateQueries({ queryKey: ['schedule', cycleId] }),
  });
}

export function usePublishSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scheduleId) => api.post(`/schedules/${scheduleId}/publish`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  });
}

export function useAdjustAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ scheduleId, assignmentId, ...data }) =>
      api.put(`/schedules/${scheduleId}/assignments/${assignmentId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data),
    refetchInterval: 60000,
  });
}

export function useComments() {
  return useQuery({
    queryKey: ['comments'],
    queryFn: () => api.get('/comments').then((r) => r.data),
  });
}

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/comments', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments'] }),
  });
}

export function useUpdateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/comments/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments'] }),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.put(`/notifications/${id}`, { isRead: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.put('/notifications', { action: 'read-all' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useSwapRequests() {
  return useQuery({
    queryKey: ['swap-requests'],
    queryFn: () => api.get('/swap-requests').then((r) => r.data),
  });
}

export function useCreateSwapRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/swap-requests', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['swap-requests'] }),
  });
}

export function useResolveSwapRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/swap-requests/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['swap-requests'] });
      qc.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
}

export function useAuditLog(page = 1) {
  return useQuery({
    queryKey: ['audit-log', page],
    queryFn: () => api.get(`/admin/audit-log?page=${page}`),
  });
}
