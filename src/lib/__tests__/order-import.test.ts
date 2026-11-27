import { describe, it, expect } from "vitest";
import {
  draftToStops,
  emptyFinance,
  financePayload,
  financeToForm,
  hasFinance,
  screenshotName,
  serverMessage,
  uuidV4,
  type OrderDraft,
} from "@/lib/order-import";

const draft = (over: Partial<OrderDraft> = {}): OrderDraft => ({
  orderNumber: "FT26106759",
  notes: null,
  stops: [
    {
      type: "LOADING",
      name: null,
      address: "Thyssenkrupp Aerospace UK, GB-PR5 8AD Preston",
      ref: null,
      windowDate: "2026-11-23",
      windowStart: null,
      windowEnd: null,
      page: 1,
      needsReview: false,
      reviewNote: null,
    },
    {
      type: "WAYPOINT",
      name: "Prom",
      address: "Dover → Calais",
      ref: "80142298",
      windowDate: null,
      windowStart: null,
      windowEnd: null,
      page: 1,
      needsReview: true,
      reviewNote: "No date for the crossing",
    },
  ],
  finance: { freightRate: 1731.86, currency: "EUR", loadedKm: 1742, emptyKm: 224, tolls: 336 },
  warnings: [],
  isTransportOrder: true,
  ...over,
});

describe("draftToStops", () => {
  it("keeps what the order says and leaves the rest empty (no default window)", () => {
    const [load] = draftToStops(draft());
    expect(load).toMatchObject({
      type: "LOADING",
      windowDate: "2026-11-23",
      windowStart: "",
      windowEnd: "",
      coords: "",
      review: null,
    });
  });

  it("carries the review note and page of a flagged stop", () => {
    const [, ferry] = draftToStops(draft());
    expect(ferry).toMatchObject({
      name: "Prom",
      ref: "80142298",
      review: { note: "No date for the crossing", page: 1 },
    });
  });
});

describe("finance form", () => {
  it("round-trips the draft's numbers", () => {
    const form = financeToForm(draft().finance);
    expect(form).toEqual({
      freightRate: "1731.86",
      currency: "EUR",
      loadedKm: "1742",
      emptyKm: "224",
      tolls: "336",
    });
    expect(financePayload(form)).toEqual(draft().finance);
  });

  it("reads comma decimals and spaces, drops junk", () => {
    expect(
      financePayload({ freightRate: "1 451,30", currency: "eur", loadedKm: "1264.6", emptyKm: "abc", tolls: "-5" }),
    ).toEqual({ freightRate: 1451.3, currency: "EUR", loadedKm: 1265, emptyKm: null, tolls: null });
  });

  it("a currency alone is nothing to save", () => {
    expect(hasFinance(emptyFinance())).toBe(false);
    expect(hasFinance({ ...emptyFinance(), loadedKm: "10" })).toBe(true);
  });
});

describe("helpers", () => {
  it("serverMessage takes the server's text, first of a list, else the error's", () => {
    expect(serverMessage({ response: { data: { message: "Файл завеликий" } } })).toBe("Файл завеликий");
    expect(serverMessage({ response: { data: { message: ["first", "second"] } } })).toBe("first");
    expect(serverMessage(new Error("Network Error"))).toBe("Network Error");
  });

  it("uuidV4 is a v4 UUID (the server checks @IsUUID)", () => {
    expect(uuidV4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("names a clipboard screenshot readably", () => {
    expect(screenshotName(new Date("2026-11-26T10:05:09Z"))).toBe("screenshot-2026-11-26-10-05-09.jpg");
  });
});
