import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { updateMe } from '@/lib/auth-api';
import { useAuthStore } from '@/store/auth';

/**
 * Phone counterpart of the web `useAutoAway` revert. The web / desktop flips a
 * manager to AWAY after 15 min without mouse or keyboard input, and only its
 * own activity flips them back — so a manager who left the desk and works from
 * this app stayed "away" for everyone. While the app is on screen, an AWAY
 * status is lifted back to ONLINE, both on opening the app and whenever the
 * desk sets AWAY again (it arrives here via userStatusChanged).
 *
 * Manual BUSY / SLEEP / VACATION are left alone, same as on the web.
 */
export function useAutoOnline() {
  const status = useAuthStore((s) => s.user?.status);
  const [active, setActive] = useState(AppState.currentState === 'active');
  // Dedupe while the PATCH is in flight (status stays AWAY until it lands).
  const inFlight = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) =>
      setActive(next === 'active'),
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!active || status !== 'AWAY' || inFlight.current) return;
    inFlight.current = true;
    updateMe({ status: 'ONLINE' })
      .then((me) => useAuthStore.getState().setUser(me))
      .catch(() => {
        // Offline or a server hiccup — the next foreground retries.
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [active, status]);
}
