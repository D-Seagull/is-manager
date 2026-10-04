/**
 * Country + postcode out of a free-text stop address, for trip titles
 * ("DE 56727 → GB CB6 3NW"). Dispatchers type these many ways, often as a
 * region-only partial postcode, so all of these are understood:
 *
 *   DE 54126 · DE 56 · DE-56218 · DE56 · D56 · D-56 · DE-6   → DE …
 *   AT4816 · A-4816                                           → AT 4816
 *   pl 51-106 · PL-51-106                                     → PL 51-106
 *   GB-CB6 3NW · UK CB63NW · cb6-3nw · GB CB6                 → GB CB6 3NW / GB CB6
 *   "Some Street, 56727 Mayen" (no country)                   → 56727
 *
 * Output is always "<ISO-2> <postcode>" (old one-letter car codes like D / A
 * become DE / AT) so titles look the same whoever typed them.
 *
 * Same file in is-fleet-frontend and is-manager — keep them in sync.
 */

/** Codes accepted in front of a postcode → ISO 3166 alpha-2. */
const COUNTRY: Record<string, string> = {
  // Old international vehicle codes still common on CMRs.
  D: "DE", A: "AT", F: "FR", I: "IT", B: "BE", L: "LU", E: "ES", P: "PT",
  S: "SE", H: "HU", N: "NO", IRL: "IE", SLO: "SI", FIN: "FI", EST: "EE",
  UK: "GB", FL: "LI", MC: "MC", RSM: "SM", AND: "AD", BIH: "BA", MNE: "ME",
  SRB: "RS", UA: "UA",
  ...Object.fromEntries(
    (
      "AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT " +
      "LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS SE SI SK SM TR UA XK"
    )
      .split(" ")
      .map((c) => [c, c]),
  ),
};

// One-letter codes need a real postcode after them: "A4" / "B9" are roads.
const MIN_DIGITS_AFTER_ONE_LETTER = 2;

const GB_POSTCODE = /([A-Z]{1,2}\d[A-Z\d]?)(?:[\s-]*(\d[A-Z]{2}))?(?![A-Z\d])/iy;
// Irish Eircode: routing key (D02) + optional unique id (X285).
const IE_POSTCODE = /([A-Z]\d[\dW])(?:\s?([A-Z\d]{4}))?(?![A-Z\d])/iy;
const NL_POSTCODE = /(\d{4})\s?([A-Z]{2})(?![A-Z\d])/iy;
const PL_POSTCODE = /(\d{2}-\d{3})(?!\d)/y;
const PT_POSTCODE = /(\d{4}-\d{3})(?!\d)/y;
const DIGITS = /(\d{1,6})(?![\d])/y;

/** Postcode starting exactly at `at` in `text`, shaped for `iso`, and
 *  where it ends (so the search can continue after it). */
function postcodeAt(
  text: string,
  at: number,
  iso: string,
): { code: string; end: number } | null {
  const tryRe = (re: RegExp) => {
    re.lastIndex = at;
    return re.exec(text);
  };
  const shapes: [RegExp, (m: RegExpExecArray) => string][] = [];
  if (iso === "GB")
    shapes.push([GB_POSTCODE, (m) => (m[2] ? `${m[1]} ${m[2]}` : m[1])]);
  if (iso === "IE")
    shapes.push([IE_POSTCODE, (m) => (m[2] ? `${m[1]} ${m[2]}` : m[1])]);
  if (iso === "NL") shapes.push([NL_POSTCODE, (m) => `${m[1]} ${m[2]}`]);
  if (iso === "PL") shapes.push([PL_POSTCODE, (m) => m[1]]);
  if (iso === "PT") shapes.push([PT_POSTCODE, (m) => m[1]]);
  shapes.push([DIGITS, (m) => m[1]]);
  for (const [re, shape] of shapes) {
    const m = tryRe(re);
    if (m) return { code: shape(m).toUpperCase(), end: m.index + m[0].length };
  }
  return null;
}

/** "DE 56727" etc. — the LAST country-tagged postcode in the address. */
function withCountry(address: string): string | null {
  // A 1–3 letter word, then an optional space / dash, then the postcode.
  const token = /(?<![A-Za-z\d])([A-Za-z]{1,3})[\s-]?(?=[A-Za-z\d])/g;
  let found: string | null = null;
  for (let m = token.exec(address); m; m = token.exec(address)) {
    const iso = COUNTRY[m[1].toUpperCase()];
    if (!iso) continue;
    const hit = postcodeAt(address, m.index + m[0].length, iso);
    if (!hit) continue;
    if (
      m[1].length === 1 &&
      (hit.code.match(/\d/g)?.length ?? 0) < MIN_DIGITS_AFTER_ONE_LETTER
    )
      continue;
    // Later wins: a postcode follows the street ("Calle de 12…, ES-28001").
    found = `${iso} ${hit.code}`;
    // Don't re-read the postcode itself as a new country ("IRL D02" ≠ "D 02").
    token.lastIndex = hit.end;
  }
  return found;
}

/** A postcode with no country in front — full forms only, to avoid house numbers. */
function withoutCountry(address: string): string | null {
  const patterns: RegExp[] = [
    /\b(\d{2}-\d{3})\b/, // PL 51-106
    /\b([A-Z]{1,2}\d[A-Z\d]?)[\s-]*(\d[A-Z]{2})\b/i, // GB CB6 3NW / CB63NW
    /\b(\d{4,6})\b/, // DE / FR / AT … 56727
  ];
  for (const re of patterns) {
    const m = address.match(re);
    if (!m) continue;
    return (m[2] ? `${m[1]} ${m[2]}` : m[1]).toUpperCase();
  }
  return null;
}

export function extractPostcodeCity(address: string): string {
  const hit = withCountry(address) ?? withoutCountry(address);
  if (hit) return hit;
  // Nothing postcode-like: the last line / comma part, minus a country prefix.
  const parts = address
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const last = parts[parts.length - 1] ?? address;
  return last.replace(/^[a-z]{1,3}[-\s]/i, "").trim();
}
