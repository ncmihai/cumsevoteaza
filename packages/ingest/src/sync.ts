import * as cheerio from "cheerio";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { createDbSession } from "@cumsevoteaza/db";
import * as schema from "@cumsevoteaza/db";
import type { ChamberId, SourceSnapshot, SourceStatus } from "@cumsevoteaza/parliament-model";
import { fetchOfficialSource } from "./fetch-source";
import { parseChamberNominalVote } from "./parsers/chamber-vote";
import { parseDeputiesBill } from "./parsers/deputies-bill";
import { parseSenateBill } from "./parsers/senate-bill";
import { parseSenateVote } from "./parsers/senate-vote";
import { cleanText, hashContent, slugify, snapshotFor } from "./parsers/utils";
import { persistChamberVote, persistDeputiesBill, persistSenateBill, persistSenateVote } from "./persist";

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

export interface SyncOptions {
  years?: number[];
  maxImports?: number;
  maxRetries?: number;
  discoveryLimit?: number;
  senateFrom?: number;
  senateTo?: number;
}

export interface SyncSummary {
  runId?: string;
  discovered: number;
  imported: number;
  partial: number;
  failed: number;
  skipped: number;
  errors: string[];
}

const defaultYears = yearsSince2024();

export async function discoverSenateSources(options: SyncOptions = {}): Promise<SyncSummary> {
  const summary = await discoverSources("senate", senateSeedUrls(options.years ?? defaultYears), options);
  if (options.senateFrom && options.senateTo) {
    addSummary(summary, await discoverGeneratedSenateBills(options.years ?? defaultYears, options.senateFrom, options.senateTo));
  }
  return summary;
}

export async function discoverDeputiesSources(options: SyncOptions = {}): Promise<SyncSummary> {
  return discoverSources("deputies", deputiesSeedUrls(options.years ?? defaultYears), options);
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
    const rows = await session.db
      .select()
      .from(schema.sourceDiscoveries)
      .where(inArray(schema.sourceDiscoveries.status, ["pending", "partial", "failed"]))
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
    const html = await fetchOfficialSource(row.sourceUrl, 3);
    const nested = discoverOfficialLinks(html, row.sourceUrl, row.chamber, row.sourceSnapshotId ?? undefined);

    if (row.kind === "bill" && row.chamber === "senate") {
      const parsed = parseSenateBill(html, row.sourceUrl);
      await persistSenateBill(parsed);
      await saveNestedDiscoveries(nested, parsed.sourceSnapshot.id);
      await markDiscovery(row.id, "imported", parsed.sourceSnapshot.id);
      return "imported";
    }

    if (row.kind === "bill" && row.chamber === "deputies") {
      const parsed = parseDeputiesBill(html, row.sourceUrl);
      await persistDeputiesBill(parsed);
      await saveNestedDiscoveries(nested, parsed.sourceSnapshot.id);
      await markDiscovery(row.id, "imported", parsed.sourceSnapshot.id);
      return "imported";
    }

    if (row.kind === "vote" && row.chamber === "senate") {
      const parsed = parseSenateVote(html, row.sourceUrl);
      await persistSenateVote(parsed);
      await markDiscovery(row.id, parsed.sourceSnapshot.status === "parsed" ? "imported" : "partial", parsed.sourceSnapshot.id);
      return parsed.sourceSnapshot.status === "parsed" ? "imported" : "partial";
    }

    if (row.kind === "vote" && row.chamber === "deputies") {
      const parsed = parseChamberNominalVote(html, row.sourceUrl);
      await persistChamberVote(parsed);
      await markDiscovery(row.id, parsed.sourceSnapshot.status === "failed" ? "failed" : "partial", parsed.sourceSnapshot.id);
      return parsed.sourceSnapshot.status === "failed" ? "failed" : "partial";
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

  $("a[href]").each((_, node) => {
    const href = $(node).attr("href");
    if (!href || href.startsWith("javascript:")) return;
    const absoluteUrl = new URL(href.replace(/\\/g, "/"), sourceUrl).toString();
    const text = cleanText($(node).text());
    const rowText = cleanText($(node).closest("tr").text()) || text;
    const kind = kindFromUrl(absoluteUrl);
    if (!kind) return;
    const inferredChamber = chamberFromUrl(absoluteUrl) ?? chamber;
    discoveries.push({
      chamber: inferredChamber,
      kind,
      sourceUrl: absoluteUrl,
      officialId: officialIdFromText(rowText, absoluteUrl),
      title: titleFromRow(rowText, text),
      discoveredOn: dateFromText(rowText),
      sourceSnapshotId
    });
  });

  return uniqueBy(discoveries, (discovery) => discovery.sourceUrl);
}

function kindFromUrl(url: string): DiscoveryKind | undefined {
  if (/senat\.ro\/Legis\/Lista\.aspx\?cod=\d+/i.test(url)) return "bill";
  if (/senat\.ro\/legis\/lista\.aspx/i.test(url) && /[?&]nr_cls=L\d+/i.test(url) && /[?&]an_cls=\d{4}/i.test(url)) {
    return "bill";
  }
  if (/cdep\.ro\/pls\/proiecte\/upl_pck2015\.proiect/i.test(url)) return "bill";
  if (/senat\.ro\/VoturiPlenDetaliu\.aspx/i.test(url)) return "vote";
  if (/cdep\.ro\/pls\/steno\/evot2015\.Nominal/i.test(url)) return "vote";
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

async function discoverGeneratedSenateBills(years: number[], from: number, to: number): Promise<SyncSummary> {
  const session = createDbSession();
  const summary: SyncSummary = { discovered: 0, imported: 0, partial: 0, failed: 0, skipped: 0, errors: [] };
  const start = Math.max(1, Math.min(from, to));
  const end = Math.max(from, to);
  try {
    for (const year of years) {
      for (let number = start; number <= end; number += 1) {
        await upsertSourceDiscovery(session.db, {
          chamber: "senate",
          kind: "bill",
          sourceUrl: `https://www.senat.ro/legis/lista.aspx?an_cls=${year}&nr_cls=L${number}`,
          officialId: `L${number}/${year}`,
          title: `Senate bill candidate L${number}/${year}`
        });
        summary.discovered += 1;
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

function officialIdFromText(text: string, sourceUrl: string): string | undefined {
  return (
    text.match(/L\d+\/\d{4}/)?.[0] ??
    cleanText(text.match(/PL[-\s]*x\s*(?:nr\.\s*)?\d+\/(?:\d{2}\.\d{2}\.)?\d{4}/i)?.[0] ?? "") ??
    new URL(sourceUrl).searchParams.get("cod") ??
    new URL(sourceUrl).searchParams.get("idp") ??
    undefined
  );
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
  const values = {
    id: `discovery-${discovery.chamber}-${discovery.kind}-${hashContent(discovery.sourceUrl).slice(0, 16)}`,
    chamber: discovery.chamber,
    kind: discovery.kind,
    sourceUrl: discovery.sourceUrl,
    officialId: discovery.officialId,
    title: discovery.title,
    discoveredOn: discovery.discoveredOn,
    firstSeenAt: now,
    lastSeenAt: now,
    status: "pending" as const,
    sourceSnapshotId: discovery.sourceSnapshotId
  };
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
