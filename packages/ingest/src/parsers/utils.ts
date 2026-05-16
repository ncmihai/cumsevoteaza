import { createHash } from "node:crypto";
import type { SourceSnapshot, SourceStatus } from "@cumsevoteaza/parliament-model";

export const parserVersion = "0.1.0";

export function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function snapshotFor(
  parser: string,
  sourceUrl: string,
  html: string,
  status: SourceStatus,
  notes?: string
): SourceSnapshot {
  const contentHash = hashContent(html);
  return {
    id: `source-${parser}-${contentHash.slice(0, 12)}`,
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    contentHash,
    parser,
    parserVersion,
    status,
    notes
  };
}

export function parseCount(value: string | undefined): number {
  if (!value) return 0;
  const match = value.replace(/\s+/g, "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export function slugify(value: string): string {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function titleCase(value: string): string {
  return cleanText(value.toLocaleLowerCase("ro-RO")).replace(/(^|\s|-)\S/g, (letter) =>
    letter.toLocaleUpperCase("ro-RO")
  );
}
