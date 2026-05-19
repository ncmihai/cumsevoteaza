import * as cheerio from "cheerio";
import type { ChamberId, SourceSnapshot } from "@cumsevoteaza/parliament-model";
import { cleanText, slugify, snapshotFor } from "./utils";
import { legislatureFromFlag, normalize, partyFromText } from "./roster";

export interface WikipediaRosterRow {
  chamber: ChamberId;
  legislatureId: string;
  legislatureLabel: string;
  rowNumber?: number;
  displayName: string;
  normalizedName: string;
  constituency?: string;
  partyLabel?: string;
  partyId?: string;
  observation?: string;
  wikiProfileUrl?: string;
}

export interface WikipediaRosterPage {
  sourceSnapshot: SourceSnapshot;
  sourceUrl: string;
  legislatureId: string;
  legislatureLabel: string;
  rows: WikipediaRosterRow[];
  counts: Partial<Record<ChamberId, number>>;
}

export interface WikipediaRosterIndexLink {
  chamber: ChamberId;
  legislatureLabel: string;
  url: string;
  title: string;
}

export function parseWikipediaElectionRoster(
  html: string,
  sourceUrl: string,
  options: { legislature?: ReturnType<typeof legislatureFromFlag> } = {}
): WikipediaRosterPage {
  const legislature = options.legislature ?? legislatureFromUrlOrText(sourceUrl, html);
  const $ = cheerio.load(html);
  const rows: WikipediaRosterRow[] = [];
  const counts: Partial<Record<ChamberId, number>> = {};

  $(".mw-parser-output > p, .mw-parser-output p").each((_, paragraph) => {
    const text = cleanText($(paragraph).text());
    const chamber = chamberFromText(text);
    if (!chamber) return;
    const count = text.match(/\b(\d{2,3})\s+de\s+(?:deputați|senatori)\b/i)?.[1];
    if (count) counts[chamber] = Number(count);
  });

  $("table.wikitable").each((_, table) => {
    const headerCells = $(table)
      .find("tr")
      .first()
      .find("th")
      .map((__, cell) => normalize($(cell).text()))
      .get();
    const nameIndex = headerCells.findIndex((header) => header.includes("prenume") || header === "nume");
    const constituencyIndex = headerCells.findIndex((header) => header.includes("denumire") || header.includes("circumscript"));
    const partyIndex = headerCells.findIndex((header) => header.includes("grup") || header.includes("partid"));
    if (nameIndex < 0 || partyIndex < 0) return;

    const chamber = chamberForTable($, table);
    if (!chamber) return;

    $(table)
      .find("tr")
      .slice(1)
      .each((__, row) => {
        const cells = $(row).find("td");
        if (cells.length <= Math.max(nameIndex, partyIndex)) return;
        const numberText = cleanText($(cells[0]).text());
        const displayName = cleanText($(cells[nameIndex]).text().replace(/\[[^\]]+\]/g, ""));
        if (!displayName) return;
        const partyLabel = cleanText($(cells[partyIndex]).text().replace(/\[[^\]]+\]/g, ""));
        const party = partyLabel ? partyFromText(partyLabel) : undefined;
        const profileHref = $(cells[nameIndex]).find("a").first().attr("href");
        const observationIndex = headerCells.findIndex((header) => header.includes("observ"));
        rows.push({
          chamber,
          legislatureId: legislature.id,
          legislatureLabel: legislature.label,
          rowNumber: /^\d+$/.test(numberText) ? Number(numberText) : undefined,
          displayName,
          normalizedName: normalize(displayName),
          constituency: cleanConstituency(constituencyIndex >= 0 ? $(cells[constituencyIndex]).text() : undefined),
          partyLabel: partyLabel || undefined,
          partyId: party?.id,
          observation: observationIndex >= 0 ? cleanText($(cells[observationIndex]).text()) || undefined : undefined,
          wikiProfileUrl: profileHref ? absoluteWikipediaUrl(profileHref) : undefined
        });
      });
  });

  return {
    sourceSnapshot: snapshotFor("wikipedia-election-roster", sourceUrl, html, rows.length > 0 ? "parsed" : "partial"),
    sourceUrl,
    legislatureId: legislature.id,
    legislatureLabel: legislature.label,
    rows,
    counts
  };
}

export function parseWikipediaRosterIndex(html: string, sourceUrl: string, chamber: ChamberId): {
  sourceSnapshot: SourceSnapshot;
  links: WikipediaRosterIndexLink[];
} {
  const $ = cheerio.load(html);
  const links = new Map<string, WikipediaRosterIndexLink>();

  $("a[href]").each((_, anchor) => {
    const title = cleanText($(anchor).text());
    const href = $(anchor).attr("href");
    if (!href) return;
    const text = `${title} ${$(anchor).attr("title") ?? ""}`;
    const match = text.match(/Legislatura\s+(\d{4})[-–](\d{4})/i);
    if (!match || !text.toLowerCase().includes(chamber === "senate" ? "senat" : "camera deputa")) return;
    const label = `${match[1]}-${match[2]}`;
    const url = absoluteWikipediaUrl(href);
    links.set(`${chamber}-${label}-${url}`, {
      chamber,
      legislatureLabel: label,
      url,
      title: title || `Legislatura ${label}`
    });
  });

  return {
    sourceSnapshot: snapshotFor("wikipedia-roster-index", sourceUrl, html, links.size > 0 ? "parsed" : "partial"),
    links: [...links.values()].sort((a, b) => b.legislatureLabel.localeCompare(a.legislatureLabel))
  };
}

export function defaultWikipediaElectionRosterUrl(legislatureLabel: string): string | undefined {
  const year = legislatureLabel.slice(0, 4);
  if (!["2008", "2012", "2016", "2020", "2024"].includes(year)) return undefined;
  return `https://ro.wikipedia.org/wiki/Lista_parlamentarilor_aleși_la_alegerile_din_România_din_${year}`;
}

function chamberForTable($: cheerio.CheerioAPI, table: Parameters<cheerio.CheerioAPI>[0]): ChamberId | undefined {
  let previous = $(table).prev();
  for (let index = 0; index < 8 && previous.length > 0; index += 1) {
    const chamber = chamberFromText(cleanText(previous.text()));
    if (chamber) return chamber;
    previous = previous.prev();
  }
  return undefined;
}

function chamberFromText(text: string): ChamberId | undefined {
  const normalized = normalize(text);
  if (normalized.includes("deputat")) return "deputies";
  if (normalized.includes("senator")) return "senate";
  return undefined;
}

function cleanConstituency(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return cleanText(value)
    .replace(/^Județul\s+/i, "")
    .replace(/^Municipiul\s+/i, "Mun. ")
    .replace(/\[[^\]]+\]/g, "")
    .trim() || undefined;
}

function absoluteWikipediaUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  return `https://ro.wikipedia.org${href.startsWith("/") ? href : `/${href}`}`;
}

function legislatureFromUrlOrText(sourceUrl: string, html: string) {
  const match = decodeURIComponent(sourceUrl).match(/(?:din_|[, _])(\d{4})(?:\D|$)/);
  if (match?.[1]) return legislatureFromFlag(match[1]);
  const textMatch = html.match(/(\d{4})[–-](\d{4})/);
  if (textMatch?.[1] && textMatch?.[2]) return legislatureFromFlag(`${textMatch[1]}-${textMatch[2]}`);
  return legislatureFromFlag(undefined);
}
