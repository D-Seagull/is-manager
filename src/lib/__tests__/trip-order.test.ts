import { describe, it, expect } from "vitest";
import { currentTrip } from "@/lib/trip-order";
import type { TripStatus } from "@/constants/trip-status";

type T = { id: string; status: TripStatus; createdAt: string };
const trip = (id: string, status: TripStatus, createdAt: string): T => ({
  id,
  status,
  createdAt,
});

describe("currentTrip", () => {
  it("returns null when there are no trips", () => {
    expect(currentTrip<T>([])).toBeNull();
  });

  it("returns null when every trip is delivered", () => {
    expect(
      currentTrip([
        trip("a", "DELIVERED", "2026-01-01"),
        trip("b", "DELIVERED", "2026-02-01"),
      ]),
    ).toBeNull();
  });

  it("picks the trip furthest along the progress ranking", () => {
    const res = currentTrip([
      trip("assigned", "ASSIGNED", "2026-01-01"),
      trip("loaded", "LOADED", "2026-03-01"),
      trip("onway", "ON_WAY", "2026-02-01"),
    ]);
    expect(res?.id).toBe("loaded");
  });

  it("breaks ties within a status by oldest createdAt first", () => {
    const res = currentTrip([
      trip("newer", "ON_WAY", "2026-05-02"),
      trip("older", "ON_WAY", "2026-05-01"),
    ]);
    expect(res?.id).toBe("older");
  });

  it("ignores delivered trips even when an open one is earlier in rank", () => {
    const res = currentTrip([
      trip("delivered", "DELIVERED", "2026-01-01"),
      trip("assigned", "ASSIGNED", "2026-06-01"),
    ]);
    expect(res?.id).toBe("assigned");
  });
});
