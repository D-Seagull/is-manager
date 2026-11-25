import { describe, expect, it, vi } from 'vitest';

// outbox.ts pulls in storage, the socket and the auth store; the dedupe helper
// needs none of them.
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('@/lib/socket', () => ({ getSocket: () => ({}) }));
vi.mock('@/store/auth', () => ({ useAuthStore: { getState: () => ({}) } }));

import { undeliveredItems, type OutboxItem } from '../outbox';

const ME = 'me';
const T0 = Date.parse('2026-11-25T10:00:00.000Z');
const at = (s: number) => new Date(T0 + s * 1000).toISOString();

function item(content: string, s: number, extra: Partial<OutboxItem> = {}): OutboxItem {
  return {
    clientId: `c-${content}-${s}`,
    kind: 'dm',
    scopeId: 'peer',
    userId: ME,
    content,
    replyToId: null,
    replyToDocumentId: null,
    createdAt: at(s),
    status: 'pending',
    ...extra,
  };
}
const saved = (content: string, s: number, senderId = ME, replyToId: string | null = null) => ({
  senderId,
  content,
  createdAt: at(s),
  replyToId,
  replyToDocumentId: null,
});

describe('undeliveredItems', () => {
  it('hides a pending item once its echo is in the list', () => {
    expect(undeliveredItems([item('hi', 0)], [saved('hi', 1)], ME)).toEqual([]);
  });

  it('tolerates a server clock slightly behind the phone', () => {
    expect(undeliveredItems([item('hi', 0)], [saved('hi', -20)], ME)).toEqual([]);
  });

  it('keeps it while nothing matching came back', () => {
    const a = item('hi', 0);
    expect(undeliveredItems([a], [saved('other', 1), saved('hi', 1, 'peer')], ME)).toEqual([a]);
  });

  it('does not match an old message with the same text', () => {
    const a = item('ok', 0);
    expect(undeliveredItems([a], [saved('ok', -300)], ME)).toEqual([a]);
  });

  it('one echo hides one item — two "ok" in a row', () => {
    const a = item('ok', 0);
    const b = item('ok', 2);
    expect(undeliveredItems([a, b], [saved('ok', 1)], ME)).toEqual([b]);
    expect(undeliveredItems([a, b], [saved('ok', 1), saved('ok', 3)], ME)).toEqual([]);
  });

  it('a different quote is a different message', () => {
    const a = item('yes', 0, { replyToId: 'm1' });
    expect(undeliveredItems([a], [saved('yes', 1)], ME)).toEqual([a]);
    expect(undeliveredItems([a], [saved('yes', 1, ME, 'm1')], ME)).toEqual([]);
  });

  it('never hides a refused item', () => {
    const a = item('hi', 0, { status: 'failed' });
    expect(undeliveredItems([a], [saved('hi', 1)], ME)).toEqual([a]);
  });
});
