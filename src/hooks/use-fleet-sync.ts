import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth';

/**
 * Global live sync for fleet data. The backend auto-joins the socket to the
 * `company-${companyId}` room on connect, so we receive these company-wide
 * events regardless of which screen is open — invalidate the affected caches
 * so trip statuses, truck assignments and user statuses update everywhere
 * immediately, without a reload.
 */
export function useFleetSync() {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);

    const onTripUpdated = (p: { tripId: string }) => {
      qc.invalidateQueries({ queryKey: ['trip', p.tripId] });
      qc.invalidateQueries({ queryKey: ['trips-by-truck'] });
      qc.invalidateQueries({ queryKey: ['trucks-my'] });
    };
    const onTruckChanged = () => {
      qc.invalidateQueries({ queryKey: ['trucks-my'] });
      qc.invalidateQueries({ queryKey: ['trips-by-truck'] });
      qc.invalidateQueries({ queryKey: ['company-users'] });
    };
    const onUserStatusChanged = () => {
      qc.invalidateQueries({ queryKey: ['company-users'] });
    };

    socket.on('tripUpdated', onTripUpdated);
    socket.on('truckChanged', onTruckChanged);
    socket.on('userStatusChanged', onUserStatusChanged);
    return () => {
      socket.off('tripUpdated', onTripUpdated);
      socket.off('truckChanged', onTruckChanged);
      socket.off('userStatusChanged', onUserStatusChanged);
    };
  }, [qc, token]);
}
