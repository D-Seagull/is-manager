import { useQuery } from '@tanstack/react-query';

import { TripStatus } from '@/constants/trip-status';
import { api } from '@/lib/api';
import { UserStatus } from '@/lib/auth-api';
import { TruckStatus } from '@/lib/types';

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
