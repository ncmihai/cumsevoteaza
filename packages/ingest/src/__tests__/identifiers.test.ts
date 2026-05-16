import { describe, expect, it } from "vitest";
import { canonicalBillIdentifier, findOfficialIdentifiers, identifierRecord, normalizeOfficialIdentifier } from "../parsers/identifiers";

describe("official identifier normalization", () => {
  it("normalizes Senate B, BP, L and Deputies identifiers", () => {
    expect(normalizeOfficialIdentifier("B286", 2026)?.value).toBe("B286/2026");
    expect(normalizeOfficialIdentifier("BP12/2025")?.value).toBe("BP12/2025");
    expect(normalizeOfficialIdentifier("L34/2025")?.value).toBe("L34/2025");
    expect(normalizeOfficialIdentifier("PLX6/2025")?.value).toBe("PL-x 6/2025");
    expect(normalizeOfficialIdentifier("PL-x 6/03.02.2025")?.value).toBe("PL-x 6/2025");
  });

  it("prefers established Senate L identifiers, then Deputies, then early Senate identifiers", () => {
    const identifiers = findOfficialIdentifiers("B45/2025 L34/2025 PLX6/2025");

    expect(canonicalBillIdentifier(identifiers)?.value).toBe("L34/2025");
    expect(identifierRecord(identifiers)).toMatchObject({
      senate: "L34/2025",
      senate_b: "B45/2025",
      senate_l: "L34/2025",
      deputies: "PL-x 6/2025"
    });
  });
});
