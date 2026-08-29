import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { ensureSocketAlive, getSocket } from '@/lib/socket';

/**
 * Тримає сокет живим при поверненні з фону та каже серверу про foreground/
 * background (для push-fallback). Після довгого фону мобільний сокет часто
 * «замерзає» — на `active` реконектимо його, щоб presence-точки й live-події
 * (tripUpdated, статуси) ожили, і перезапитуємо presence-снапшот.
 */
export function useAppStatePresence() {
  useEffect(() => {
    // Коли пішли у фон — щоб на поверненні знати, чи фон був довгим.
    let backgroundedAt = 0;

    const emit = (state: AppStateStatus) => {
      const sock = getSocket();
      if (state === 'active') {
        // Після ДОВГОГО фону сокет часто «замерзає» (connected===true, але
        // транспорт мертвий) і сам не оживає — форсуємо свіжий реконект.
        const longBg = backgroundedAt > 0 && Date.now() - backgroundedAt > 20_000;
        backgroundedAt = 0;
        if (!sock.connected) {
          sock.connect();
        } else if (longBg) {
          sock.disconnect();
          sock.connect();
        } else {
          sock.emit('appActive');
          sock.emit('requestPresence');
        }
      } else {
        backgroundedAt = Date.now();
        if (sock.connected) sock.emit('appBackground');
      }
    };

    emit(AppState.currentState);
    const sub = AppState.addEventListener('change', emit);

    // Foreground watchdog — a socket can freeze WITHOUT any app-state change
    // (left open on a desk, brief network drop). While foregrounded, poll the
    // socket's liveness and force a reconnect if the packet stream went quiet,
    // so realtime never silently dies until a manual reload.
    let watchdog: ReturnType<typeof setInterval> | null = null;
    const startWatchdog = () => {
      if (watchdog) return;
      watchdog = setInterval(() => {
        if (AppState.currentState === 'active') ensureSocketAlive();
      }, 15_000);
    };
    const stopWatchdog = () => {
      if (watchdog) {
        clearInterval(watchdog);
        watchdog = null;
      }
    };
    const onAppStateWatch = (state: AppStateStatus) => {
      if (state === 'active') startWatchdog();
      else stopWatchdog();
    };
    if (AppState.currentState === 'active') startWatchdog();
    const watchSub = AppState.addEventListener('change', onAppStateWatch);

    // На кожен (ре)конект серверний прапорець active скидається в true — якщо ми
    // реконектнулись у фоні, треба чесно повідомити реальний стан.
    const sock = getSocket();
    const onConnect = () => emit(AppState.currentState);
    sock.on('connect', onConnect);

    return () => {
      sub.remove();
      watchSub.remove();
      stopWatchdog();
      sock.off('connect', onConnect);
    };
  }, []);
}
