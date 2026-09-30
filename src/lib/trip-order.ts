import type { Trip } from '@/lib/types';

/**
 * Which open trip of a truck is the one in progress — mirrors the backend's
 * `trip-order.ts`: furthest along first, then the OLDEST within a status
 * (loads are done in the order given). Every other open trip is "queued"
 * (listed under В черзі; its chat can still be opened).
 */
const PROGRESS_RANK: Record<string, number> = {
  LOADED: 5,
  ON_SITE: 4,
  ON_WAY: 3,
  ACCEPTED: 2,
  ASSIGNED: 1,
};

export function currentTrip<T extends Pick<Trip, 'status' | 'createdAt'>>(
  trips: T[],
): T | null {
  const open = trips.filter((tr) => tr.status !== 'DELIVERED');
  open.sort((a, b) => {
    const byStatus =
      (PROGRESS_RANK[b.status] ?? 0) - (PROGRESS_RANK[a.status] ?? 0);
    if (byStatus !== 0) return byStatus;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  return open[0] ?? null;
}
