import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getSocket } from '@/lib/socket';
import { UserStatus } from '@/lib/auth-api';
import { useAuthStore } from '@/store/auth';

interface UserStatusEvent {
  userId: string;
  status: UserStatus;
  statusUntil: string | null;
}

/**
 * Дзеркалить web/is-driver `useUserStatusSync`. Слухає `userStatusChanged`
 * (бекенд шле в `company-{companyId}` кімнату з `updateMe`) і **прямо патчить**
 * усі кеші, що показують статус-точку — без refetch, тож дот міняється миттєво,
 * як у драйвер-застосунку. Монтується один раз у `(manager)/_layout`.
 *
 * Presence (online/offline) окремо тримає `usePresenceSync`; тут — саме опція
 * статусу (ONLINE/BUSY/SLEEP/AWAY/VACATION).
 */
export function useUserStatusSync() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const myId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const patch = <
      T extends { id: string; status?: UserStatus | string | null; statusUntil?: string | null },
    >(
      u: T,
      evt: UserStatusEvent,
    ): T => {
      if (u.id !== evt.userId) return u;
      return { ...u, status: evt.status, statusUntil: evt.statusUntil };
    };

    const onChange = (evt: UserStatusEvent) => {
      // 1) Self — тримаємо власний стор свіжим (картка менеджера внизу головної).
      if (evt.userId === myId) {
        const current = useAuthStore.getState().user;
        if (current) {
          setUser({ ...current, status: evt.status, statusUntil: evt.statusUntil });
        }
      }

      // 2) Списки компанії — Водії / Менеджери / директорія чату.
      queryClient.setQueriesData<unknown>({ queryKey: ['company-users'] }, (data: unknown) => {
        if (!Array.isArray(data)) return data;
        let changed = false;
        const next = data.map((u: { id: string }) => {
          if (u.id !== evt.userId) return u;
          changed = true;
          return patch(u as never, evt);
        });
        return changed ? next : data;
      });

      // 2b) Список розмов у чаті — conv.user.
      queryClient.setQueriesData<unknown>({ queryKey: ['conversations'] }, (data: unknown) => {
        if (!Array.isArray(data)) return data;
        let changed = false;
        const next = data.map((conv: { user: { id: string } }) => {
          if (conv.user.id !== evt.userId) return conv;
          changed = true;
          return { ...conv, user: patch(conv.user as never, evt) };
        });
        return changed ? next : data;
      });

      // 3) Деталь користувача (person/[id]).
      queryClient.setQueriesData<unknown>({ queryKey: ['user', evt.userId] }, (data: unknown) =>
        data ? patch(data as never, evt) : data,
      );

      // 4) Заголовок DM (chat-user).
      queryClient.setQueriesData<unknown>({ queryKey: ['chat-user', evt.userId] }, (data: unknown) =>
        data ? patch(data as never, evt) : data,
      );

      // 5) Картки траків — вкладений currentDriver.
      const patchTrucks = (data: unknown) => {
        if (!Array.isArray(data)) return data;
        let changed = false;
        const next = data.map((tr: { currentDriver?: { id: string } | null }) => {
          if (!tr.currentDriver || tr.currentDriver.id !== evt.userId) return tr;
          changed = true;
          return { ...tr, currentDriver: patch(tr.currentDriver as never, evt) };
        });
        return changed ? next : data;
      };
      queryClient.setQueriesData<unknown>({ queryKey: ['trucks-my'] }, patchTrucks);
      queryClient.setQueriesData<unknown>({ queryKey: ['trucks-all'] }, patchTrucks);

      // 6) Групи менеджерів — учасник у списку.
      queryClient.setQueriesData<unknown>({ queryKey: ['manager-groups'] }, (data: unknown) => {
        if (!Array.isArray(data)) return data;
        let changed = false;
        const next = data.map((g: { managers?: { manager: { id: string } }[] }) => {
          if (!g.managers?.some((m) => m.manager.id === evt.userId)) return g;
          changed = true;
          return {
            ...g,
            managers: g.managers.map((m) =>
              m.manager.id === evt.userId ? { ...m, manager: patch(m.manager as never, evt) } : m,
            ),
          };
        });
        return changed ? next : data;
      });
    };

    socket.on('userStatusChanged', onChange);
    return () => {
      socket.off('userStatusChanged', onChange);
    };
  }, [queryClient, setUser, myId]);
}
