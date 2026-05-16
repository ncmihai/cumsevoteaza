import * as cheerio from "cheerio";
import type { Bill, BillEvent, BillSponsor, DocumentSource, SourceSnapshot } from "@cumsevoteaza/parliament-model";
import { cleanText, slugify, snapshotFor } from "./utils";
import {
  billIdForIdentifier,
  canonicalBillIdentifier,
  findOfficialIdentifiers,
  identifierRecord,
  normalizeOfficialIdentifier,
  yearFromUrl
} from "./identifiers";

export interface ParsedSenateBill {
  sourceSnapshot: SourceSnapshot;
  bill: Bill;
  events: BillEvent[];
  sponsors: BillSponsor[];
  documents: DocumentSource[];
}

export function parseSenateBill(html: string, sourceUrl: string): ParsedSenateBill {
  const $ = cheerio.load(html);
  const sourceSnapshot = snapshotFor("senate-bill", sourceUrl, html, "parsed");
  const allText = cleanText($("body").text());
  const fallbackYear = yearFromUrl(sourceUrl);
  const explicitSenate = normalizeOfficialIdentifier(fieldValue($, "Număr de înregistrare Senat"), fallbackYear);
  const explicitDeputies = normalizeOfficialIdentifier(fieldValue($, "Număr de înregistrare Camera Deputaților"), fallbackYear);
  const identifiers = [
    ...(explicitSenate ? [explicitSenate] : []),
    ...(explicitDeputies ? [explicitDeputies] : []),
    ...findOfficialIdentifiers(cleanText($(".lista-legis-panel-2 h4").first().text()), fallbackYear),
    ...findOfficialIdentifiers(cleanText($("#ctl00_B_Center_Lista_grdLista font").first().text()), fallbackYear),
    ...findOfficialIdentifiers(allText, fallbackYear)
  ];
  const canonical = canonicalBillIdentifier(identifiers) ?? normalizeOfficialIdentifier("unknown", fallbackYear);
  const canonicalValue = canonical?.value ?? "unknown";
  const slug = slugify(canonicalValue);
  const billId = canonical ? billIdForIdentifier(canonical) : `bill-${slug}`;
  const title = extractTitle($, canonicalValue);

  const documents: DocumentSource[] = $("a[href$='.pdf'], a[href*='.pdf?']")
    .toArray()
    .slice(0, 30)
    .map((node, index) => {
      const href = $(node).attr("href") ?? "";
      return {
        id: `doc-${billId}-${index + 1}`,
        billId,
        label: cleanText($(node).text()) || `Document ${index + 1}`,
        url: new URL(href.replace(/\\/g, "/"), sourceUrl).toString()
      };
    });

  const events: BillEvent[] = [];
  const registeredDate = inferDate(allText);
  if (/inregistrat|înregistrat/i.test(allText) && registeredDate) {
    events.push({
      id: `event-${billId}-registered`,
      billId,
      occurredOn: registeredDate,
      chamber: "senate",
      label: "Înregistrat la Senat pentru dezbatere",
      sourceUrl
    });
  }
  const adoptedDate = inferDateNear(allText, "adoptat");
  if (/adoptat[^.]+Senat/i.test(allText) && adoptedDate) {
    events.push({
      id: `event-${billId}-adopted-senate`,
      billId,
      occurredOn: adoptedDate,
      chamber: "senate",
      label: "Adoptat de Senat",
      sourceUrl
    });
  }
  const sentDeputiesDate = inferDateNear(allText, "Camera Deput");
  if (/Camera Deputa/i.test(allText) && sentDeputiesDate) {
    events.push({
      id: `event-${billId}-sent-deputies`,
      billId,
      occurredOn: sentDeputiesDate,
      chamber: "deputies",
      label: "Înregistrat sau transmis la Camera Deputaților",
      sourceUrl
    });
  }

  return {
    sourceSnapshot,
    bill: {
      id: billId,
      slug,
      title,
      identifiers: identifierRecord(identifiers.length > 0 ? identifiers : []),
      chamberOfOrigin: /Senat/i.test(allText) ? "senate" : "unknown",
      status: /adoptat/i.test(allText) ? "Adoptat" : "unknown",
      sourceSnapshotIds: [sourceSnapshot.id]
    },
    events,
    sponsors: [
      {
        id: `sponsor-${billId}-unknown`,
        billId,
        sponsorType: /Guvern/i.test(allText) ? "government" : "unknown",
        name: /Guvern/i.test(allText) ? "Guvernul României" : "Inițiator necunoscut"
      }
    ],
    documents
  };
}

function extractTitle($: cheerio.CheerioAPI, senateId: string): string {
  const detailTitle = cleanText($(".lista-legis-panel-2 h4").first().next("p").text());
  if (detailTitle.length > 80) return detailTitle;

  const boldCandidates = $("b")
    .toArray()
    .map((node) => cleanText($(node).text()))
    .filter((text) => text.length > 80 && !text.includes("__VIEWSTATE"));

  const headingCandidate = $("h5")
    .toArray()
    .map((node) => cleanText($(node).text()))
    .find((text) => text.length > 80);

  return headingCandidate ?? boldCandidates[0] ?? senateId;
}

function fieldValue($: cheerio.CheerioAPI, label: string): string | undefined {
  const normalizedLabel = normalize(label);
  let value: string | undefined;

  $("tr").each((_, row) => {
    const cells = $(row).find("td").toArray();
    if (cells.length < 2) return;
    if (normalize($(cells[0]).text()).includes(normalizedLabel)) {
      value = cleanText($(cells[1]).text());
    }
  });

  return value;
}

function normalize(value: string): string {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function inferDate(text: string): string | undefined {
  const match = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

function inferDateNear(text: string, marker: string): string | undefined {
  const index = text.toLowerCase().indexOf(marker.toLowerCase());
  if (index === -1) return inferDate(text);
  return inferDate(text.slice(Math.max(0, index - 200), index + 200));
}
