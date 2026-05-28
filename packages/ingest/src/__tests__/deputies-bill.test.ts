import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanExtractedText, chunkText } from "../bill-text";
import { parseDeputiesBill } from "../parsers/deputies-bill";

describe("parseDeputiesBill", () => {
  it("extracts a structured CDEP dossier timeline and document kinds", () => {
    const html = readFileSync(path.join(__dirname, "../fixtures/deputies-bill-plx-158.html"), "utf8");
    const parsed = parseDeputiesBill(html, "https://www.cdep.ro/ords/pls/proiecte/upl_pck2015.proiect?idp=22820");

    expect(parsed.bill.identifiers.deputies).toBe("PL-x 158/2026");
    expect(parsed.bill.decisionChamber).toBe("deputies");
    expect(parsed.sponsors[0]).toEqual(expect.objectContaining({ sponsorType: "government", name: "Guvernul României" }));
    expect(parsed.procedureSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ occurredOn: "2026-03-04", stepType: "adopted_by_senate" }),
        expect.objectContaining({ occurredOn: "2026-03-09", stepType: "sent_to_committee" }),
        expect.objectContaining({ occurredOn: "2026-05-12", stepType: "committee_report_received" }),
        expect.objectContaining({ occurredOn: "2026-05-20", stepType: "final_vote" })
      ])
    );
    expect(parsed.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ documentKind: "proposal", officialUrlHash: expect.any(String) }),
        expect.objectContaining({ documentKind: "senate_adopted_form" }),
        expect.objectContaining({ documentKind: "committee_report" }),
        expect.objectContaining({ documentKind: "adopted_form" }),
        expect.objectContaining({ documentKind: "promulgation_form" })
      ])
    );
    expect(parsed.events.length).toBe(parsed.procedureSteps.length);
  });
});

describe("bill text helpers", () => {
  it("cleans and chunks extracted text deterministically", () => {
    const text = cleanExtractedText(" Art. 1  \n\n\n  Se completează legea.  ");
    expect(text).toBe("Art. 1\n\nSe completează legea.");
    expect(chunkText("abcdef", 2)).toEqual(["ab", "cd", "ef"]);
  });
});
