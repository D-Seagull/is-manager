import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from '@/locales/de.json';
import en from '@/locales/en.json';
import lt from '@/locales/lt.json';
import pl from '@/locales/pl.json';
import ru from '@/locales/ru.json';
import uk from '@/locales/uk.json';

import type { AppLanguage } from '@/lib/auth-api';

// The locales the manager app ships translations for.
export const SUPPORTED = ['en', 'uk', 'pl', 'lt', 'ru', 'de'] as const;
export type AppLocale = (typeof SUPPORTED)[number];

// Persist an EXPLICIT in-app language pick so it survives logout and relaunch.
// The app otherwise follows the device locale — the saved value is honoured
// only when `EXPLICIT_KEY` is set, i.e. the user actually chose a language in
// Settings. This keeps a server-side default (uiLocale defaults to UK) from
// ever overriding the phone's language for someone who never picked.
const STORAGE_KEY = 'app_locale';
const EXPLICIT_KEY = 'app_locale_explicit';

const isSupported = (code?: string | null): code is AppLocale =>
  !!code && (SUPPORTED as readonly string[]).includes(code);

/** Map the stored `AppLanguage` enum (UK/EN/PL/LT/RU…) to a locale code. */
export function toLocale(lang?: AppLanguage | string | null): AppLocale {
  const code = (lang ?? '').toLowerCase();
  return isSupported(code) ? code : 'en';
}

/** Device language on first launch, when the user hasn't picked one yet. */
function deviceLocale(): AppLocale {
  const code = getLocales()[0]?.languageCode?.toLowerCase();
  return isSupported(code) ? code : 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    uk: { translation: uk },
    pl: { translation: pl },
    lt: { translation: lt },
    ru: { translation: ru },
    de: { translation: de },
  },
  lng: deviceLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

// Restore a previously chosen language on top of the device-locale default —
// but ONLY when the user explicitly picked one (EXPLICIT_KEY set). A stale
// `app_locale` written before this flag existed is ignored, so the app falls
// back to the phone's language until the user chooses in Settings.
void Promise.all([
  AsyncStorage.getItem(STORAGE_KEY),
  AsyncStorage.getItem(EXPLICIT_KEY),
]).then(([saved, explicit]) => {
  if (explicit === '1' && isSupported(saved) && i18n.language !== saved) {
    void i18n.changeLanguage(saved);
  }
});

/**
 * Apply an EXPLICIT language pick from Settings and remember it (with the
 * explicit flag) so it wins over the device locale on future launches. Called
 * with a falsy value it is a no-op. This is the only path that changes the app
 * UI language — the server `uiLocale` is persisted for web/cross-device parity
 * but never auto-applied here, so the phone locale is the default.
 */
export function setAppLanguage(lang?: AppLanguage | string | null) {
  if (!lang) return;
  const next = toLocale(lang);
  if (i18n.language !== next) void i18n.changeLanguage(next);
  void AsyncStorage.setItem(STORAGE_KEY, next);
  void AsyncStorage.setItem(EXPLICIT_KEY, '1');
}

export default i18n;
