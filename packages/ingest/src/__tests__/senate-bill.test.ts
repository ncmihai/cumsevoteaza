import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSenateBill } from "../parsers/senate-bill";

describe("parseSenateBill", () => {
  it("extracts bill identifiers, sponsor, events, and documents", () => {
    const html = readFileSync(path.join(__dirname, "../fixtures/senate-bill-l316.html"), "utf8");
    const parsed = parseSenateBill(html, "https://www.senat.ro/Legis/Lista.aspx?cod=27035");

    expect(parsed.bill.identifiers.senate).toBe("L316/2025");
    expect(parsed.bill.identifiers.deputies).toBe("PL-x 429/2025");
    expect(parsed.sponsors[0]?.sponsorType).toBe("government");
    expect(parsed.events.length).toBeGreaterThan(0);
    expect(parsed.documents[0]?.url).toContain("25L316FS.pdf");
  });
});
