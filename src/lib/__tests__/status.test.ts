import { describe, it, expect } from "vitest";
import { resolveDisplayStatus } from "@/lib/status";

describe("resolveDisplayStatus", () => {
  it("is OFFLINE when there is no live socket", () => {
    expect(resolveDisplayStatus({ status: "ONLINE" }, false)).toBe("OFFLINE");
  });

  it("is AWAY when offline but recently seen", () => {
    expect(resolveDisplayStatus({ status: "ONLINE" }, false, true)).toBe("AWAY");
  });

  it("shows ONLINE when connected and status is ONLINE", () => {
    expect(resolveDisplayStatus({ status: "ONLINE" }, true)).toBe("ONLINE");
  });

  it("keeps BUSY when connected and the timer has not expired", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(resolveDisplayStatus({ status: "BUSY", statusUntil: future }, true)).toBe("BUSY");
  });

  it("degrades an expired BUSY/SLEEP timer to ONLINE", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(resolveDisplayStatus({ status: "SLEEP", statusUntil: past }, true)).toBe("ONLINE");
  });

  it("defaults a null user to ONLINE when connected", () => {
    expect(resolveDisplayStatus(null, true)).toBe("ONLINE");
  });
});
