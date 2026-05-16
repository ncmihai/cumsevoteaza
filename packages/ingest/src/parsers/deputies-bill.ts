import * as cheerio from "cheerio";
import type { Bill, BillEvent, BillSponsor, DocumentSource, SourceSnapshot } from "@cumsevoteaza/parliament-model";
import { cleanText, slugify, snapshotFor } from "./utils";

export interface ParsedDeputiesBill {
  sourceSnapshot: SourceSnapshot;
  bill: Bill;
  events: BillEvent[];
  sponsors: BillSponsor[];
  documents: DocumentSource[];
}

export function parseDeputiesBill(html: string, sourceUrl: string): ParsedDeputiesBill {
  const $ = cheerio.load(html);
  const sourceSnapshot = snapshotFor("deputies-bill", sourceUrl, html, "parsed");
  const bodyText = cleanText($("body").text());
  const titleText = cleanText($("h1, h2, h3, h4").toArray().map((node) => $(node).text()).join(" "));
  const plx = normalizePlx(bodyText.match(/PL[-\s]*x\s*(?:nr\.\s*)?\d+\/(?:\d{2}\.\d{2}\.)?\d{4}/i)?.[0]) ?? idFromUrl(sourceUrl);
  const senateId = bodyText.match(/L\d+\/\d{4}/)?.[0];
  const billSlug = slugify(plx);
  const billId = `bill-${billSlug}`;
  const title = extractTitle($, titleText, plx);
  const events = extractEvents($, billId, sourceUrl);
  const documents = $("a[href$='.pdf'], a[href*='.pdf?']")
    .toArray()
    .slice(0, 40)
    .map((node, index) => ({
      id: `doc-${billId}-${index + 1}`,
      billId,
      label: cleanText($(node).text()) || `Document ${index + 1}`,
      url: new URL(($(node).attr("href") ?? "").replace(/\\/g, "/"), sourceUrl).toString()
    }));

  return {
    sourceSnapshot,
    bill: {
      id: billId,
      slug: billSlug,
      title,
      identifiers: {
        deputies: plx,
        ...(senateId ? { senate: senateId } : {})
      },
      chamberOfOrigin: bodyText.includes("Camera Deputa") ? "deputies" : "unknown",
      status: extractStatus(bodyText),
      sourceSnapshotIds: [sourceSnapshot.id]
    },
    events,
    sponsors: [
      {
        id: `sponsor-${billId}-primary`,
        billId,
        sponsorType: /Initiator:\s*Guvern|Iniţiator:\s*Guvern/i.test(bodyText) ? "government" : "unknown",
        name: sponsorName(bodyText)
      }
    ],
    documents
  };
}

function extractTitle($: cheerio.CheerioAPI, headingText: string, fallback: string): string {
  const heading = $("h4, h3, h2")
    .toArray()
    .map((node) => cleanText($(node).text()))
    .find((text) => text.length > 30 && /proiect|lege|propunere/i.test(text));
  if (heading) return heading;
  const match = headingText.match(/(?:Proiect|Propunere)[^.]{30,500}/i);
  return cleanText(match?.[0] ?? fallback);
}

function extractEvents($: cheerio.CheerioAPI, billId: string, sourceUrl: string): BillEvent[] {
  const rows: BillEvent[] = [];
  $("tr").each((_, row) => {
    const cells = $(row).find("td").toArray();
    const rowText = cleanText($(row).text());
    const date = inferDate(rowText);
    if (!date) return;
    const action = cleanText(cells.length > 1 ? $(cells[cells.length - 1]).text() : rowText);
    if (!action || action.length < 8) return;
    rows.push({
      id: `event-${billId}-${date}-${slugify(action).slice(0, 48)}`,
      billId,
      occurredOn: date,
      chamber: /Senat|SE\b/.test(rowText) ? "senate" : "deputies",
      label: action.slice(0, 500),
      sourceUrl
    });
  });
  return uniqueBy(rows, (event) => event.id).slice(0, 80);
}

function normalizePlx(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = cleanText(value).match(/PL[-\s]*x\s*(?:nr\.\s*)?(\d+)\/(?:\d{2}\.\d{2}\.)?(\d{4})/i);
  return match ? `PL-x ${match[1]}/${match[2]}` : undefined;
}

function idFromUrl(sourceUrl: string): string {
  const url = new URL(sourceUrl);
  const nr = url.searchParams.get("nr");
  const an = url.searchParams.get("an");
  const idp = url.searchParams.get("idp");
  if (nr && an) return `PL-x ${nr}/${an}`;
  return `PL-x idp-${idp ?? slugify(sourceUrl)}`;
}

function extractStatus(text: string): string {
  const match = text.match(/Stadiu:\s*([^|]{3,240})/i);
  return cleanText(match?.[1] ?? "unknown");
}

function sponsorName(text: string): string {
  if (/Initiator:\s*Guvern|Iniţiator:\s*Guvern/i.test(text)) return "Guvernul României";
  const match = text.match(/Initiator:\s*([^|]{3,160})|Iniţiator:\s*([^|]{3,160})/i);
  return cleanText(match?.[1] ?? match?.[2] ?? "Inițiator necunoscut");
}

function inferDate(text: string): string | undefined {
  const match = text.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
