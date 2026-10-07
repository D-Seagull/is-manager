import { describe, it, expect } from "vitest";
import { fullName, initials } from "@/lib/format";

describe("fullName", () => {
  it("joins first and last name", () => {
    expect(fullName({ firstName: "Dmytro", lastName: "Chaika" })).toBe("Dmytro Chaika");
  });
  it("drops a missing last name", () => {
    expect(fullName({ firstName: "Vasia", lastName: null })).toBe("Vasia");
  });
  it("returns empty string for null/undefined user", () => {
    expect(fullName(null)).toBe("");
    expect(fullName(undefined)).toBe("");
  });
});

describe("initials", () => {
  it("uses first letters of first and last name, uppercased", () => {
    expect(initials({ firstName: "Dmytro", lastName: "Chaika" })).toBe("DC");
  });
  it("falls back to a single letter when no last name", () => {
    expect(initials({ firstName: "Vasia", lastName: null })).toBe("V");
  });
  it("falls back to the email initial when no name", () => {
    expect(initials({ firstName: null, lastName: null, email: "a@b.com" })).toBe("A");
  });
  it("returns ? for a null user", () => {
    expect(initials(null)).toBe("?");
  });
});
