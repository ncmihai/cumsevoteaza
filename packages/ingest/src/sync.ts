import * as cheerio from "cheerio";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { createDbSession } from "@cumsevoteaza/db";
import * as schema from "@cumsevoteaza/db";
import type { ChamberId, SourceSnapshot, SourceStatus } from "@cumsevoteaza/parliament-model";
import { fetchOfficialSource } from "./fetch-source";
import { parseChamberNominalVote } from "./parsers/chamber-vote";
import { parseDeputiesBill } from "./parsers/deputies-bill";
import { parseSenateBill } from "./parsers/senate-bill";
import { parseSenateVote } from "./parsers/senate-vote";
import { cleanText, hashContent, slugify, snapshotFor } from "./parsers/utils";
import { findOfficialIdentifiers, normalizeOfficialIdentifier } from "./parsers/identifiers";
import { persistChamberVote, persistDeputiesBill, persistSenateBill, persistSenateVote } from "./persist";
import { canonicalizeOfficialUrl } from "./official-urls";

export type DiscoveryKind = "bill" | "vote";
export type DiscoveryStatus = "pending" | "imported" | "partial" | "failed" | "skipped";

export interface SourceDiscoveryInput {
  chamber: ChamberId;
  kind: DiscoveryKind;
  sourceUrl: string;
  officialId?: string;
  title?: string;
  discoveredOn?: string;
  sourceSnapshotId?: string;
}

interface DeputiesYearlyList {
  expectedCount?: number;
  discoveries: SourceDiscoveryInput[];
}

export interface SyncOptions {
  years?: number[];
  maxImports?: number;
  maxRetries?: number;
  discoveryLimit?: number;
  chamber?: ChamberId;
  kind?: DiscoveryKind;
  deputiesVoteDates?: string[];
  deputiesVoteMonths?: number[];
  senateFrom?: number;
  senateTo?: number;
  senatePrefixes?: Array<"B" | "BP" | "L" | "PLX">;
}

export interface SyncSummary {
  runId?: string;
  discovered: number;
  imported: number;
  partial: number;
  failed: number;
  skipped: number;
  expected?: number;
  errors: string[];
}

const defaultYears = yearsSince2024();

export async function discoverSenateSources(options: SyncOptions = {}): Promise<SyncSummary> {
  const summary = await discoverSources("senate", senateSeedUrls(options.years ?? defaultYears), options);
  if (options.senateFrom && options.senateTo) {
    addSummary(
      summary,
      await discoverGeneratedSenateBills(
        options.years ?? defaultYears,
        options.senateFrom,
        options.senateTo,
        options.senatePrefixes ?? ["L"]
      )
    );
  }
  return summary;
}

export async function discoverDeputiesSources(options: SyncOptions = {}): Promise<SyncSummary> {
  return discoverDeputiesYearlyLists(options.years ?? defaultYears, options);
}

export async function discoverDeputiesVoteSources(options: SyncOptions = {}): Promise<SyncSummary> {
  const years = options.years ?? defaultYears;
  const dates = options.deputiesVoteDates ?? (await discoverDeputiesVoteDates(years, options));
  return discoverSources("deputies", deputiesVoteListUrls(dates), options);
}

export async function runDailySync(options: SyncOptions = {}): Promise<SyncSummary> {
  const run = await startIngestionRun("daily-sync");
  const summary: SyncSummary = { runId: run.id, discovered: 0, imported: 0, partial: 0, failed: 0, skipped: 0, errors: [] };
  try {
    const years = options.years ?? [new Date().getUTCFullYear()];
    const senate = await discoverSenateSources({ ...options, years });
    const deputies = await discoverDeputiesSources({ ...options, years });
    addSummary(summary, senate);
    addSummary(summary, deputies);
    addSummary(summary, await importPendingDiscoveries({ maxImports: options.maxImports ?? 30, maxRetries: options.maxRetries ?? 4 }));
    await finishIngestionRun(run.id, statusFromSummary(summary), summary);
    return summary;
  } catch (error) {
    const message = errorMessage(error);
    summary.errors.push(message);
    await finishIngestionRun(run.id, "failed", summary, message);
    return summary;
  }
}

export async function runBackfill2024(options: SyncOptions = {}): Promise<SyncSummary> {
  const run = await startIngestionRun("backfill-2024-present");
  const summary: SyncSummary = { runId: run.id, discovered: 0, imported: 0, partial: 0, failed: 0, skipped: 0, errors: [] };
  try {
    const years = options.years ?? defaultYears;
    addSummary(summary, await discoverSenateSources({ ...options, years }));
    addSummary(summary, await discoverDeputiesSources({ ...options, years }));
    addSummary(summary, await importPendingDiscoveries({ maxImports: options.maxImports ?? 100, maxRetries: options.maxRetries ?? 4 }));
    await finishIngestionRun(run.id, statusFromSummary(summary), summary);
    return summary;
  } catch (error) {
    const message = errorMessage(error);
    summary.errors.push(message);
    await finishIngestionRun(run.id, "failed", summary, message);
    return summary;
  }
}

export async function importPendingDiscoveries(options: SyncOptions = {}): Promise<SyncSummary> {
  const session = createDbSession();
  const summary: SyncSummary = { discovered: 0, imported: 0, partial: 0, failed: 0, skipped: 0, errors: [] };
  try {
    const maxImports = options.maxImports ?? 30;
    const maxRetries = options.maxRetries ?? 4;
    const filters = [
      inArray(schema.sourceDiscoveries.status, ["pending", "partial", "failed"]),
      options.chamber ? eq(schema.sourceDiscoveries.chamber, options.chamber) : undefined,
      options.kind ? eq(schema.sourceDiscoveries.kind, options.kind) : undefined
    ].filter((filter): filter is Exclude<typeof filter, undefined> => Boolean(filter));
    const rows = await session.db
      .select()
      .from(schema.sourceDiscoveries)
      .where(and(...filters))
      .orderBy(asc(schema.sourceDiscoveries.failureCount), desc(schema.sourceDiscoveries.lastSeenAt))
      .limit(maxImports);

    for (const row of rows.filter((item) => item.failureCount < maxRetries)) {
      const result = await importDiscovery(row);
      summary[result] += 1;
    }
    summary.skipped += rows.filter((item) => item.failureCount >= maxRetries).length;
    return summary;
  } finally {
    await session.close();
  }
}

async function discoverSources(chamber: ChamberId, seedUrls: string[], options: SyncOptions): Promise<SyncSummary> {
  const session = createDbSession();
  const summary: SyncSummary = { discovered: 0, imported: 0, partial: 0, failed: 0, skipped: 0, errors: [] };
  try {
    const limit = options.discoveryLimit ?? seedUrls.length;
    for (const url of seedUrls.slice(0, limit)) {
      try {
        const html = await fetchOfficialSource(url, 3);
        const snapshot = snapshotFor(`${chamber}-discovery`, url, html, "parsed");
        await upsertSourceSnapshot(session.db, snapshot);
        const discoveries = discoverOfficialLinks(html, url, chamber, snapshot.id);
        for (const discovery of discoveries) {
          await upsertSourceDiscovery(session.db, discovery);
        }
        summary.discovered += discoveries.length;
      } catch (error) {
        const message = errorMessage(error);
        summary.failed += 1;
        summary.errors.push(`${url}: ${message}`);
      }
    }
    return summary;
  } finally {
    await session.close();
  }
}

async function discoverDeputiesYearlyLists(years: number[], options: SyncOptions): Promise<SyncSummary> {
  const session = createDbSession();
  const summary: SyncSummary = { discovered: 0, imported: 0, partial: 0, failed: 0, skipped: 0, expected: 0, errors: [] };
  try {
    const seedUrls = deputiesSeedUrls(years);
    const limit = options.discoveryLimit ?? seedUrls.length;
    for (const url of seedUrls.slice(0, limit)) {
      try {
        const html = await fetchOfficialSource(url, 3);
        const parsed = parseDeputiesYearlyList(html, url);
        const status = parsed.expectedCount || parsed.discoveries.length > 0 ? "parsed" : "failed";
        const notes = status === "failed" ? "No Deputies yearly-list rows detected; official endpoint may be unavailable from this runtime." : undefined;
        const snapshot = snapshotFor("deputies-yearly-list", url, html, status, notes);
        await upsertSourceSnapshot(session.db, snapshot);
        const discoveries = parsed.discoveries.map((discovery) => ({ ...discovery, sourceSnapshotId: snapshot.id }));
        for (const discovery of parsed.discoveries) {
          await upsertSourceDiscovery(session.db, { ...discovery, sourceSnapshotId: snapshot.id });
        }
        summary.discovered += discoveries.length;
        summary.expected = (summary.expected ?? 0) + (parsed.expectedCount ?? 0);
        if (status === "failed") summary.failed += 1;
      } catch (error) {
        const message = errorMessage(error);
        summary.failed += 1;
        summary.errors.push(`${url}: ${message}`);
      }
    }
    return summary;
  } finally {
    await session.close();
  }
}

async function importDiscovery(row: typeof schema.sourceDiscoveries.$inferSelect): Promise<"imported" | "partial" | "failed" | "skipped"> {
  const session = createDbSession();
  const attemptedAt = new Date();
  try {
    await session.db
      .update(schema.sourceDiscoveries)
      .set({ lastAttemptAt: attemptedAt })
      .where(eq(schema.sourceDiscoveries.id, row.id));
  } finally {
    await session.close();
  }

  try {
    const importUrl = canonicalizeOfficialUrl(row.sourceUrl);
    const html = await fetchOfficialSource(importUrl, 3);
    const nested = discoverOfficialLinks(html, importUrl, row.chamber, row.sourceSnapshotId ?? undefined);

    if (row.kind === "bill" && row.chamber === "senate") {
      const parsed = parseSenateBill(html, importUrl);
      await persistSenateBill(parsed);
      await saveNestedDiscoveries(nested, parsed.sourceSnapshot.id);
      await saveNestedDiscoveries(parsed.discoveredSources, parsed.sourceSnapshot.id);
      await markDiscovery(row.id, "imported", parsed.sourceSnapshot.id);
      return "imported";
    }

    if (row.kind === "bill" && row.chamber === "deputies") {
      const parsed = parseDeputiesBill(html, importUrl);
      await persistDeputiesBill(parsed);
      await saveNestedDiscoveries(nested, parsed.sourceSnapshot.id);
      await markDiscovery(row.id, "imported", parsed.sourceSnapshot.id);
      return "imported";
    }

    if (row.kind === "vote" && row.chamber === "senate") {
      const parsed = parseSenateVote(html, importUrl);
      await persistSenateVote(parsed);
      await markDiscovery(row.id, parsed.sourceSnapshot.status === "parsed" ? "imported" : "partial", parsed.sourceSnapshot.id);
      return parsed.sourceSnapshot.status === "parsed" ? "imported" : "partial";
    }

    if (row.kind === "vote" && row.chamber === "deputies") {
      const parsed = parseChamberNominalVote(html, importUrl);
      await persistChamberVote(parsed);
      const status = parsed.sourceSnapshot.status === "parsed" ? "imported" : parsed.sourceSnapshot.status;
      await markDiscovery(row.id, status, parsed.sourceSnapshot.id);
      return status;
    }

    await markDiscovery(row.id, "skipped");
    return "skipped";
  } catch (error) {
    await markDiscovery(row.id, "failed", undefined, errorMessage(error));
    return "failed";
  }
}

export function discoverOfficialLinks(
  html: string,
  sourceUrl: string,
  chamber: ChamberId,
  sourceSnapshotId?: string
): SourceDiscoveryInput[] {
  const $ = cheerio.load(html);
  const discoveries: SourceDiscoveryInput[] = [];
  const canonicalSourceUrl = canonicalizeOfficialUrl(sourceUrl);

  $("a[href]").each((_, node) => {
    const href = $(node).attr("href");
    if (!href || href.startsWith("javascript:") || href.trim().startsWith("#")) return;
    const absoluteUrl = canonicalizeOfficialUrl(new URL(href.replace(/\\/g, "/"), sourceUrl).toString());
    if (absoluteUrl === canonicalSourceUrl || isSameDocumentAnchor(absoluteUrl, canonicalSourceUrl)) return;
    const text = cleanText($(node).text());
    const rowText = cleanText($(node).closest("tr").text()) || text;
    const kind = kindFromUrl(absoluteUrl);
    if (!kind) return;
    const inferredChamber = chamberFromUrl(absoluteUrl) ?? chamber;
    discoveries.push({
      chamber: inferredChamber,
      kind,
      sourceUrl: absoluteUrl,
      officialId: officialIdFromText(rowText, absoluteUrl, kind),
      title: titleFromRow(rowText, text),
      discoveredOn: dateFromText(rowText),
      sourceSnapshotId
    });
  });

  return uniqueBy(discoveries, (discovery) => discovery.sourceUrl);
}

function isSameDocumentAnchor(candidateUrl: string, sourceUrl: string): boolean {
  const candidate = new URL(candidateUrl);
  const source = new URL(sourceUrl);
  return Boolean(candidate.hash) && candidate.origin === source.origin && candidate.pathname === source.pathname && candidate.search === source.search;
}

export function parseDeputiesYearlyList(html: string, sourceUrl: string, sourceSnapshotId?: string): DeputiesYearlyList {
  const $ = cheerio.load(html);
  const bodyText = cleanText($("body").text());
  const expectedCount = Number(bodyText.match(/Num[aă]r\s+înregistr[aă]ri\s+g[aă]site:\s*(\d+)/i)?.[1] ?? "") || undefined;
  const discoveries: SourceDiscoveryInput[] = [];

  $("tr").each((_, row) => {
    const rowText = cleanText($(row).text());
    const identifier = findOfficialIdentifiers(rowText).find((item) => item.kind === "deputies");
    if (!identifier) return;
    const detailHref = $(row)
      .find("a[href*='upl_pck2015.proiect']")
      .toArray()
      .map((node) => $(node).attr("href"))
      .find(Boolean);
    if (!detailHref) return;

    discoveries.push({
      chamber: "deputies",
      kind: "bill",
      sourceUrl: new URL(detailHref.replace(/\\/g, "/"), sourceUrl).toString(),
      officialId: identifier.value,
      title: deputiesTitleFromRow(rowText, identifier.value),
      discoveredOn: dateFromText(rowText),
      sourceSnapshotId
    });
  });

  return {
    expectedCount,
    discoveries: uniqueBy(discoveries, (discovery) => discovery.sourceUrl)
  };
}

function kindFromUrl(url: string): DiscoveryKind | undefined {
  if (/senat\.ro\/Legis\/Lista\.aspx\?cod=\d+/i.test(url)) return "bill";
  if (/senat\.ro\/legis\/lista\.aspx/i.test(url) && /[?&]nr_cls=(?:BP|B|L|PLX)\d+/i.test(url) && /[?&]an_cls=\d{4}/i.test(url)) {
    return "bill";
  }
  if (/cdep\.ro\/(?:ords\/)?pls\/proiecte\/upl_pck2015\.proiect/i.test(url)) return "bill";
  if (/senat\.ro\/VoturiPlenDetaliu\.aspx/i.test(url)) return "vote";
  if (/cdep\.ro\/(?:ords\/)?pls\/steno\/evot2015\.Nominal/i.test(url)) return "vote";
  return undefined;
}

function chamberFromUrl(url: string): ChamberId | undefined {
  if (/senat\.ro/i.test(url)) return "senate";
  if (/cdep\.ro/i.test(url)) return "deputies";
  return undefined;
}

function senateSeedUrls(years: number[]): string[] {
  return uniqueBy(
    [
      "https://www.senat.ro/Legis/Lista.aspx",
      ...years.flatMap((year) => [
        `https://www.senat.ro/Legis/Lista.aspx?an_cls=${year}`,
        `https://www.senat.ro/Legis/Lista.aspx?nr_cls=&an_cls=${year}`
      ])
    ],
    (url) => url
  );
}

async function discoverGeneratedSenateBills(
  years: number[],
  from: number,
  to: number,
  prefixes: Array<"B" | "BP" | "L" | "PLX">
): Promise<SyncSummary> {
  const session = createDbSession();
  const summary: SyncSummary = { discovered: 0, imported: 0, partial: 0, failed: 0, skipped: 0, errors: [] };
  const start = Math.max(1, Math.min(from, to));
  const end = Math.max(from, to);
  try {
    for (const year of years) {
      for (const prefix of prefixes) {
        for (let number = start; number <= end; number += 1) {
          const displayPrefix = prefix === "PLX" ? "PLX" : prefix;
          await upsertSourceDiscovery(session.db, {
            chamber: "senate",
            kind: "bill",
            sourceUrl: `https://www.senat.ro/legis/lista.aspx?an_cls=${year}&nr_cls=${displayPrefix}${number}`,
            officialId: `${displayPrefix}${number}/${year}`,
            title: `Senate bill candidate ${displayPrefix}${number}/${year}`
          });
          summary.discovered += 1;
        }
      }
    }
    return summary;
  } finally {
    await session.close();
  }
}

function deputiesSeedUrls(years: number[]): string[] {
  return years.map((year) => `https://www.cdep.ro/pls/proiecte/upl_pck2015.lista?anp=${year}`);
}

async function discoverDeputiesVoteDates(years: number[], options: SyncOptions): Promise<string[]> {
  const dates = new Set<string>();
  const months = options.deputiesVoteMonths ?? Array.from({ length: 12 }, (_, index) => index + 1);
  for (const year of years) {
    for (const month of months) {
      const html = await fetchOfficialSource(`https://www.cdep.ro/ords/pls/steno/evot2015.zile_vot?lu=${month}&an=${year}`, 3);
      for (const match of html.matchAll(/\b(20\d{6})\b/g)) {
        dates.add(match[1]!);
      }
    }
  }
  return [...dates].sort();
}

function deputiesVoteListUrls(dates: string[]): string[] {
  return dates.map((date) => `https://www.cdep.ro/ords/pls/steno/evot2015.data?dat=${date}&cam=2&idl=1`);
}

function deputiesTitleFromRow(rowText: string, identifier: string): string | undefined {
  const withoutIndex = rowText.replace(/^\d+\.\s*/, "");
  const afterIdentifier = withoutIndex.slice(withoutIndex.indexOf(identifier) + identifier.length);
  const title = cleanText(afterIdentifier.replace(/\b(?:Lege|la comisii|la Senat|pe ordinea de zi|procedura legislativa încetata)\b.*$/i, ""));
  return title.length > 8 ? title.slice(0, 500) : undefined;
}

function officialIdFromText(text: string, sourceUrl: string, kind?: DiscoveryKind): string | undefined {
  const year = yearFromUrlParam(sourceUrl);
  const url = new URL(sourceUrl);
  const voteId = url.searchParams.get("idv");
  if (kind === "vote" && voteId) return voteId;
  const identifier = findOfficialIdentifiers(text, year)[0];
  if (identifier) return identifier.value;
  const nrCls = url.searchParams.get("nr_cls") ?? url.searchParams.get("NR");
  const urlIdentifier = normalizeOfficialIdentifier(nrCls ?? undefined, year);
  return urlIdentifier?.value ?? url.searchParams.get("cod") ?? url.searchParams.get("idp") ?? voteId ?? undefined;
}

function titleFromRow(rowText: string, linkText: string): string | undefined {
  const title = cleanText(rowText.replace(/^\d+\.\s*/, ""));
  if (title.length > 12) return title.slice(0, 500);
  return linkText || undefined;
}

function dateFromText(text: string): string | undefined {
  const match = text.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

function yearFromUrlParam(sourceUrl: string): number | undefined {
  const url = new URL(sourceUrl);
  const value = url.searchParams.get("an_cls") ?? url.searchParams.get("AN") ?? url.searchParams.get("anp");
  return value && /^\d{4}$/.test(value) ? Number(value) : undefined;
}

async function saveNestedDiscoveries(discoveries: SourceDiscoveryInput[], sourceSnapshotId: string) {
  if (discoveries.length === 0) return;
  const session = createDbSession();
  try {
    for (const discovery of discoveries) {
      await upsertSourceDiscovery(session.db, { ...discovery, sourceSnapshotId });
    }
  } finally {
    await session.close();
  }
}

async function startIngestionRun(kind: string) {
  const session = createDbSession();
  const id = `run-${slugify(kind)}-${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await session.db.insert(schema.ingestionRuns).values({
      id,
      kind,
      status: "running",
      startedAt: new Date(),
      summary: {}
    });
    return { id };
  } finally {
    await session.close();
  }
}

async function finishIngestionRun(id: string, status: "completed" | "partial" | "failed", summary: SyncSummary, error?: string) {
  const session = createDbSession();
  try {
    await session.db
      .update(schema.ingestionRuns)
      .set({
        status,
        finishedAt: new Date(),
        summary: { ...summary, runId: id },
        error
      })
      .where(eq(schema.ingestionRuns.id, id));
  } finally {
    await session.close();
  }
}

async function markDiscovery(id: string, status: DiscoveryStatus, sourceSnapshotId?: string, error?: string) {
  const session = createDbSession();
  try {
    const row = await session.db.select().from(schema.sourceDiscoveries).where(eq(schema.sourceDiscoveries.id, id)).limit(1);
    const failureCount = status === "failed" ? (row[0]?.failureCount ?? 0) + 1 : row[0]?.failureCount ?? 0;
    await session.db
      .update(schema.sourceDiscoveries)
      .set({
        status,
        importedAt: status === "imported" || status === "partial" ? new Date() : row[0]?.importedAt,
        lastAttemptAt: new Date(),
        sourceSnapshotId: sourceSnapshotId ?? row[0]?.sourceSnapshotId,
        failureCount,
        lastError: error
      })
      .where(eq(schema.sourceDiscoveries.id, id));
  } finally {
    await session.close();
  }
}

async function upsertSourceDiscovery(db: ReturnType<typeof createDbSession>["db"], discovery: SourceDiscoveryInput) {
  const now = new Date();
  const sourceUrl = canonicalizeOfficialUrl(discovery.sourceUrl);
  const officialId = discovery.officialId?.trim() || undefined;
  const values = {
    id: `discovery-${discovery.chamber}-${discovery.kind}-${hashContent(discoveryKey({ ...discovery, officialId, sourceUrl })).slice(0, 16)}`,
    chamber: discovery.chamber,
    kind: discovery.kind,
    sourceUrl,
    officialId,
    title: discovery.title,
    discoveredOn: discovery.discoveredOn,
    firstSeenAt: now,
    lastSeenAt: now,
    status: "pending" as const,
    sourceSnapshotId: discovery.sourceSnapshotId
  };

  const [existingByUrl] = await db
    .select({ id: schema.sourceDiscoveries.id })
    .from(schema.sourceDiscoveries)
    .where(eq(schema.sourceDiscoveries.sourceUrl, values.sourceUrl))
    .limit(1);
  const [existingByOfficialId] = values.officialId
    ? await db
        .select({ id: schema.sourceDiscoveries.id })
        .from(schema.sourceDiscoveries)
        .where(
          and(
            eq(schema.sourceDiscoveries.chamber, values.chamber),
            eq(schema.sourceDiscoveries.kind, values.kind),
            eq(schema.sourceDiscoveries.officialId, values.officialId)
          )
        )
        .limit(1)
    : [];

  const existing = existingByUrl ?? existingByOfficialId;
  if (existing) {
    await db
      .update(schema.sourceDiscoveries)
      .set({
        chamber: values.chamber,
        kind: values.kind,
        sourceUrl: values.sourceUrl,
        officialId: values.officialId,
        title: values.title,
        discoveredOn: values.discoveredOn,
        lastSeenAt: values.lastSeenAt,
        sourceSnapshotId: values.sourceSnapshotId
      })
      .where(eq(schema.sourceDiscoveries.id, existing.id));
    return;
  }

  await db
    .insert(schema.sourceDiscoveries)
    .values(values)
    .onConflictDoUpdate({
      target: schema.sourceDiscoveries.sourceUrl,
      set: {
        chamber: values.chamber,
        kind: values.kind,
        officialId: values.officialId,
        title: values.title,
        discoveredOn: values.discoveredOn,
        lastSeenAt: values.lastSeenAt,
        sourceSnapshotId: values.sourceSnapshotId
      }
    });
}

function discoveryKey(discovery: Pick<SourceDiscoveryInput, "chamber" | "kind" | "sourceUrl" | "officialId">): string {
  return [discovery.chamber, discovery.kind, discovery.officialId ?? canonicalizeOfficialUrl(discovery.sourceUrl)].join(":");
}

async function upsertSourceSnapshot(db: ReturnType<typeof createDbSession>["db"], source: SourceSnapshot) {
  await db
    .insert(schema.sourceSnapshots)
    .values({
      id: source.id,
      sourceUrl: source.sourceUrl,
      fetchedAt: new Date(source.fetchedAt),
      contentHash: source.contentHash,
      parser: source.parser,
      parserVersion: source.parserVersion,
      status: source.status as SourceStatus,
      notes: source.notes
    })
    .onConflictDoUpdate({
      target: schema.sourceSnapshots.id,
      set: {
        sourceUrl: source.sourceUrl,
        fetchedAt: new Date(source.fetchedAt),
        contentHash: source.contentHash,
        parser: source.parser,
        parserVersion: source.parserVersion,
        status: source.status as SourceStatus,
        notes: source.notes
      }
    });
}

function addSummary(target: SyncSummary, next: SyncSummary) {
  target.discovered += next.discovered;
  target.imported += next.imported;
  target.partial += next.partial;
  target.failed += next.failed;
  target.skipped += next.skipped;
  target.expected = (target.expected ?? 0) + (next.expected ?? 0);
  target.errors.push(...next.errors);
}

function statusFromSummary(summary: SyncSummary): "completed" | "partial" | "failed" {
  if (summary.imported === 0 && summary.discovered === 0 && summary.failed > 0) return "failed";
  if (summary.failed > 0 || summary.partial > 0 || summary.errors.length > 0) return "partial";
  return "completed";
}

function yearsSince2024(): number[] {
  const current = new Date().getUTCFullYear();
  return Array.from({ length: current - 2024 + 1 }, (_, index) => 2024 + index);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
