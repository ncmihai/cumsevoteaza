import { cleanText, slugify } from "./utils";

export type OfficialIdentifierKind = "senate" | "deputies";

export interface OfficialIdentifier {
  kind: OfficialIdentifierKind;
  value: string;
  prefix: "B" | "BP" | "L" | "PLX" | "PL-x";
  number: number;
  year: number;
}

const senatePattern = /\b(BP|B|L)\s*[-.]?\s*(\d+)(?:\s*\/\s*(\d{4}))?\b/i;
const deputiesPattern = /\bPL\s*[-.]?\s*x\s*(?:nr\.\s*)?(\d+)\s*\/\s*(?:(\d{2})[./-](\d{2})[./-])?(\d{4})\b/i;
const compactDeputiesPattern = /\bPLX\s*(\d+)\s*\/\s*(\d{4})\b/i;

export function normalizeOfficialIdentifier(value: string | undefined, fallbackYear?: number): OfficialIdentifier | undefined {
  if (!value) return undefined;
  const text = cleanText(value);
  const compactDeputies = text.match(compactDeputiesPattern);
  if (compactDeputies) {
    return {
      kind: "deputies",
      value: `PL-x ${Number(compactDeputies[1])}/${Number(compactDeputies[2])}`,
      prefix: "PL-x",
      number: Number(compactDeputies[1]),
      year: Number(compactDeputies[2])
    };
  }

  const deputies = text.match(deputiesPattern);
  if (deputies) {
    return {
      kind: "deputies",
      value: `PL-x ${Number(deputies[1])}/${Number(deputies[4])}`,
      prefix: "PL-x",
      number: Number(deputies[1]),
      year: Number(deputies[4])
    };
  }

  const senate = text.match(senatePattern);
  if (senate?.[1] && senate[2]) {
    const year = senate[3] ? Number(senate[3]) : fallbackYear;
    if (!year) return undefined;
    const prefix = senate[1].toUpperCase() as "B" | "BP" | "L";
    return {
      kind: "senate",
      value: `${prefix}${Number(senate[2])}/${year}`,
      prefix,
      number: Number(senate[2]),
      year
    };
  }

  return undefined;
}

export function findOfficialIdentifiers(text: string, fallbackYear?: number): OfficialIdentifier[] {
  const normalized = cleanText(text);
  const identifiers: OfficialIdentifier[] = [];

  for (const match of normalized.matchAll(new RegExp(senatePattern.source, "gi"))) {
    const identifier = normalizeOfficialIdentifier(match[0], fallbackYear);
    if (identifier) identifiers.push(identifier);
  }

  for (const match of normalized.matchAll(new RegExp(deputiesPattern.source, "gi"))) {
    const identifier = normalizeOfficialIdentifier(match[0], fallbackYear);
    if (identifier) identifiers.push(identifier);
  }

  for (const match of normalized.matchAll(new RegExp(compactDeputiesPattern.source, "gi"))) {
    const identifier = normalizeOfficialIdentifier(match[0], fallbackYear);
    if (identifier) identifiers.push(identifier);
  }

  return uniqueBy(identifiers, (identifier) => identifier.value);
}

export function canonicalBillIdentifier(identifiers: OfficialIdentifier[]): OfficialIdentifier | undefined {
  return (
    identifiers.find((identifier) => identifier.kind === "senate" && identifier.prefix === "L") ??
    identifiers.find((identifier) => identifier.kind === "deputies") ??
    identifiers.find((identifier) => identifier.kind === "senate" && identifier.prefix === "B") ??
    identifiers.find((identifier) => identifier.kind === "senate" && identifier.prefix === "BP") ??
    identifiers[0]
  );
}

export function billIdForIdentifier(identifier: OfficialIdentifier): string {
  return `bill-${slugify(identifier.value)}`;
}

export function identifierRecord(identifiers: OfficialIdentifier[]): Record<string, string> {
  const record: Record<string, string> = {};
  const senate = identifiers.filter((identifier) => identifier.kind === "senate");
  const deputies = identifiers.find((identifier) => identifier.kind === "deputies");
  const canonicalSenate = canonicalBillIdentifier(senate);
  if (canonicalSenate) record.senate = canonicalSenate.value;
  if (deputies) record.deputies = deputies.value;

  for (const identifier of senate) {
    const key = identifier.prefix.toLowerCase();
    record[`senate_${key}`] = identifier.value;
  }

  return record;
}

export function yearFromUrl(sourceUrl: string): number | undefined {
  const url = new URL(sourceUrl);
  const yearParam = url.searchParams.get("an_cls") ?? url.searchParams.get("AN") ?? url.searchParams.get("anp");
  return yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : undefined;
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
