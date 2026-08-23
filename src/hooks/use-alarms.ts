import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

export type AlarmRecurrence = 'NONE' | 'DAILY' | 'WEEKLY';

export interface Alarm {
  id: string;
  createdById: string;
  targetUserId: string;
  tripId: string | null;
  title: string;
  note: string | null;
  time: string;
  recurrence: AlarmRecurrence;
  isSent: boolean;
  createdAt: string;
  creator: { id: string; firstName: string; lastName: string | null; role: string };
  target: { id: string; firstName: string; lastName: string | null; role: string };
  trip: { id: string; title: string; truckId: string } | null;
}

export interface CreateAlarmPayload {
  targetUserId: string;
  title: string;
  note?: string;
  time: string;
  tripId?: string;
  recurrence?: AlarmRecurrence;
}

export interface UpdateAlarmPayload {
  title?: string;
  note?: string;
  time?: string;
  recurrence?: AlarmRecurrence;
}

export function useAlarmsByTruck(truckId: string | null | undefined) {
  return useQuery<Alarm[]>({
    queryKey: ['alarms-by-truck', truckId],
    queryFn: async () => {
      const res = await api.get(`/alarms/truck/${truckId}`);
      return res.data;
    },
    enabled: !!truckId,
  });
}

export function useCreateAlarm(truckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAlarmPayload) => {
      const res = await api.post('/alarms', payload);
      return res.data as Alarm;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alarms-by-truck', truckId] }),
  });
}

export function useUpdateAlarm(truckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UpdateAlarmPayload }) => {
      const res = await api.patch(`/alarms/${id}`, patch);
      return res.data as Alarm;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alarms-by-truck', truckId] }),
  });
}

export function useDeleteAlarm(truckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/alarms/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alarms-by-truck', truckId] }),
  });
}
