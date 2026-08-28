import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { AppLanguage, updateMe } from '@/lib/auth-api';
import { useAuthStore, useUser } from '@/store/auth';

// Locales that are also valid chat-translation `Language` values. German is a
// UI-only locale — the backend has no German push text, so a DE UI just leaves
// `language` untouched (push falls back to UK server-side).
const CHAT_LANGS: AppLanguage[] = ['UK', 'EN', 'PL', 'LT', 'RU'];

/**
 * Server push notifications are localized by `User.language`, which defaults to
 * EN and is otherwise only changed by the Settings picker. The manager UI,
 * though, follows the device locale by default — so a manager on a Polish phone
 * saw a Polish app but English pushes. Keep `language` in step with the live UI
 * locale so pushes arrive in the language the manager actually reads.
 */
export function useSyncPushLanguage() {
  const { i18n } = useTranslation();
  const user = useUser();
  const setUser = useAuthStore((s) => s.setUser);
  const uiLang = i18n.language;

  useEffect(() => {
    if (!user) return;
    const target = uiLang.toUpperCase() as AppLanguage;
    if (!CHAT_LANGS.includes(target)) return;
    if (user.language === target) return;
    void updateMe({ language: target })
      .then(setUser)
      .catch((err) => console.warn('[push] language sync failed', err));
    // Depend on id + uiLang only: after the PATCH updates the store user, these
    // stay the same, so the effect doesn't loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, uiLang]);
}
