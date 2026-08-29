import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';

export interface UnreadTripItem {
  truckId: string;
  plate: string;
  totalUnread: number;
  activeTripUnread: number;
  latestMessage: { content: string; senderName: string; createdAt: string } | null;
}

export interface TripUnreadSummary {
  total: number;
  items: UnreadTripItem[];
}

/** Непрочитані повідомлення рейсів, згруповані по траках — GET /messages/unread. */
export function useTripUnread() {
  return useQuery<TripUnreadSummary>({
    queryKey: ['trip-unread'],
    queryFn: async () => {
      const res = await api.get('/messages/unread');
      return res.data;
    },
    staleTime: 10_000,
  });
}

/**
 * Глобально оновлює лічильник непрочитаного рейсів на подію `tripUnreadChanged`
 * (бекенд шле її стейкхолдерам, які не в чаті). Монтується один раз у layout.
 */
export function useTripUnreadSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const socket = getSocket();
    const bump = () => qc.invalidateQueries({ queryKey: ['trip-unread'] });
    socket.on('tripUnreadChanged', bump);
    // Catch up after any (re)connect — events that arrived while the app was
    // backgrounded / the socket was down are missed, so refetch on reconnect.
    socket.on('connect', bump);
    return () => {
      socket.off('tripUnreadChanged', bump);
      socket.off('connect', bump);
    };
  }, [qc]);
}
