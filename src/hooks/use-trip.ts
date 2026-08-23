import { useQuery } from '@tanstack/react-query';

import { fetchTrip } from '@/lib/trips-api';
import { Trip } from '@/lib/types';

/** Full trip (with stops) by id — GET /trips/:id. */
export function useTrip(tripId: string | null | undefined) {
  return useQuery<Trip>({
    queryKey: ['trip', tripId],
    queryFn: () => fetchTrip(tripId as string),
    enabled: !!tripId,
  });
}
