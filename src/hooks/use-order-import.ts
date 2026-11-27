import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type {
  OrderDraft,
  OrderFinance,
  OrderLocalFile,
  TripFinanceData,
  TripOrderFile,
} from '@/lib/order-import';

/**
 * "Fill from order" API — same endpoints as is-fleet-frontend
 * (src/hooks/use-order-import.ts). Managers only on the server.
 */

/** Both switches on (server + company AI)? Off → the form hides the box. */
export function useOrderImportStatus() {
  return useQuery({
    queryKey: ['order-import-status'],
    queryFn: async () => {
      const res = await api.get('/order-import/status');
      return res.data as { enabled: boolean };
    },
    // The company AI switch (admin panel) should bite within a minute.
    staleTime: 60_000,
  });
}

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

/** File or pasted text → draft. A model reads it: allow it time. */
export function useParseOrder() {
  return useMutation({
    mutationFn: async (input: {
      file?: OrderLocalFile;
      text?: string;
      locale: string;
      /** Driver picked in the form: the notes come back in their language. */
      driverId?: string;
    }) => {
      const form = new FormData();
      if (input.file) {
        // RN FormData wants {uri, name, type} for file fields.
        form.append('file', {
          uri: input.file.uri,
          name: input.file.name,
          type: input.file.mimeType,
        } as unknown as Blob);
      }
      if (input.text) form.append('text', input.text);
      form.append('locale', input.locale);
      if (input.driverId) form.append('driverId', input.driverId);
      const res = await api.post('/order-import/parse', form, {
        ...multipart,
        timeout: 180_000,
      });
      return res.data as OrderDraft;
    },
  });
}

export async function uploadTripOrder(tripId: string, file: OrderLocalFile) {
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);
  const res = await api.post(`/trips/${tripId}/order`, form, multipart);
  return res.data as TripOrderFile;
}

/** The trip's order file; null when the trip has none. */
export function useTripOrder(tripId: string | undefined) {
  return useQuery({
    queryKey: ['trip-order', tripId],
    enabled: !!tripId,
    queryFn: async () => {
      const res = await api.get(`/trips/${tripId}/order`);
      return (res.data || null) as TripOrderFile | null;
    },
  });
}

/** The trip's money side; null when nothing was entered. */
export function useTripFinance(tripId: string | undefined) {
  return useQuery({
    queryKey: ['trip-finance', tripId],
    enabled: !!tripId,
    queryFn: async () => {
      const res = await api.get(`/trips/${tripId}/finance`);
      return (res.data || null) as TripFinanceData | null;
    },
  });
}

export async function saveTripFinance(tripId: string, data: OrderFinance) {
  const res = await api.put(`/trips/${tripId}/finance`, data);
  return res.data as TripFinanceData;
}

export function useSaveTripFinance(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: OrderFinance) => saveTripFinance(tripId, data),
    onSuccess: (row) => qc.setQueryData(['trip-finance', tripId], row),
  });
}

/** After create: show the new trip's order file and finance right away. */
export function useRefreshTripExtras() {
  const qc = useQueryClient();
  return (tripId: string) => {
    void qc.invalidateQueries({ queryKey: ['trip-order', tripId] });
    void qc.invalidateQueries({ queryKey: ['trip-finance', tripId] });
  };
}
