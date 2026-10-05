import { describe, it, expect } from "vitest";
import { extractPostcodeCity } from "@/lib/postcode";

// Same contract as is-fleet-frontend's copy — these tests also guard that the
// two duplicated files stay in sync.
describe("extractPostcodeCity", () => {
  it("keeps an explicit ISO country + postcode", () => {
    expect(extractPostcodeCity("DE 54126")).toBe("DE 54126");
  });

  it("normalises old one-letter car codes to ISO-2", () => {
    expect(extractPostcodeCity("AT4816")).toBe("AT 4816");
    expect(extractPostcodeCity("A-4816")).toBe("AT 4816");
  });

  it("handles Polish dash postcodes in any case", () => {
    expect(extractPostcodeCity("pl 51-106")).toBe("PL 51-106");
    expect(extractPostcodeCity("PL-51-106")).toBe("PL 51-106");
  });

  it("formats GB/UK postcodes to the canonical spaced form", () => {
    expect(extractPostcodeCity("GB-CB6 3NW")).toBe("GB CB6 3NW");
    expect(extractPostcodeCity("UK CB63NW")).toBe("GB CB6 3NW");
  });

  it("extracts a bare postcode from a free-text address with no country", () => {
    expect(extractPostcodeCity("Some Street, 56727 Mayen")).toBe("56727");
  });
});
