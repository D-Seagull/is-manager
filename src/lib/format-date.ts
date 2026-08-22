import i18n from '@/lib/i18n';

/**
 * Date/time helpers that follow the app's chosen UI language (i18n) instead
 * of the device locale — the native `toLocale*` methods default to the device
 * locale, which left dates/times in the wrong language after a UI-language
 * switch. Options mirror the native `Intl.DateTimeFormatOptions`.
 */
export function formatDate(
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Date(value).toLocaleDateString(i18n.language, options);
}

export function formatTime(
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Date(value).toLocaleTimeString(i18n.language, options);
}

export function formatDateTime(
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Date(value).toLocaleString(i18n.language, options);
}
