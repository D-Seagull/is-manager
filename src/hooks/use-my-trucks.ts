import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { TripStatus } from '@/constants/trip-status';
import { api } from '@/lib/api';
import { UserStatus } from '@/lib/auth-api';
import { TruckNote, TruckStatus } from '@/lib/types';

export interface MyTruckDriver {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  avatar?: string | null;
  status?: UserStatus | null;
  statusUntil?: string | null;
}

export interface MyTruck {
  id: string;
  plate: string;
  status: TruckStatus;
  currentDriver: MyTruckDriver | null;
  managerId?: string | null;
  manager?: { id: string; firstName: string; lastName: string | null } | null;
  /** Active (non-DELIVERED) trip, if any — only returned by /trucks/my. */
  trips?: { id: string; status: TripStatus }[];
  truckNotes?: { content: string; createdAt: string }[];
}

/**
 * Trucks assigned to the current user (GET /trucks/my). A MANAGER always has
 * this panel; a TEAMLEAD only when they actually own trucks — so on the home
 * screen we gate the "My trucks" surface on `data.length > 0` for teamleads,
 * mirroring the web. Pass `enabled: false` to skip the request where the flag
 * isn't needed (a plain manager always shows the panel regardless).
 */
export function useMyTrucks(enabled = true) {
  return useQuery<MyTruck[]>({
    queryKey: ['trucks-my'],
    queryFn: async () => {
      const res = await api.get('/trucks/my');
      return res.data;
    },
    enabled,
  });
}

/**
 * Усі активні вантажівки компанії (GET /trucks). На відміну від /trucks/my не
 * повертає активний рейс (`trips`), тож картка показує власний статус траку —
 * як у вебі (`(app)/trucks`).
 */
export function useTrucks() {
  return useQuery<MyTruck[]>({
    queryKey: ['trucks-all'],
    queryFn: async () => {
      const res = await api.get('/trucks');
      return res.data;
    },
  });
}

/**
 * Один трак компанії по id (GET /trucks/:id). Працює для будь-якого трака
 * компанії (не лише «моїх») і повертає currentDriver + manager + активний рейс —
 * тому екран деталі траку бере дані звідси, а не з /trucks/my.
 */
export function useTruck(truckId: string | null | undefined) {
  return useQuery<MyTruck>({
    queryKey: ['truck', truckId],
    queryFn: async () => {
      const res = await api.get(`/trucks/${truckId}`);
      return res.data;
    },
    enabled: !!truckId,
  });
}

// ─── Truck update + notes (Info tab) ────────────────────────────────────────

export function useUpdateTruck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { currentDriverId?: string | null; managerId?: string | null; status?: TruckStatus };
    }) => {
      const res = await api.patch(`/trucks/${id}`, data);
      return res.data;
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ['trucks-my'] });
      qc.invalidateQueries({ queryKey: ['trucks-all'] });
      qc.invalidateQueries({ queryKey: ['truck', id] });
    },
  });
}

export function useTruckNotes(truckId: string | null | undefined) {
  return useQuery<TruckNote[]>({
    queryKey: ['truck-notes', truckId],
    queryFn: async () => {
      const res = await api.get(`/trucks/${truckId}/notes`);
      return res.data;
    },
    enabled: !!truckId,
  });
}

export function useCreateTruckNote(truckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const res = await api.post(`/trucks/${truckId}/notes`, { content });
      return res.data as TruckNote;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['truck-notes', truckId] }),
  });
}

export function useDeleteTruckNote(truckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (noteId: string) => {
      await api.delete(`/trucks/notes/${noteId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['truck-notes', truckId] }),
  });
}
