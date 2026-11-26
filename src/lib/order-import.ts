/**
 * "Fill from order" — the pure part, shared by the form and its tests.
 * Mirrors is-fleet-frontend (order-import.tsx / trip-finance.tsx / the
 * new-trip dialog): same draft shape, same rules.
 */
import type { StopType } from '@/lib/types';

/** One stop of the draft the server read from a transport order. */
export interface OrderDraftStop {
  type: StopType;
  name: string | null;
  address: string | null;
  ref: string | null;
  windowDate: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  /** 1-based PDF page the stop was read from. */
  page: number | null;
  needsReview: boolean;
  reviewNote: string | null;
}

/** Freight / km / tolls — managers only, never in the driver's notes. */
export interface OrderFinance {
  freightRate: number | null;
  currency: string | null;
  loadedKm: number | null;
  emptyKm: number | null;
  tolls: number | null;
}

export interface TripFinanceData extends OrderFinance {
  updatedAt: string;
}

/** Draft for the new-trip form — nothing is saved until the trip is created. */
export interface OrderDraft {
  orderNumber: string | null;
  notes: string | null;
  stops: OrderDraftStop[];
  finance: OrderFinance;
  warnings: string[];
  isTransportOrder: boolean;
}

export interface TripOrderFile {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  url: string | null;
}

/** A local file picked on the phone (camera, gallery, files, clipboard). */
export interface OrderLocalFile {
  uri: string;
  name: string;
  mimeType: string;
}

/** What the draft was read from. */
export type OrderSourceInput = { file: OrderLocalFile } | { text: string };

/** A form row (same fields as the trip form's StopRowData) + review info. */
export interface DraftStopRow {
  type: StopType;
  name: string;
  address: string;
  ref: string;
  coords: string;
  windowDate: string;
  windowStart: string;
  windowEnd: string;
  review: { note: string | null; page: number | null } | null;
}

/**
 * Draft stops → form rows. What the order does not say stays EMPTY — no
 * default date or 08:00–16:00 window, or the manager could take an
 * invented time for a real one.
 */
export function draftToStops(draft: OrderDraft): DraftStopRow[] {
  return draft.stops.map((s) => ({
    type: s.type,
    name: s.name ?? '',
    address: s.address ?? '',
    ref: s.ref ?? '',
    coords: '',
    windowDate: s.windowDate ?? '',
    windowStart: s.windowStart ?? '',
    windowEnd: s.windowEnd ?? '',
    review: s.needsReview ? { note: s.reviewNote, page: s.page } : null,
  }));
}

/** The form keeps strings (what the inputs hold); the API takes numbers / null. */
export interface FinanceFormData {
  freightRate: string;
  currency: string;
  loadedKm: string;
  emptyKm: string;
  tolls: string;
}

export const emptyFinance = (): FinanceFormData => ({
  freightRate: '',
  currency: 'EUR',
  loadedKm: '',
  emptyKm: '',
  tolls: '',
});

const str = (v: number | null | undefined) =>
  v === null || v === undefined ? '' : String(v);

export function financeToForm(f: OrderFinance | null | undefined): FinanceFormData {
  return {
    freightRate: str(f?.freightRate),
    currency: f?.currency || 'EUR',
    loadedKm: str(f?.loadedKm),
    emptyKm: str(f?.emptyKm),
    tolls: str(f?.tolls),
  };
}

/** "1 451,30" / "1451.30" → 1451.3; blank or junk → null. */
function num(v: string, whole = false): number | null {
  const clean = v.replace(/\s/g, '').replace(',', '.');
  if (!clean) return null;
  const n = Number(clean);
  if (!Number.isFinite(n) || n < 0) return null;
  return whole ? Math.round(n) : Math.round(n * 100) / 100;
}

export function financePayload(f: FinanceFormData): OrderFinance {
  const currency = f.currency.trim().toUpperCase();
  return {
    freightRate: num(f.freightRate),
    currency: /^[A-Z]{3}$/.test(currency) ? currency : null,
    loadedKm: num(f.loadedKm, true),
    emptyKm: num(f.emptyKm, true),
    tolls: num(f.tolls),
  };
}

/** Anything worth saving (a currency alone is not). */
export function hasFinance(f: FinanceFormData): boolean {
  const p = financePayload(f);
  return [p.freightRate, p.loadedKm, p.emptyKm, p.tolls].some((v) => v !== null);
}

/** "1 451,30 EUR · 1264 km + 240 empty · tolls 368,42" — parts as plain data. */
export function financeSummaryParts(
  f: OrderFinance,
  locale: string,
): { rate: string | null; loadedKm: number | null; emptyKm: number | null; tolls: string | null } {
  const money = (v: number) =>
    v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return {
    rate: f.freightRate === null ? null : `${money(f.freightRate)} ${f.currency ?? ''}`.trim(),
    loadedKm: f.loadedKm,
    emptyKm: f.emptyKm,
    tolls: f.tolls === null ? null : money(f.tolls),
  };
}

/** The server's own (translated) error text, when it sent one. */
export function serverMessage(err: unknown): string | null {
  const data = (err as { response?: { data?: { message?: unknown } } } | null)?.response?.data;
  const message = data?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  return (err as Error | null)?.message || null;
}

/** RFC 4122 v4 id for the create's import key (no crypto.randomUUID on Hermes). */
export function uuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Clipboard screenshots / photos get a readable name for the stored order file. */
export function screenshotName(now = new Date(), ext = 'jpg'): string {
  return `screenshot-${now.toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;
}
