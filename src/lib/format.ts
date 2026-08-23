/**
 * Composes a display name from firstName + lastName, handling nulls so the
 * caller never has to. Drops empty parts and trims surrounding whitespace.
 *
 *   fullName({ firstName: 'Dmytro', lastName: 'Chaika' }) // "Dmytro Chaika"
 *   fullName({ firstName: 'Vasia',  lastName: null     }) // "Vasia"
 *   fullName(null)                                        // ""
 */
export function fullName(
  user: { firstName?: string | null; lastName?: string | null } | null | undefined,
): string {
  if (!user) return '';
  return [user.firstName, user.lastName]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ')
    .trim();
}

/**
 * Formats a stop's scheduled window for display, e.g. "14.08 · 08:00–10:00".
 * Returns "" when there's no meaningful time (both ends unset or 00:00), so
 * stops without a planned window render nothing. Mirrors the web helper.
 */
export function formatStopWindow(stop: {
  windowDate?: string | null;
  windowStart?: string | null;
  windowEnd?: string | null;
}): string {
  const start = stop.windowStart && stop.windowStart !== '00:00' ? stop.windowStart : '';
  const endRaw = stop.windowEnd && stop.windowEnd !== '00:00' ? stop.windowEnd : '';
  const end = endRaw && endRaw !== start ? endRaw : '';
  if (!start && !end) return '';
  const time = [start, end].filter(Boolean).join('–');
  const [, m, d] = (stop.windowDate ?? '').split('-');
  const date = m && d ? `${d}.${m}` : '';
  return date ? `${date} · ${time}` : time;
}

// Витягує "CC поштовий_індекс" з адреси. Дзеркалить веб-хелпер.
//   "Polcher Str. 113, DE-56727 Mayen"   → "DE 56727"
//   "Lancaster Way, GB-CB6 3NW Ely"      → "GB CB6 3NW"
//   "Some Street, 56727 Mayen"           → "56727"
export function extractPostcodeCity(address: string): string {
  const patterns: RegExp[] = [
    /\b([A-Z]{2})[-\s](\d{2}-\d{3})\b/i, // PL: pl 51-106 / PL-51-106
    /\b([A-Z]{2})[-\s]([A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2})\b/i, // GB: GB-CB6 3NW
    /\b([A-Z]{2})[-\s](\d{4,6})\b/i, // DE/AT/FR: DE-56727
    /\b(\d{2}-\d{3})\b/, // PL без коду: 51-106
    /\b([A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2})\b/i, // UK без коду: CB6 3NW
    /\b(\d{4,6})\b/, // DE/FR без коду: 56727
  ];
  for (const pattern of patterns) {
    const match = address.match(pattern);
    if (!match) continue;
    if (match[2]) return `${match[1].toUpperCase()} ${match[2].toUpperCase()}`;
    return match[1].toUpperCase();
  }
  const parts = address
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const last = parts[parts.length - 1] ?? address;
  return last.replace(/^[a-z]{1,3}[-\s]/i, '').trim();
}

/** Назва рейсу з адрес: перше завантаження → останнє розвантаження. */
export function deriveTripTitle(
  rows: { type: string; address?: string | null }[],
): string {
  const from = rows.find((s) => s.type === 'LOADING')?.address;
  const to = [...rows].reverse().find((s) => s.type === 'UNLOADING')?.address;
  const fromShort = from ? extractPostcodeCity(from) : '';
  const toShort = to ? extractPostcodeCity(to) : '';
  return [fromShort, toShort].filter(Boolean).join(' → ');
}

/**
 * Two-letter avatar fallback: first letter of firstName + first letter of
 * lastName. Falls back to a single letter when there is no lastName, then
 * to the email's first character, then to "?".
 */
export function initials(
  user:
    | {
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
      }
    | null
    | undefined,
): string {
  if (!user) return '?';
  const f = (user.firstName ?? '').trim();
  const l = (user.lastName ?? '').trim();
  const combined = (f.charAt(0) + l.charAt(0)).toUpperCase();
  if (combined) return combined;
  const email = (user.email ?? '').trim();
  return email.charAt(0).toUpperCase() || '?';
}
