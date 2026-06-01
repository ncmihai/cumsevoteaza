import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import { createDbSession } from "@cumsevoteaza/db";
import * as schema from "@cumsevoteaza/db";
import type { ChamberId } from "@cumsevoteaza/parliament-model";
import { deleteStoredAssets, importStoredAssetsFromInventory, type AssetType } from "./asset-import";
import { importBillText, importBillTextBatch } from "./bill-text";
import { auditBillTextQuality } from "./bill-text-quality-audit";
import { cleanupSupersededCdepHistoryRows } from "./cdep-history-cleanup";
import { importCdepHistoryProfiles } from "./cdep-history-import";
import { auditCurrentLegislature } from "./current-legislature-audit";
import { auditDossierReconciliation } from "./dossier-reconciliation-audit";
import { parseChamberNominalVote } from "./parsers/chamber-vote";
import { classifyDeputiesDocumentKind, parseDeputiesBill } from "./parsers/deputies-bill";
import { parseDeputiesMemberProfile, parseDeputiesRosterGroup, parseDeputiesRosterIndex } from "./parsers/deputies-roster";
import { legislatureCatalog, legislatureFromFlag, partyCatalog, uniqueBy, type ParsedMemberProfile, type ParsedRoster } from "./parsers/roster";
import { parseSenateBill } from "./parsers/senate-bill";
import { parseSenateMemberProfile, parseSenateRosterGroup, parseSenateRosterIndex } from "./parsers/senate-roster";
import { parseSenateVote } from "./parsers/senate-vote";
import {
  defaultWikipediaRosterUrls,
  mergeWikipediaRosterPages,
  parseWikipediaElectionRoster,
  parseWikipediaRosterIndex
} from "./parsers/wikipedia-roster";
import { fetchOfficialSource } from "./fetch-source";
import { governmentSkeletonData } from "./government-skeleton";
import { cleanupLocalData } from "./local-data-cleanup";
import { canonicalizeOfficialUrl } from "./official-urls";
import {
  backfillPeopleFromMembers,
  persistChamberVote,
  persistDeputiesBill,
  persistGovernmentSkeleton,
  persistRoster,
  persistSenateBill,
  persistSenateVote
} from "./persist";
import { snapshotFor } from "./parsers/utils";
import { refreshReadModels } from "./read-models";
import { resetRosterData } from "./roster-reset";
import { crosscheckWikipediaRoster } from "./roster-crosscheck";
import { writePoliticalEntityCandidates } from "./political-entity-candidates";
import { seedPoliticalFormationEvents } from "./political-formation-events";
import { wikipediaRosterToParsedRoster } from "./wikipedia-roster-import";
import {
  discoverDeputiesSources,
  discoverDeputiesVoteSources,
  discoverSenateSources,
  importPendingDiscoveries,
  runBackfill2024,
  runDailySync
} from "./sync";

type RosterGroupRef = {
  group?: ParsedRoster["groups"][number];
  url: string;
  expectedCount?: number;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

loadLocalEnv();

async function main() {
  const command = process.argv[2];

  if (command === "senate:bill") {
    const cod = flag("cod") ?? "27035";
    const url = flag("url") ?? `https://www.senat.ro/Legis/Lista.aspx?cod=${cod}`;
    const html = await loadHtml(url);
    const parsed = parseSenateBill(html, url);
    await writeImport("senate-bill", parsed, html);
    if (hasFlag("persist")) {
      console.log(JSON.stringify(await persistSenateBill(parsed), null, 2));
    }
    return;
  }

  if (command === "bill:deputies") {
    const url = canonicalizeOfficialUrl(flag("url") ?? "https://www.cdep.ro/ords/pls/proiecte/upl_pck2015.proiect?idp=22820");
    const html = await loadHtml(url);
    const parsed = parseDeputiesBill(html, url);
    await writeImport("deputies-bill", parsed, html);
    if (hasFlag("persist")) {
      console.log(JSON.stringify(await persistDeputiesBill(parsed), null, 2));
    }
    return;
  }

  if (command === "bill:senate") {
    const cod = flag("cod") ?? "27035";
    const url = flag("url") ?? `https://www.senat.ro/Legis/Lista.aspx?cod=${cod}`;
    const html = await loadHtml(url);
    const parsed = parseSenateBill(html, url);
    await writeImport("senate-bill", parsed, html);
    if (hasFlag("persist")) {
      console.log(JSON.stringify(await persistSenateBill(parsed), null, 2));
    }
    return;
  }

  if (command === "bill-documents:classify") {
    const result = await reclassifyBillDocuments({
      year: numberFlag("year"),
      limit: numberFlag("limit"),
      persist: hasFlag("persist")
    });
    await writeImport("bill-documents-classify", result, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    if (!hasFlag("persist")) {
      console.log("Dry run only. Re-run with --persist to update document_kind on existing document rows.");
    }
    return;
  }

  if (command === "bill-dossiers:refresh") {
    const result = await refreshDeputiesBillDossiers({
      year: numberFlag("year"),
      limit: numberFlag("limit") ?? 10,
      persist: hasFlag("persist"),
      allowIdMismatch: hasFlag("allow-id-mismatch")
    });
    await writeImport("bill-dossiers-refresh", result, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    if (!hasFlag("persist")) {
      console.log("Dry run only. Re-run with --persist to update bill dossier rows.");
    }
    return;
  }

  if (command === "bill-text") {
    const result = await importBillText({
      billId: flag("bill"),
      documentId: flag("document"),
      documentKind: flag("document-kind"),
      timeoutMs: numberFlag("timeout-ms"),
      insecure: hasFlag("insecure"),
      persist: hasFlag("persist")
    });
    await writeImport("bill-text", result, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    if (!hasFlag("persist")) {
      console.log("Dry run only. Re-run with --persist to fetch the official PDF temporarily and store derived text.");
    }
    return;
  }

  if (command === "bill-text:batch") {
    const result = await importBillTextBatch({
      year: numberFlag("year"),
      limit: numberFlag("limit"),
      documentKind: flag("document-kind"),
      includeFailed: hasFlag("include-failed"),
      includeUnsupported: hasFlag("include-unsupported"),
      timeoutMs: numberFlag("timeout-ms"),
      insecure: hasFlag("insecure"),
      persist: hasFlag("persist")
    });
    await writeImport("bill-text-batch", result, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(hasFlag("summary-only") ? compactBillTextBatchResult(result) : result, null, 2));
    if (!hasFlag("persist")) {
      console.log("Dry run only. Re-run with --persist to fetch official PDFs temporarily and store derived text.");
    }
    return;
  }

  if (command === "audit:bill-text-quality") {
    const result = await auditBillTextQuality({
      year: numberFlag("year"),
      documentKind: flag("document-kind"),
      limit: numberFlag("limit"),
      suspiciousOnly: hasFlag("suspicious-only"),
      minChars: numberFlag("min-chars")
    });
    await writeImport("bill-text-quality-audit", result, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "senate:vote") {
    const url =
      flag("url") ??
      "https://www.senat.ro/VoturiPlenDetaliu.aspx?AppID=EF4EE11F-7327-4C71-9B76-2CB5C930E88C&Cod=27035&Data=2025-10-27";
    const html = await loadHtml(url);
    const parsed = parseSenateVote(html, url);
    await writeImport("senate-vote", parsed, html);
    if (hasFlag("persist")) {
      console.log(JSON.stringify(await persistSenateVote(parsed), null, 2));
    }
    return;
  }

  if (command === "chamber:vote") {
    const url = canonicalizeOfficialUrl(flag("url") ?? "https://www.cdep.ro/ords/pls/steno/evot2015.Nominal?idv=35953");
    try {
      const html = await loadHtml(url);
      const parsed = parseChamberNominalVote(html, url);
      await writeImport("chamber-vote", parsed, html);
      if (hasFlag("persist")) {
        console.log(JSON.stringify(await persistChamberVote(parsed), null, 2));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const snapshot = snapshotFor("chamber-nominal-vote", url, message, "failed", message);
      await writeImport("chamber-vote-failed", { sourceSnapshot: snapshot, error: message }, message);
    }
    return;
  }

  if (command === "senate:roster") {
    const parsed = await importSenateRoster();
    await writeImport("senate-roster", parsed, JSON.stringify(parsed, null, 2));
    logRosterSummary(parsed);
    if (hasFlag("persist")) {
      console.log(JSON.stringify(await persistRoster(parsed), null, 2));
    }
    return;
  }

  if (command === "deputies:roster") {
    const parsed = await importDeputiesRoster();
    await writeImport("deputies-roster", parsed, JSON.stringify(parsed, null, 2));
    logRosterSummary(parsed);
    if (hasFlag("persist")) {
      console.log(JSON.stringify(await persistRoster(parsed), null, 2));
    }
    return;
  }

  if (command === "official-careers") {
    const parsed = await importOfficialCareers();
    await writeImport("official-careers", parsed, JSON.stringify(parsed, null, 2));
    logRosterSummary(parsed);
    if (hasFlag("persist")) {
      console.log(JSON.stringify(await persistRoster(parsed), null, 2));
    }
    return;
  }

  if (command === "cdep-history:import") {
    const result = await importCdepHistoryProfiles({
      profilesPath: flag("profiles") ?? path.join(repoRoot, "data/cdep-history/parsed/profiles.jsonl"),
      legislature: flag("legislature") ?? "2004",
      chamber: chamberFlag() ?? "both",
      persist: hasFlag("persist")
    });
    await writeCdepHistoryWarningFiles(result);
    await writeImport("cdep-history-import", result, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(compactCdepHistoryImportResult(result), null, 2));
    if (!hasFlag("persist")) {
      console.log("Dry run only. Re-run with --persist to write these official CDEP roster rows.");
    }
    return;
  }

  if (command === "cdep-history:cleanup") {
    const result = await cleanupSupersededCdepHistoryRows({
      legislature: flag("legislature"),
      chamber: chamberFlag(),
      confirm: hasFlag("confirm")
    });
    await writeImport("cdep-history-cleanup", result, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    if (!hasFlag("confirm")) {
      console.log("Dry run only. Re-run with --confirm to delete superseded non-CDEP mandate/profile rows.");
    }
    return;
  }

  if (command === "assets:import") {
    const result = await importStoredAssetsFromInventory({
      assetsPath: resolveRepoPath(flag("assets") ?? "data/cdep-history/parsed/assets.jsonl"),
      assetType: assetTypeFlag(),
      legislature: flag("legislature"),
      limit: numberFlag("limit"),
      maxUniqueOfficialUrls: numberFlag("max-unique-official-urls"),
      uniqueOfficialUrlOffset: numberFlag("unique-official-url-offset"),
      delayMs: numberFlag("delay-ms"),
      timeoutMs: numberFlag("timeout-ms"),
      insecure: hasFlag("insecure"),
      optimizePhotos: !hasFlag("no-optimize-photos"),
      photoWidth: numberFlag("photo-width"),
      photoHeight: numberFlag("photo-height"),
      force: hasFlag("force"),
      persist: hasFlag("persist")
    });
    await writeImport("assets-import", result, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    if (!hasFlag("persist")) {
      console.log("Dry run only. Re-run with --persist to upload to the configured asset store and write stored_assets metadata.");
    }
    return;
  }

  if (command === "assets:delete-stored") {
    const result = await deleteStoredAssets({
      assetType: assetTypeFlag(),
      legislature: flag("legislature"),
      minByteSize: numberFlag("min-byte-size"),
      limit: numberFlag("limit"),
      confirm: hasFlag("confirm"),
      markPending: !hasFlag("keep-db-state")
    });
    await writeImport("assets-delete-stored", result, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    if (!hasFlag("confirm")) {
      console.log("Dry run only. Re-run with --confirm to delete matching Blob objects and mark rows pending.");
    }
    return;
  }

  if (command === "data:clean") {
    const result = await cleanupLocalData({
      repoRoot,
      confirm: hasFlag("confirm"),
      includeSystemJunk: !hasFlag("no-system-junk"),
      includeImports: hasFlag("imports") || hasFlag("all-generated"),
      includeSnapshots: hasFlag("snapshots") || hasFlag("all-generated"),
      includeCdepRaw: hasFlag("cdep-raw") || hasFlag("all-generated"),
      includePipelineRaw: hasFlag("pipeline-raw") || hasFlag("all-generated"),
      includeParsed: hasFlag("parsed"),
      keepDays: numberFlag("keep-days"),
      keepLatest: numberFlag("keep-latest")
    });
    const wroteReport = await writeJsonReport("data-clean", result);
    const selectedCandidates = result.candidates.filter((candidate) => candidate.selected);
    const previewSource = selectedCandidates.length > 0 ? selectedCandidates : result.candidates;
    const previewLimit = selectedCandidates.length > 0 ? 50 : 20;
    console.log(
      JSON.stringify(
        {
          ...result,
          candidatePreview: selectedCandidates.length > 0 ? "selected" : "first_unselected",
          candidates: previewSource.slice(0, previewLimit)
        },
        null,
        2
      )
    );
    if (wroteReport && result.candidates.length > previewLimit) {
      console.log(`Showing ${Math.min(previewLimit, previewSource.length)} of ${result.candidates.length} cleanup candidates. Full report was written to data/imports.`);
    }
    if (!hasFlag("confirm")) {
      console.log(
        "Dry run only. Re-run with --confirm plus explicit flags such as --imports, --snapshots, --cdep-raw, --pipeline-raw, or --all-generated to delete selected files."
      );
    }
    return;
  }

  if (command === "roster:all") {
    const senate = await importSenateRoster();
    const deputies = await importDeputiesRoster();
    const parsed = { senate, deputies };
    await writeImport("roster-all", parsed, JSON.stringify(parsed, null, 2));
    if (hasFlag("persist")) {
      console.log(
        JSON.stringify(
          {
            senate: await persistRoster(senate),
            deputies: await persistRoster(deputies)
          },
          null,
          2
        )
      );
    }
    return;
  }

  if (command === "roster:reset") {
    const confirm = hasFlag("confirm");
    const summary = await resetRosterData({ dryRun: !confirm });
    console.log(JSON.stringify(summary, null, 2));
    if (!confirm) {
      console.log("Dry run only. Re-run with --confirm to delete roster-derived rows.");
    }
    return;
  }

  if (command === "wikipedia:roster") {
    const parsed = await importWikipediaRosterPage();
    await writeImport("wikipedia-roster", parsed, JSON.stringify(parsed, null, 2));
    console.log(JSON.stringify(wikipediaRosterSummary(parsed), null, 2));
    return;
  }

  if (command === "wikipedia:roster:all") {
    const summaries = [];
    for (const legislature of allLegislaturesNewestFirst()) {
      const parsed = await importWikipediaRosterPage(legislature);
      await writeImport(`wikipedia-roster-${legislature.label}`, parsed, JSON.stringify(parsed, null, 2));
      summaries.push(wikipediaRosterSummary(parsed));
    }
    console.log(JSON.stringify(summaries, null, 2));
    return;
  }

  if (command === "wikipedia:roster:import") {
    const chamber = chamberFlag() ?? "senate";
    const imports = [];
    for (const legislature of hasFlag("all") ? allLegislaturesNewestFirst() : [rosterLegislature()]) {
      const parsedPage = await importWikipediaRosterPage(legislature);
      const parsedRoster = wikipediaRosterToParsedRoster(parsedPage, chamber);
      const existingMandates = await existingMandateCount(parsedRoster.legislature.id, chamber);
      const shouldSkip = hasFlag("skip-existing") && existingMandates > 0;
      await writeImport(`wikipedia-roster-import-${chamber}-${parsedRoster.legislature.label}`, parsedRoster, JSON.stringify(parsedRoster, null, 2));
      const persisted = hasFlag("persist") && !shouldSkip ? await persistRoster(parsedRoster) : undefined;
      imports.push({
        chamber,
        legislature: parsedRoster.legislature.label,
        existingMandates,
        skipped: shouldSkip,
        sources: parsedRoster.sourceSnapshots.length,
        members: parsedRoster.members.length,
        mandates: parsedRoster.mandates.length,
        groups: parsedRoster.groups.length,
        persisted
      });
    }
    console.log(JSON.stringify(imports, null, 2));
    return;
  }

  if (command === "wikipedia:roster-index") {
    const chamber = chamberFlag() ?? "deputies";
    const url =
      flag("url") ??
      (chamber === "senate"
        ? "https://ro.wikipedia.org/wiki/List%C4%83_de_senatori_rom%C3%A2ni"
        : "https://ro.wikipedia.org/wiki/List%C4%83_de_deputa%C8%9Bi_rom%C3%A2ni");
    const parsed = parseWikipediaRosterIndex(await loadHtml(url), url, chamber);
    await writeImport("wikipedia-roster-index", parsed, JSON.stringify(parsed, null, 2));
    console.log(JSON.stringify({ chamber, links: parsed.links.length, rows: parsed.links }, null, 2));
    return;
  }

  if (command === "roster:crosscheck") {
    const parsed = await importWikipediaRosterPage();
    const result = await crosscheckWikipediaRoster(parsed);
    await writeImport("roster-crosscheck", result, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(hasFlag("full") ? result : compactCrosscheckResult(result), null, 2));
    return;
  }

  if (command === "roster:crosscheck:all") {
    const results = [];
    for (const legislature of allLegislaturesNewestFirst()) {
      const parsed = await importWikipediaRosterPage(legislature);
      const result = await crosscheckWikipediaRoster(parsed);
      await writeImport(`roster-crosscheck-${legislature.label}`, result, JSON.stringify(result, null, 2));
      results.push(hasFlag("full") ? result : compactCrosscheckResult(result));
    }
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (command === "people:backfill") {
    console.log(JSON.stringify(await backfillPeopleFromMembers(), null, 2));
    return;
  }

  if (command === "governments:skeleton") {
    console.log(JSON.stringify(await persistGovernmentSkeleton(governmentSkeletonData()), null, 2));
    return;
  }

  if (command === "political-formations:seed") {
    console.log(JSON.stringify(await seedPoliticalFormationEvents({ eventsPath: flag("events") }), null, 2));
    return;
  }

  if (command === "political-entities:candidates") {
    console.log(JSON.stringify(await writePoliticalEntityCandidates({
      jsonPath: flag("json"),
      markdownPath: flag("markdown")
    }), null, 2));
    return;
  }

  if (command === "discover:senate") {
    console.log(JSON.stringify(await discoverSenateSources(syncOptions()), null, 2));
    return;
  }

  if (command === "discover:deputies") {
    console.log(JSON.stringify(await discoverDeputiesSources(syncOptions()), null, 2));
    return;
  }

  if (command === "discover:deputies-votes") {
    console.log(JSON.stringify(await discoverDeputiesVoteSources(syncOptions()), null, 2));
    return;
  }

  if (command === "backfill:2024") {
    console.log(JSON.stringify(await runBackfill2024(syncOptions()), null, 2));
    return;
  }

  if (command === "sync:daily") {
    console.log(JSON.stringify(await runDailySync(syncOptions()), null, 2));
    return;
  }

  if (command === "import:pending") {
    console.log(JSON.stringify(await importPendingDiscoveries(syncOptions()), null, 2));
    return;
  }

  if (command === "audit:current-legislature") {
    const result = await auditCurrentLegislature({
      legislatureId: flag("legislature-id") ?? (flag("legislature") ? `leg-${flag("legislature")}` : undefined),
      chamber: chamberFlag(),
      sampleLimit: numberFlag("sample-limit")
    });
    await writeImport("audit-current-legislature", result, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "audit:dossier-reconciliation") {
    const result = await auditDossierReconciliation({
      legislatureId: flag("legislature-id") ?? (flag("legislature") ? `leg-${flag("legislature")}` : undefined),
      chamber: chamberFlag(),
      sampleLimit: numberFlag("sample-limit")
    });
    await writeImport("audit-dossier-reconciliation", result, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "refresh-read-models") {
    console.log(JSON.stringify(await refreshReadModels(), null, 2));
    return;
  }

  throw new Error(`Unknown command: ${command ?? "(missing)"}`);
}

interface RefreshDeputiesDossiersOptions {
  year?: number;
  limit: number;
  persist: boolean;
  allowIdMismatch: boolean;
}

interface RefreshDeputiesDossierCandidate extends Record<string, unknown> {
  id: string;
  title: string;
  source_url: string;
  event_on: string | null;
  procedure_steps: number;
  documents: number;
}

async function refreshDeputiesBillDossiers(options: RefreshDeputiesDossiersOptions) {
  const candidates = await loadDeputiesDossierRefreshCandidates(options);
  const refreshed = [];
  const skipped = [];
  const failed = [];

  for (const candidate of candidates) {
    const sourceUrl = canonicalizeOfficialUrl(candidate.source_url);
    try {
      const html = await fetchOfficialSource(sourceUrl, 3);
      const parsed = parseDeputiesBill(html, sourceUrl);
      const idMismatch = parsed.bill.id !== candidate.id;
      if (idMismatch && !options.allowIdMismatch) {
        skipped.push({
          billId: candidate.id,
          parsedBillId: parsed.bill.id,
          sourceUrl,
          reason: "parsed bill id differs from existing row; rerun with --allow-id-mismatch only after manual review"
        });
        continue;
      }

      const persisted = options.persist ? await persistDeputiesBill(parsed) : undefined;
      refreshed.push({
        billId: candidate.id,
        parsedBillId: parsed.bill.id,
        sourceUrl,
        procedureStepsBefore: candidate.procedure_steps,
        documentsBefore: candidate.documents,
        procedureSteps: parsed.procedureSteps.length,
        documents: parsed.documents.length,
        persisted
      });
      await sleep(500);
    } catch (error) {
      failed.push({
        billId: candidate.id,
        sourceUrl,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (options.persist && refreshed.length > 0) {
    await refreshReadModels();
  }

  return {
    filters: {
      year: options.year,
      limit: options.limit,
      persist: options.persist,
      allowIdMismatch: options.allowIdMismatch
    },
    candidates: candidates.length,
    refreshed: refreshed.length,
    skipped: skipped.length,
    failed: failed.length,
    rows: refreshed,
    skippedRows: skipped,
    failedRows: failed
  };
}

async function loadDeputiesDossierRefreshCandidates(options: RefreshDeputiesDossiersOptions): Promise<RefreshDeputiesDossierCandidate[]> {
  const session = createDbSession();
  try {
    return await session.db.execute<RefreshDeputiesDossierCandidate>(sql`
      select
        b.id,
        b.title,
        min(ss.source_url) filter (where ss.source_url ilike '%cdep.ro%upl_pck2015.proiect%') as source_url,
        coalesce(bvs.latest_event_on, bvs.submitted_on) as event_on,
        count(distinct bps.id)::int as procedure_steps,
        count(distinct d.id)::int as documents
      from bills b
      left join bill_vote_summaries bvs on bvs.bill_id = b.id
      left join lateral jsonb_array_elements_text(b.source_snapshot_ids) as sid(id) on true
      left join source_snapshots ss on ss.id = sid.id
      left join bill_procedure_steps bps on bps.bill_id = b.id
      left join documents d on d.bill_id = b.id
      where b.identifiers ? 'deputies'
        ${options.year ? sql`and coalesce(bvs.latest_event_on, bvs.submitted_on) >= ${`${options.year}-01-01`}::date and coalesce(bvs.latest_event_on, bvs.submitted_on) < ${`${options.year + 1}-01-01`}::date` : sql``}
      group by b.id, b.title, bvs.latest_event_on, bvs.submitted_on
      having count(distinct bps.id) = 0
        and min(ss.source_url) filter (where ss.source_url ilike '%cdep.ro%upl_pck2015.proiect%') is not null
      order by coalesce(bvs.latest_event_on, bvs.submitted_on) desc nulls last, b.id
      limit ${options.limit}
    `);
  } finally {
    await session.close();
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function importSenateRoster(): Promise<ParsedRoster> {
  const legislature = rosterLegislature();
  const groupUrls = listFlag("group-urls");
  const indexUrl = flag("url") ?? "https://www.senat.ro/EnumGrupuri.aspx";
  const index = groupUrls
    ? undefined
    : parseSenateRosterIndex(await loadHtml(indexUrl), indexUrl);
  const limitValue = Number(flag("limit") ?? "0");
  const groupRefs: RosterGroupRef[] = groupUrls
    ? groupUrls.map((url) => ({ url }))
    : (index?.groups ?? []);
  const groupsToFetch = limitValue > 0 ? groupRefs.slice(0, limitValue) : groupRefs;
  const groupParts = [];
  const profiles: ParsedMemberProfile[] = [];
  const concurrency = Number(flag("concurrency") ?? "6");

  for (const groupRef of groupsToFetch) {
    console.log(`Fetching Senate group ${groupRef.group?.shortName ?? groupRef.url}`);
    const html = await fetchWithFailureSnapshot(groupRef.url, "senate-roster-group");
    const group = parseSenateRosterGroup(html, groupRef.url, groupRef.group, { legislature });
    group.expectedCount = groupRef.expectedCount ?? group.expectedCount;
    if (groupRef.expectedCount && group.members.length > groupRef.expectedCount) {
      group.members = group.members.slice(0, groupRef.expectedCount);
    }
    groupParts.push(group);
    const membersToFetch = limitValue > 0 ? group.members.slice(0, limitValue) : group.members;
    profiles.push(
      ...(await mapLimit(membersToFetch, concurrency, async (memberRef) => {
        const profileHtml = await fetchOptional(memberRef.profileUrl, "senate-member-profile");
        return profileHtml ? parseSenateMemberProfile(profileHtml, memberRef.profileUrl, { legislature }) : undefined;
      }))
    );
  }
  return {
    chamber: "senate",
    legislature,
    sourceSnapshots: uniqueBy(
      [
        ...(index ? [index.sourceSnapshot] : []),
        ...groupParts.map((group) => group.sourceSnapshot),
        ...profiles.map((profile) => profile.sourceSnapshot)
      ],
      (source) => source.id
    ),
    parties: uniqueBy(
      [
        ...(index?.groups ?? []).flatMap((group) => (group.party ? [group.party] : [])),
        ...groupParts.flatMap((group) => (group.party ? [group.party] : [])),
        ...profiles.flatMap((profile) => profile.parties ?? []),
        ...partiesFromGroups([...(index?.groups ?? []).map((group) => group.group), ...groupParts.map((group) => group.group)])
      ],
      (party) => party.id
    ),
    groups: uniqueBy([...(index?.groups ?? []).map((group) => group.group), ...groupParts.map((group) => group.group)], (group) => group.id),
    members: uniqueBy(
      [...groupParts.flatMap((group) => group.members.map((member) => member.member)), ...profiles.map((profile) => profile.member)],
      (member) => member.id
    ),
    mandates: uniqueBy(profiles.flatMap((profile) => (profile.mandate ? [profile.mandate] : [])), (mandate) => mandate.id),
    mandateRelations: uniqueBy(profiles.flatMap((profile) => profile.mandateRelations ?? []), (relation) => relation.id),
    groupMemberships: uniqueBy(
      [...groupParts.flatMap((group) => group.members.map((member) => member.membership)), ...profiles.flatMap((profile) => profile.groupMemberships)],
      (membership) => membership.id
    ),
    partyAffiliations: uniqueBy(
      [
        ...groupParts.flatMap((group) => group.members.flatMap((member) => (member.partyAffiliation ? [member.partyAffiliation] : []))),
        ...profiles.flatMap((profile) => profile.partyAffiliations)
      ],
      (affiliation) => affiliation.id
    ),
    committeeMemberships: uniqueBy(profiles.flatMap((profile) => profile.committeeMemberships), (membership) => membership.id),
    roles: uniqueBy(
      [...groupParts.flatMap((group) => group.members.flatMap((member) => (member.role ? [member.role] : []))), ...profiles.flatMap((profile) => profile.roles)],
      (role) => role.id
    ),
    groupCounts: groupParts.map((group) => ({
      groupId: group.group.id,
      expected: group.expectedCount ?? 0,
      parsed: group.members.length
    }))
  };
}

async function importDeputiesRoster(): Promise<ParsedRoster> {
  const legislature = rosterLegislature();
  const memberIdFrom = numberFlag("member-id-from");
  const memberIdTo = numberFlag("member-id-to");
  if (memberIdFrom && memberIdTo) {
    return importDeputiesRosterByMemberIds(legislature, memberIdFrom, memberIdTo);
  }

  const groupUrls = listFlag("group-urls");
  const indexUrl = flag("url") ?? defaultDeputiesRosterUrl(legislature.label);
  const index = groupUrls
    ? undefined
    : parseDeputiesRosterIndex(await loadHtml(indexUrl), indexUrl, { legislature });
  const limitValue = Number(flag("limit") ?? "0");
  const groupRefs: RosterGroupRef[] = groupUrls
    ? groupUrls.map((url) => ({ url }))
    : (index?.groups ?? []);
  const groupsToFetch = limitValue > 0 ? groupRefs.slice(0, limitValue) : groupRefs;
  const groupParts = [];
  const profiles: ParsedMemberProfile[] = [];
  const concurrency = Number(flag("concurrency") ?? "6");

  for (const groupRef of groupsToFetch) {
    console.log(`Fetching Deputies group ${groupRef.group?.shortName ?? groupRef.url}`);
    const html = await fetchWithFailureSnapshot(groupRef.url, "deputies-roster-group");
    const group = parseDeputiesRosterGroup(html, groupRef.url, groupRef.group, { legislature });
    group.expectedCount = groupRef.expectedCount ?? group.expectedCount;
    if (groupRef.expectedCount && group.members.length > groupRef.expectedCount) {
      group.members = group.members.slice(0, groupRef.expectedCount);
    }
    groupParts.push(group);
    const membersToFetch = limitValue > 0 ? group.members.slice(0, limitValue) : group.members;
    profiles.push(
      ...(await mapLimit(membersToFetch, concurrency, async (memberRef) => {
        const profileHtml = await fetchOptional(memberRef.profileUrl, "deputies-member-profile");
        return profileHtml ? parseDeputiesMemberProfile(profileHtml, memberRef.profileUrl, { legislature }) : undefined;
      }))
    );
  }
  const profiledMemberIdsWithGroups = new Set(profiles.filter((profile) => profile.groupMemberships.length > 0).map((profile) => profile.member.id));
  const profiledMemberIdsWithParties = new Set(profiles.filter((profile) => profile.partyAffiliations.length > 0).map((profile) => profile.member.id));

  return {
    chamber: "deputies",
    legislature,
    sourceSnapshots: uniqueBy(
      [
        ...(index ? [index.sourceSnapshot] : []),
        ...groupParts.map((group) => group.sourceSnapshot),
        ...profiles.map((profile) => profile.sourceSnapshot)
      ],
      (source) => source.id
    ),
    parties: uniqueBy(
      [
        ...(index?.groups ?? []).flatMap((group) => (group.party ? [group.party] : [])),
        ...groupParts.flatMap((group) => (group.party ? [group.party] : [])),
        ...profiles.flatMap((profile) => profile.parties ?? []),
        ...partiesFromGroups([
          ...(index?.groups ?? []).map((group) => group.group),
          ...groupParts.map((group) => group.group),
          ...profiles.flatMap((profile) => profile.groups ?? [])
        ])
      ],
      (party) => party.id
    ),
    groups: uniqueBy(
      [
        ...(index?.groups ?? []).map((group) => group.group),
        ...groupParts.map((group) => group.group),
        ...profiles.flatMap((profile) => profile.groups ?? [])
      ],
      (group) => group.id
    ),
    members: uniqueBy(
      [...profiles.map((profile) => profile.member), ...groupParts.flatMap((group) => group.members.map((member) => member.member))],
      (member) => member.id
    ),
    mandates: uniqueBy(profiles.flatMap((profile) => (profile.mandate ? [profile.mandate] : [])), (mandate) => mandate.id),
    mandateRelations: uniqueBy(profiles.flatMap((profile) => profile.mandateRelations ?? []), (relation) => relation.id),
    groupMemberships: uniqueBy(
      [
        ...groupParts.flatMap((group) =>
          group.members.filter((member) => !profiledMemberIdsWithGroups.has(member.member.id)).map((member) => member.membership)
        ),
        ...profiles.flatMap((profile) => profile.groupMemberships)
      ],
      (membership) => membership.id
    ),
    partyAffiliations: uniqueBy(
      [
        ...groupParts.flatMap((group) =>
          group.members.flatMap((member) =>
            !profiledMemberIdsWithParties.has(member.member.id) && member.partyAffiliation ? [member.partyAffiliation] : []
          )
        ),
        ...profiles.flatMap((profile) => profile.partyAffiliations)
      ],
      (affiliation) => affiliation.id
    ),
    committeeMemberships: uniqueBy(profiles.flatMap((profile) => profile.committeeMemberships), (membership) => membership.id),
    roles: uniqueBy(
      [...groupParts.flatMap((group) => group.members.flatMap((member) => (member.role ? [member.role] : []))), ...profiles.flatMap((profile) => profile.roles)],
      (role) => role.id
    ),
    groupCounts: groupParts.map((group) => ({
      groupId: group.group.id,
      expected: group.expectedCount ?? 0,
      parsed: group.members.length
    }))
  };
}

async function importDeputiesRosterByMemberIds(
  legislature: ParsedRoster["legislature"],
  from: number,
  to: number
): Promise<ParsedRoster> {
  const concurrency = Number(flag("concurrency") ?? "8");
  const ids = Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);
  const profiles = await mapLimit(ids, concurrency, async (officialId) => {
    const url = defaultDeputiesMemberProfileUrl(legislature.label, officialId);
    const profileHtml = await fetchOptional(url, "deputies-member-profile");
    if (!profileHtml) return undefined;
    const profile = parseDeputiesMemberProfile(profileHtml, url, { legislature });
    return looksLikeParsedDeputiesMember(profile) ? profile : undefined;
  });

  return {
    chamber: "deputies",
    legislature,
    sourceSnapshots: uniqueBy(profiles.map((profile) => profile.sourceSnapshot), (source) => source.id),
    parties: uniqueBy(
      [...profiles.flatMap((profile) => profile.parties ?? []), ...partiesFromGroups(profiles.flatMap((profile) => profile.groups ?? []))],
      (party) => party.id
    ),
    groups: uniqueBy(profiles.flatMap((profile) => profile.groups ?? []), (group) => group.id),
    members: uniqueBy(profiles.map((profile) => profile.member), (member) => member.id),
    mandates: uniqueBy(profiles.flatMap((profile) => (profile.mandate ? [profile.mandate] : [])), (mandate) => mandate.id),
    mandateRelations: uniqueBy(profiles.flatMap((profile) => profile.mandateRelations ?? []), (relation) => relation.id),
    groupMemberships: uniqueBy(profiles.flatMap((profile) => profile.groupMemberships), (membership) => membership.id),
    partyAffiliations: uniqueBy(profiles.flatMap((profile) => profile.partyAffiliations), (affiliation) => affiliation.id),
    committeeMemberships: uniqueBy(profiles.flatMap((profile) => profile.committeeMemberships), (membership) => membership.id),
    roles: uniqueBy(profiles.flatMap((profile) => profile.roles), (role) => role.id),
    groupCounts: []
  };
}

async function importOfficialCareers(): Promise<ParsedRoster> {
  const seedUrls = listFlag("urls") ?? (flag("url") ? [flag("url")!] : undefined);
  const requestedChamber = chamberFlag();
  const legislature = rosterLegislature();
  const from = numberFlag("member-id-from");
  const to = numberFlag("member-id-to");
  const limit = Number(flag("limit") ?? "0");
  const concurrency = Number(flag("concurrency") ?? "4");
  const chamber = requestedChamber ?? (seedUrls?.[0] ? chamberFromCdepUrl(seedUrls[0]) : "deputies");
  const seeds = seedUrls ?? (from && to ? Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => defaultCdepMemberProfileUrl(legislature.label, from + index, chamber)) : []);
  if (seeds.length === 0) throw new Error("official-careers requires --url=... or --member-id-from/--member-id-to");

  const profilesByUrl = new Map<string, ParsedMemberProfile>();
  const queue = [...seeds.map(canonicalizeOfficialUrl)];
  const seen = new Set<string>();

  while (queue.length > 0 && (limit <= 0 || profilesByUrl.size < limit)) {
    const batch = queue.splice(0, concurrency).filter((url) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
    const profiles = await mapLimit(batch, concurrency, async (url) => {
      const profileLegislature = legislatureFromProfileUrl(url) ?? legislature;
      const html = await fetchOptional(url, "deputies-member-profile");
      if (!html) return undefined;
      const profile = parseDeputiesMemberProfile(html, url, { legislature: profileLegislature, chamber: chamberFromCdepUrl(url) });
      return looksLikeParsedDeputiesMember(profile) ? profile : undefined;
    });
    for (const profile of profiles) {
      profilesByUrl.set(profile.sourceSnapshot.sourceUrl, profile);
      for (const link of profile.careerLinks ?? []) {
        const url = canonicalizeOfficialUrl(link.url);
        if (!seen.has(url)) queue.push(url);
      }
    }
  }

  const profiles = [...profilesByUrl.values()];
  const primaryLegislature = profiles[0]?.mandate ? legislatureFromFlag(profiles[0].mandate.legislatureId.replace(/^leg-/, "")) : legislature;
  return {
    chamber,
    legislature: primaryLegislature,
    sourceSnapshots: uniqueBy(profiles.map((profile) => profile.sourceSnapshot), (source) => source.id),
    parties: uniqueBy(
      [...profiles.flatMap((profile) => profile.parties ?? []), ...partiesFromGroups(profiles.flatMap((profile) => profile.groups ?? []))],
      (party) => party.id
    ),
    groups: uniqueBy(profiles.flatMap((profile) => profile.groups ?? []), (group) => group.id),
    members: uniqueBy(profiles.map((profile) => profile.member), (member) => member.id),
    mandates: uniqueBy(profiles.flatMap((profile) => (profile.mandate ? [profile.mandate] : [])), (mandate) => mandate.id),
    mandateRelations: uniqueBy(profiles.flatMap((profile) => profile.mandateRelations ?? []), (relation) => relation.id),
    groupMemberships: uniqueBy(profiles.flatMap((profile) => profile.groupMemberships), (membership) => membership.id),
    partyAffiliations: uniqueBy(profiles.flatMap((profile) => profile.partyAffiliations), (affiliation) => affiliation.id),
    committeeMemberships: uniqueBy(profiles.flatMap((profile) => profile.committeeMemberships), (membership) => membership.id),
    roles: uniqueBy(profiles.flatMap((profile) => profile.roles), (role) => role.id),
    groupCounts: []
  };
}

function defaultCdepMemberProfileUrl(label: string, officialId: number, chamber: ChamberId): string {
  const cam = chamber === "senate" ? 1 : 2;
  return `https://www.cdep.ro/ords/pls/parlam/structura.mp?idm=${officialId}&cam=${cam}&leg=${label.slice(0, 4)}&pag=1&idl=1`;
}

function chamberFromCdepUrl(url: string): ChamberId {
  return /[?&]cam=1\b/i.test(url) ? "senate" : "deputies";
}

function legislatureFromProfileUrl(url: string): ParsedRoster["legislature"] | undefined {
  const year = url.match(/[?&]leg=(\d{4})/i)?.[1];
  return year ? legislatureFromFlag(year) : undefined;
}

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function partiesFromGroups(groups: ParsedRoster["groups"]): ParsedRoster["parties"] {
  const partiesById = new Map(Object.values(partyCatalog).map((party) => [party.id, party]));
  return groups.flatMap((group) => {
    if (!group.partyId) return [];
    const party = partiesById.get(group.partyId);
    return party ? [party] : [];
  });
}

function logRosterSummary(parsed: ParsedRoster) {
  console.log(
    JSON.stringify(
      {
        chamber: parsed.chamber,
        legislature: parsed.legislature.label,
        sources: parsed.sourceSnapshots.length,
        groups: parsed.groups.length,
        members: parsed.members.length,
        mandates: parsed.mandates.length,
        mandateRelations: parsed.mandateRelations?.length ?? 0,
        groupMemberships: parsed.groupMemberships.length,
        committeeMemberships: parsed.committeeMemberships.length,
        groupCounts: parsed.groupCounts
      },
      null,
      2
    )
  );
}

function rosterLegislature() {
  return legislatureFromFlag(flag("legislature") ?? flag("year"));
}

function defaultDeputiesRosterUrl(label: string): string {
  if (label === "2020-2024") {
    return "https://www.cdep.ro/pls/parlam/structura.gp?leg=2020";
  }
  return "https://cdep.ro/ords/pls/dic/site2015.home?idl=1";
}

function defaultDeputiesMemberProfileUrl(label: string, officialId: number): string {
  const leg = label.slice(0, 4);
  return `https://www.cdep.ro/ords/pls/parlam/structura2015.mp?cam=2&idl=1&idm=${officialId}&leg=${leg}&pag=1`;
}

function looksLikeParsedDeputiesMember(profile: ParsedMemberProfile): boolean {
  if (!profile.member.displayName || !profile.mandate) return false;
  return ![
    "activitate-parlamentara",
    "activitate-publica",
    "biografie",
    "camera-deputatilor",
    "curriculum-vitae",
    "declaratia-de-avere",
    "declaratia-de-interese",
    "votul-electronic"
  ].includes(profile.member.slug);
}

async function importWikipediaRosterPage(overrideLegislature?: ReturnType<typeof rosterLegislature>) {
  const legislature = overrideLegislature ?? rosterLegislature();
  const explicitUrl = overrideLegislature ? undefined : flag("url");
  const urls = explicitUrl ? [explicitUrl] : defaultWikipediaRosterUrls(legislature.label);
  const pages = [];
  for (const url of urls) {
    const html = await loadHtml(url);
    pages.push(parseWikipediaElectionRoster(html, url, { legislature }));
  }
  return pages.length === 1 ? pages[0]! : mergeWikipediaRosterPages(pages);
}

function wikipediaRosterSummary(parsed: Awaited<ReturnType<typeof importWikipediaRosterPage>>) {
  const byChamber = {
    deputies: parsed.rows.filter((row) => row.chamber === "deputies").length,
    senate: parsed.rows.filter((row) => row.chamber === "senate").length
  };
  const unknownParties = [...new Set(parsed.rows.filter((row) => row.partyLabel && !row.partyId).map((row) => row.partyLabel))].sort();
  return {
    sourceUrl: parsed.sourceUrl,
    legislature: parsed.legislatureLabel,
    rows: parsed.rows.length,
    expectedCounts: parsed.counts,
    byChamber,
    unknownParties
  };
}

function compactCrosscheckResult(result: Awaited<ReturnType<typeof crosscheckWikipediaRoster>>) {
  return {
    source: result.source,
    legislature: result.legislatureLabel,
    totals: result.totals,
    byChamber: Object.fromEntries(
      Object.entries(result.byChamber).map(([chamber, value]) => [
        chamber,
        {
          wikipediaRows: value.wikipediaRows,
          officialRows: value.officialRows,
          expectedCount: value.expectedCount,
          matched: value.matched,
          missingOfficial: value.missingOfficial.length,
          missingWikipedia: value.missingWikipedia.length,
          partyMismatches: value.partyMismatches.length,
          examples: {
            missingOfficial: value.missingOfficial.slice(0, 5).map((row) => ({
              name: row.displayName,
              party: row.partyLabel,
              constituency: row.constituency
            })),
            missingWikipedia: value.missingWikipedia.slice(0, 5).map((row) => ({
              name: row.displayName,
              party: row.partyShortName,
              constituency: row.constituency
            })),
            partyMismatches: value.partyMismatches.slice(0, 5)
          }
        }
      ])
    )
  };
}

function allLegislaturesNewestFirst() {
  return uniqueBy(Object.values(legislatureCatalog), (legislature) => legislature.id).sort((a, b) => b.startsOn.localeCompare(a.startsOn));
}

async function loadHtml(url: string): Promise<string> {
  const fixture = flag("fixture");
  if (fixture) {
    return readFile(path.join(repoRoot, "packages/ingest/src/fixtures", fixture), "utf8");
  }
  return fetchOfficialSource(url);
}

async function existingMandateCount(legislatureId: string, chamber: "senate" | "deputies"): Promise<number> {
  if (!process.env.DATABASE_URL) return 0;
  const session = createDbSession();
  try {
    const rows = await session.db.execute<{ count: number }>(sql`
      select count(*)::int as count
      from member_mandates
      where legislature_id = ${legislatureId}
        and chamber = ${chamber}
    `);
    return Number(rows[0]?.count ?? 0);
  } finally {
    await session.close();
  }
}

async function fetchWithFailureSnapshot(url: string, parser: string): Promise<string> {
  try {
    return await fetchOfficialSource(url, 3);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const snapshot = snapshotFor(parser, url, message, "failed", message);
    await writeImport(`${parser}-failed`, { sourceSnapshot: snapshot, error: message }, message);
    throw error;
  }
}

async function fetchOptional(url: string, parser: string): Promise<string | undefined> {
  try {
    return await fetchWithFailureSnapshot(url, parser);
  } catch {
    return undefined;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R | undefined>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      if (!current) continue;
      const result = await task(current);
      if (result) results.push(result);
    }
  });
  await Promise.all(workers);
  return results;
}

async function writeImport(name: string, payload: unknown, raw: string) {
  if (hasFlag("no-files") || process.env.VERCEL === "1") {
    console.log(`Skipped local file output for ${name}`);
    return;
  }
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const importDir = path.join(repoRoot, "data/imports");
  const snapshotDir = path.join(repoRoot, "data/snapshots");
  await mkdir(importDir, { recursive: true });
  await mkdir(snapshotDir, { recursive: true });
  await writeFile(path.join(importDir, `${now}-${name}.json`), JSON.stringify(payload, null, 2));
  await writeFile(path.join(snapshotDir, `${now}-${name}.html`), raw);
  console.log(`Wrote ${name} import at ${now}`);
}

async function writeJsonReport(name: string, payload: unknown): Promise<boolean> {
  if (hasFlag("no-files") || process.env.VERCEL === "1") {
    console.log(`Skipped local file output for ${name}`);
    return false;
  }
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const importDir = path.join(repoRoot, "data/imports");
  await mkdir(importDir, { recursive: true });
  await writeFile(path.join(importDir, `${now}-${name}.json`), JSON.stringify(payload, null, 2));
  console.log(`Wrote ${name} report at ${now}`);
  return true;
}

async function writeCdepHistoryWarningFiles(result: Awaited<ReturnType<typeof importCdepHistoryProfiles>>) {
  if (hasFlag("no-files") || process.env.VERCEL === "1") return;
  const warnings = result.chambers.flatMap((chamber) => chamber.warningItems);
  if (warnings.length === 0) return;
  const reportsDir = path.join(repoRoot, "data/cdep-history/reports");
  const suffix = result.legislature.replace(/[^0-9A-Za-z-]+/g, "-");
  const jsonPath = path.join(reportsDir, `manual-warning-review-${suffix}.json`);
  const csvPath = path.join(reportsDir, `manual-warning-review-${suffix}.csv`);
  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: result.source,
        legislature: result.legislature,
        count: warnings.length,
        warnings
      },
      null,
      2
    )
  );
  await writeFile(csvPath, warningCsv(warnings));
  console.log(`Wrote CDEP manual warning review files: ${jsonPath} and ${csvPath}`);
}

function compactCdepHistoryImportResult(result: Awaited<ReturnType<typeof importCdepHistoryProfiles>>) {
  return {
    ...result,
    chambers: result.chambers.map((chamber) => ({
      ...chamber,
      warningItems: chamber.warningItems.length
    }))
  };
}

function warningCsv(warnings: Awaited<ReturnType<typeof importCdepHistoryProfiles>>["chambers"][number]["warningItems"]): string {
  const headers = [
    "type",
    "legislature",
    "chamber",
    "memberName",
    "officialId",
    "profileKey",
    "profileUrl",
    "validationDateRaw",
    "partyLabels",
    "groupLabels",
    "note"
  ];
  return [
    headers.join(","),
    ...warnings.map((warning) =>
      [
        warning.type,
        warning.legislature,
        warning.chamber,
        warning.memberName,
        warning.officialId,
        warning.profileKey,
        warning.profileUrl,
        warning.validationDateRaw ?? "",
        warning.partyLabels.join(" | "),
        warning.groupLabels.join(" | "),
        warning.note
      ]
        .map(csvCell)
        .join(",")
    )
  ].join("\n");
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function syncOptions() {
  const years = flag("years")
    ?.split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value));
  return {
    years: years && years.length > 0 ? years : undefined,
    maxImports: numberFlag("max-imports"),
    maxRetries: numberFlag("max-retries"),
    discoveryLimit: numberFlag("discovery-limit"),
    chamber: chamberFlag(),
    kind: kindFlag(),
    deputiesVoteDates: listFlag("deputies-vote-dates"),
    deputiesVoteMonths: numberListFlag("deputies-vote-months"),
    senateFrom: numberFlag("senate-from"),
    senateTo: numberFlag("senate-to"),
    senatePrefixes: senatePrefixesFlag(),
    officialId: flag("official-id"),
    sourceUrl: flag("source-url")
  };
}

async function reclassifyBillDocuments(options: { year?: number; limit?: number; persist?: boolean }) {
  const session = createDbSession();
  try {
    const filters = [
      "d.url like '%cdep.ro%'",
      options.year ? `(d.url like '%/${options.year}/%' or d.url like '%?${options.year}/%')` : undefined
    ].filter(Boolean);
    const query = `
      select d.id, d.bill_id, d.label, d.url, d.document_kind
      from documents d
      where ${filters.join(" and ")}
      order by d.bill_id, d.id
      ${options.limit ? `limit ${Math.max(1, options.limit)}` : ""}
    `;
    const rows = await session.db.execute<{
      id: string;
      bill_id: string;
      label: string;
      url: string;
      document_kind: string;
    }>(sql.raw(query));
    const changes = rows
      .map((row) => {
        const nextKind = classifyDeputiesDocumentKind(`${row.label} ${row.url}`);
        return {
          id: row.id,
          billId: row.bill_id,
          previousKind: row.document_kind,
          nextKind,
          url: row.url
        };
      })
      .filter((change) => change.nextKind !== change.previousKind);

    if (options.persist) {
      for (const change of changes) {
        await session.db
          .update(schema.documents)
          .set({ documentKind: change.nextKind })
          .where(eq(schema.documents.id, change.id));
      }
    }

    return {
      scanned: rows.length,
      changed: changes.length,
      persisted: Boolean(options.persist),
      sample: changes.slice(0, 25)
    };
  } finally {
    await session.close();
  }
}

function compactBillTextBatchResult(result: Awaited<ReturnType<typeof importBillTextBatch>>) {
  return {
    filters: result.filters,
    candidates: result.candidates,
    stored: result.stored,
    unsupported: result.unsupported,
    failed: result.failed,
    missing: result.missing,
    dryRun: result.dryRun,
    sample: result.rows.slice(0, 10).map((row) => ({
      documentId: row.documentId,
      billId: row.billId,
      previousTextStatus: row.previousTextStatus,
      result: row.result
    }))
  };
}

function numberFlag(name: string): number | undefined {
  const value = flag(name);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function listFlag(name: string): string[] | undefined {
  const value = flag(name);
  if (!value) return undefined;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function numberListFlag(name: string): number[] | undefined {
  const values = listFlag(name)
    ?.map((value) => Number(value))
    .filter((value) => Number.isInteger(value));
  return values && values.length > 0 ? values : undefined;
}

function senatePrefixesFlag(): Array<"B" | "BP" | "L" | "PLX"> | undefined {
  const value = flag("senate-prefixes");
  if (!value) return undefined;
  const prefixes = value
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item): item is "B" | "BP" | "L" | "PLX" => ["B", "BP", "L", "PLX"].includes(item));
  return prefixes.length > 0 ? prefixes : undefined;
}

function chamberFlag(): "senate" | "deputies" | undefined {
  const value = flag("chamber");
  return value === "senate" || value === "deputies" ? value : undefined;
}

function assetTypeFlag(): AssetType | undefined {
  const value = flag("asset-type");
  return value === "photo" || value === "party_logo" || value === "cv" || value === "bill_text" ? value : undefined;
}

function resolveRepoPath(value: string): string {
  return path.isAbsolute(value) ? value : path.join(repoRoot, value);
}

function loadLocalEnv() {
  for (const file of [path.join(repoRoot, ".env"), path.join(repoRoot, ".env.local"), path.join(repoRoot, "apps/web/.env.local")]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (!key || process.env[key] !== undefined) continue;
      process.env[key] = rawValue?.replace(/^['"]|['"]$/g, "") ?? "";
    }
  }
}

function kindFlag(): "bill" | "vote" | undefined {
  const value = flag("kind");
  return value === "bill" || value === "vote" ? value : undefined;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
