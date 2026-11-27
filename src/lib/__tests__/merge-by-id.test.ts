import { describe, it, expect } from "vitest";
import { mergeById } from "@/lib/merge-by-id";

const m = (id: string, at: string, extra: object = {}) => ({ id, createdAt: at, ...extra });

describe("mergeById", () => {
  it("adds missed rows once, keeps older pages, fresh copy wins, sorted", () => {
    const prev = [m("a", "2026-01-01T10:00:00Z"), m("b", "2026-01-01T11:00:00Z", { isRead: false })];
    const fresh = [m("b", "2026-01-01T11:00:00Z", { isRead: true }), m("c", "2026-01-01T12:00:00Z")];
    const out = mergeById(prev, fresh);
    expect(out.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(out[1]).toMatchObject({ isRead: true });
    expect(mergeById(out, fresh)).toHaveLength(3);
  });

  it("returns the fresh page when nothing is cached yet", () => {
    const fresh = [m("x", "2026-01-01T10:00:00Z")];
    expect(mergeById(undefined, fresh)).toBe(fresh);
  });
});
