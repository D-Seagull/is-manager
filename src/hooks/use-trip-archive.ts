import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { ChatMessage } from '@/hooks/use-trip-chat';

export type SessionEndReason =
  | 'DRIVER_CHANGED'
  | 'MANAGER_CHANGED'
  | 'TRIP_COMPLETED'
  | 'LEGACY_RESET';

export interface ChatArchivePerson {
  id: string;
  firstName: string;
  lastName: string | null;
  avatar: string | null;
}

export interface ChatArchiveSession {
  id: string;
  tripId: string;
  driverId: string | null;
  managerId: string | null;
  startedAt: string;
  endedAt: string | null;
  endReason: SessionEndReason | null;
  driver: ChatArchivePerson | null;
  manager: ChatArchivePerson | null;
}

/**
 * Закриті чат-сесії рейсу (GET /trips/:id/chat/archive). Бекенд віддає їх
 * менеджерам (усі) та учасникам (лише свої). З'являються при зміні водія/
 * менеджера — стара розмова архівується. Дзеркалить веб `useTripChatArchive`.
 */
export function useTripChatArchive(tripId: string | null | undefined) {
  return useQuery<ChatArchiveSession[]>({
    queryKey: ['trip-chat-archive', tripId],
    queryFn: async () => {
      const res = await api.get(`/trips/${tripId}/chat/archive`);
      return res.data;
    },
    enabled: !!tripId,
  });
}

/** Повідомлення однієї архівної сесії — read-only. */
export function useArchivedSessionMessages(
  tripId: string | null | undefined,
  sessionId: string | null,
) {
  return useQuery<ChatMessage[]>({
    queryKey: ['trip-chat-archive-messages', tripId, sessionId],
    queryFn: async () => {
      const res = await api.get(`/trips/${tripId}/chat/sessions/${sessionId}/messages`);
      return res.data;
    },
    enabled: !!tripId && !!sessionId,
  });
}
