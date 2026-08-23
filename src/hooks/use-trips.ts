import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { StopType, Trip } from '@/lib/types';

export interface StopFormData {
  type: StopType;
  order: number;
  name?: string;
  address?: string;
  ref?: string;
  coords?: string;
  windowDate?: string; // "YYYY-MM-DD"
  windowStart?: string; // "HH:mm"
  windowEnd?: string; // "HH:mm"
}

export interface CreateTripPayload {
  title: string;
  driverId: string;
  truckId: string;
  notes?: string;
  orderNumber?: string;
  stops: StopFormData[];
}

/** All trips of a truck (newest first) — GET /trips/truck/:truckId. */
export function useTripsByTruck(truckId: string | null | undefined) {
  return useQuery<Trip[]>({
    queryKey: ['trips-by-truck', truckId],
    queryFn: async () => {
      const res = await api.get(`/trips/truck/${truckId}`);
      return res.data;
    },
    enabled: !!truckId,
  });
}

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateTripPayload) => {
      const res = await api.post('/trips', data);
      return res.data as Trip;
    },
    onSuccess: (trip) => {
      qc.invalidateQueries({ queryKey: ['trips-by-truck', trip.truck?.id] });
      qc.invalidateQueries({ queryKey: ['trucks-my'] });
    },
  });
}

/** Edit an existing trip's stops / notes / order number — PATCH /trips/:id/info. */
export function useUpdateTripInfo(truckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      title,
      notes,
      orderNumber,
      stops,
    }: {
      id: string;
      title?: string | null;
      notes?: string | null;
      orderNumber?: string | null;
      stops: StopFormData[];
    }) => {
      const res = await api.patch(`/trips/${id}/info`, { title, notes, orderNumber, stops });
      return res.data as Trip;
    },
    onSuccess: (trip) => {
      qc.invalidateQueries({ queryKey: ['trips-by-truck', truckId] });
      qc.invalidateQueries({ queryKey: ['trip', trip.id] });
    },
  });
}

/** Override the trip status (manager) — PATCH /trips/:id/status. */
export function useUpdateTripStatus(truckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.patch(`/trips/${id}/status`, { status });
      return res.data as Trip;
    },
    onSuccess: (trip) => {
      qc.invalidateQueries({ queryKey: ['trips-by-truck', truckId] });
      qc.invalidateQueries({ queryKey: ['trip', trip.id] });
      qc.invalidateQueries({ queryKey: ['trucks-my'] });
    },
  });
}

/** Reassign the trip's driver — PATCH /trips/:id/assign. */
export function useReassignTrip(truckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, driverId }: { id: string; driverId: string }) => {
      const res = await api.patch(`/trips/${id}/assign`, { driverId });
      return res.data as Trip;
    },
    onSuccess: (trip) => {
      qc.invalidateQueries({ queryKey: ['trips-by-truck', truckId] });
      qc.invalidateQueries({ queryKey: ['trip', trip.id] });
    },
  });
}
