import { sql } from "drizzle-orm";
import { createDbSession } from "@cumsevoteaza/db";
import type { ChamberId } from "@cumsevoteaza/parliament-model";
import { findOfficialIdentifiers } from "./parsers/identifiers";
import { normalizeText } from "./current-legislature-audit";

export interface DossierReconciliationAuditOptions {
  legislatureId?: string;
  chamber?: ChamberId;
  sampleLimit?: number;
}

export interface DossierReconciliationAuditResult {
  legislature: {
    id: string;
    label: string;
    startsOn: string;
    endsOn: string;
  };
  filters: {
    chamber?: ChamberId;
    sampleLimit: number;
  };
  counts: {
    bills: number;
    votes: number;
    importedDiscoveries: number;
    billsWithoutProcedureSteps: number;
    billsWithoutDocuments: number;
    documentsWithStoredText: number;
    unmatchedImportedDiscoveries: number;
    duplicateIdentifierGroups: number;
    unlinkedVotes: number;
    unlinkedVotesWithCandidateBills: number;
    weakVoteTitles: number;
  };
  sections: {
    billsMissingDossierData: MissingDossierBill[];
    duplicateIdentifierGroups: DuplicateIdentifierGroup[];
    unmatchedImportedDiscoveries: UnmatchedDiscovery[];
    unlinkedVotes: UnlinkedVote[];
    weakVoteTitles: WeakVote[];
  };
}

interface LegislatureRow extends Record<string, unknown> {
  id: string;
  label: string;
  starts_on: string;
  ends_on: string;
}

interface DiscoveryRow extends Record<string, unknown> {
  id: string;
  chamber: ChamberId;
  kind: "bill" | "vote";
  source_url: string;
  official_id: string | null;
  title: string | null;
  discovered_on: string | null;
  status: "pending" | "imported" | "partial" | "failed" | "skipped";
  last_error: string | null;
}

interface BillRow extends Record<string, unknown> {
  id: string;
  slug: string;
  title: string;
  identifiers: Record<string, string>;
  chamber_of_origin: ChamberId | "unknown";
  submitted_on: string | null;
  latest_event_on: string | null;
  source_status: string | null;
  source_urls: string[];
  procedure_steps: number;
  documents: number;
  documents_with_stored_text: number;
}

interface VoteRow extends Record<string, unknown> {
  id: string;
  bill_id: string | null;
  chamber: ChamberId;
  title: string;
  held_on: string;
  source_url: string | null;
  source_status: string | null;
  for_count: number;
  against: number;
  abstention: number;
  present_not_voting: number;
  absent: number | null;
  bill_title: string | null;
  bill_identifiers: Record<string, string> | null;
}

interface BillCandidate {
  id: string;
  title: string;
  identifiers: Record<string, string>;
  chamber: string;
  reason: string;
  sourceUrls?: string[];
}

interface MissingDossierBill {
  id: string;
  title: string;
  identifiers: Record<string, string>;
  chamber: string;
  submittedOn: string | null;
  latestEventOn: string | null;
  procedureSteps: number;
  documents: number;
  sourceUrls: string[];
  action: string;
}

interface DuplicateIdentifierGroup {
  key: string;
  rows: Array<{
    id: string;
    title: string;
    chamber: string;
    submittedOn: string | null;
    latestEventOn: string | null;
    sourceUrls: string[];
  }>;
  action: string;
}

interface UnmatchedDiscovery {
  id: string;
  kind: "bill" | "vote";
  chamber: ChamberId;
  officialId: string | null;
  title: string | null;
  discoveredOn: string | null;
  sourceUrl: string;
  candidates: BillCandidate[];
  action: string;
}

interface UnlinkedVote {
  id: string;
  title: string;
  chamber: ChamberId;
  heldOn: string;
  sourceUrl: string | null;
  extractedIdentifiers: string[];
  candidates: BillCandidate[];
  action: string;
}

interface WeakVote {
  id: string;
  title: string;
  chamber: ChamberId;
  heldOn: string;
  billId: string | null;
  linkedBillTitle: string | null;
  extractedIdentifiers: string[];
  candidates: BillCandidate[];
  action: string;
}

export async function auditDossierReconciliation(
  options: DossierReconciliationAuditOptions = {}
): Promise<DossierReconciliationAuditResult> {
  const sampleLimit = options.sampleLimit ?? 25;
  const legislature = await loadLegislature(options.legislatureId);
  const [discoveries, bills, votes] = await Promise.all([
    loadDiscoveries(legislature, options.chamber),
    loadBills(legislature, options.chamber),
    loadVotes(legislature, options.chamber)
  ]);

  const importedDiscoveries = discoveries.filter((discovery) => discovery.status === "imported" || discovery.status === "partial");
  const unmatchedDiscoveries = importedDiscoveries.filter((discovery) => !discoveryHasMatch(discovery, bills, votes));
  const unlinkedVotes = votes.filter((vote) => !vote.bill_id);
  const weakVotes = votes.filter((vote) => isWeakVoteTitle(vote.title));

  return {
    legislature: {
      id: legislature.id,
      label: legislature.label,
      startsOn: legislature.starts_on,
      endsOn: legislature.ends_on
    },
    filters: {
      chamber: options.chamber,
      sampleLimit
    },
    counts: {
      bills: bills.length,
      votes: votes.length,
      importedDiscoveries: importedDiscoveries.length,
      billsWithoutProcedureSteps: bills.filter((bill) => bill.procedure_steps === 0).length,
      billsWithoutDocuments: bills.filter((bill) => bill.documents === 0).length,
      documentsWithStoredText: bills.reduce((sum, bill) => sum + bill.documents_with_stored_text, 0),
      unmatchedImportedDiscoveries: unmatchedDiscoveries.length,
      duplicateIdentifierGroups: duplicateIdentifierGroups(bills).length,
      unlinkedVotes: unlinkedVotes.length,
      unlinkedVotesWithCandidateBills: unlinkedVotes.filter((vote) => candidatesForVote(vote, bills).length > 0).length,
      weakVoteTitles: weakVotes.length
    },
    sections: {
      billsMissingDossierData: billsMissingDossierData(bills, sampleLimit),
      duplicateIdentifierGroups: duplicateIdentifierGroups(bills).slice(0, sampleLimit),
      unmatchedImportedDiscoveries: unmatchedDiscoveries.slice(0, sampleLimit).map((discovery) => ({
        id: discovery.id,
        kind: discovery.kind,
        chamber: discovery.chamber,
        officialId: discovery.official_id,
        title: discovery.title,
        discoveredOn: discovery.discovered_on,
        sourceUrl: discovery.source_url,
        candidates: candidatesForDiscovery(discovery, bills, votes).slice(0, 5),
        action:
          discovery.kind === "bill"
            ? "Check whether this discovery should point at an existing canonical bill, or import/reimport the official bill page."
            : "Check whether this vote source URL was canonicalized differently, then link or reimport the vote only if no DB row exists."
      })),
      unlinkedVotes: unlinkedVotes.slice(0, sampleLimit).map((vote) => ({
        id: vote.id,
        title: vote.title,
        chamber: vote.chamber,
        heldOn: vote.held_on,
        sourceUrl: vote.source_url,
        extractedIdentifiers: extractedIdentifierValues(`${vote.title} ${vote.source_url ?? ""}`),
        candidates: candidatesForVote(vote, bills).slice(0, 5),
        action:
          candidatesForVote(vote, bills).length > 0
            ? "Candidate bill found. Review before linking vote.bill_id so procedural votes do not get attached to the wrong dossier."
            : "No candidate bill from identifier/title. Likely procedural or source-limited; keep unlinked unless official context says otherwise."
      })),
      weakVoteTitles: weakVotes.slice(0, sampleLimit).map((vote) => ({
        id: vote.id,
        title: vote.title,
        chamber: vote.chamber,
        heldOn: vote.held_on,
        billId: vote.bill_id,
        linkedBillTitle: vote.bill_title,
        extractedIdentifiers: extractedIdentifierValues(`${vote.title} ${vote.source_url ?? ""}`),
        candidates: candidatesForVote(vote, bills).slice(0, 5),
        action: vote.bill_id
          ? "Do not overwrite raw vote title; display linked bill title/context beside this weak/procedural title."
          : "Try to link by identifier first; otherwise treat as procedural."
      }))
    }
  };
}

async function loadLegislature(legislatureId?: string): Promise<LegislatureRow> {
  const session = createDbSession();
  try {
    const rows = await session.db.execute<LegislatureRow>(sql`
      select id, label, starts_on, ends_on
      from legislatures
      where ${legislatureId ? sql`id = ${legislatureId}` : sql`starts_on <= current_date and ends_on >= current_date`}
      order by starts_on desc
      limit 1
    `);
    const row = rows[0];
    if (!row) throw new Error(`No legislature found${legislatureId ? ` for ${legislatureId}` : ""}.`);
    return row;
  } finally {
    await session.close();
  }
}

async function loadDiscoveries(legislature: LegislatureRow, chamber?: ChamberId): Promise<DiscoveryRow[]> {
  const session = createDbSession();
  try {
    return await session.db.execute<DiscoveryRow>(sql`
      select id, chamber, kind, source_url, official_id, title, discovered_on, status, last_error
      from source_discoveries
      where discovered_on >= ${legislature.starts_on}
        and discovered_on < ${legislature.ends_on}
        ${chamber ? sql`and chamber = ${chamber}` : sql``}
      order by discovered_on desc nulls last, last_seen_at desc
    `);
  } finally {
    await session.close();
  }
}

async function loadBills(legislature: LegislatureRow, chamber?: ChamberId): Promise<BillRow[]> {
  const session = createDbSession();
  try {
    return await session.db.execute<BillRow>(sql`
      select
        b.id,
        b.slug,
        b.title,
        b.identifiers,
        b.chamber_of_origin,
        bvs.submitted_on,
        bvs.latest_event_on,
        bvs.source_status,
        coalesce(array_agg(distinct ss.source_url) filter (where ss.source_url is not null), '{}')::text[] as source_urls,
        count(distinct bps.id)::int as procedure_steps,
        count(distinct d.id)::int as documents,
        count(distinct d.id) filter (where d.text_status = 'stored')::int as documents_with_stored_text
      from bills b
      left join bill_vote_summaries bvs on bvs.bill_id = b.id
      left join lateral jsonb_array_elements_text(b.source_snapshot_ids) as sid(id) on true
      left join source_snapshots ss on ss.id = sid.id
      left join bill_procedure_steps bps on bps.bill_id = b.id
      left join documents d on d.bill_id = b.id
      where coalesce(bvs.submitted_on, bvs.latest_event_on) >= ${legislature.starts_on}
        and coalesce(bvs.submitted_on, bvs.latest_event_on) < ${legislature.ends_on}
        ${chamber ? sql`and (b.chamber_of_origin = ${chamber} or b.identifiers ? ${chamber})` : sql``}
      group by b.id, b.slug, b.title, b.identifiers, b.chamber_of_origin, bvs.submitted_on, bvs.latest_event_on, bvs.source_status
      order by coalesce(bvs.submitted_on, bvs.latest_event_on) desc nulls last, b.id
    `);
  } finally {
    await session.close();
  }
}

async function loadVotes(legislature: LegislatureRow, chamber?: ChamberId): Promise<VoteRow[]> {
  const session = createDbSession();
  try {
    return await session.db.execute<VoteRow>(sql`
      select
        v.id,
        v.bill_id,
        v.chamber,
        v.title,
        v.held_on,
        ss.source_url,
        ss.status as source_status,
        v.for_count,
        v.against,
        v.abstention,
        v.present_not_voting,
        v.absent,
        b.title as bill_title,
        b.identifiers as bill_identifiers
      from votes v
      left join source_snapshots ss on ss.id = v.source_snapshot_id
      left join bills b on b.id = v.bill_id
      where v.held_on >= ${legislature.starts_on}
        and v.held_on < ${legislature.ends_on}
        ${chamber ? sql`and v.chamber = ${chamber}` : sql``}
      order by v.held_on desc, v.id
    `);
  } finally {
    await session.close();
  }
}

function billsMissingDossierData(bills: BillRow[], sampleLimit: number): MissingDossierBill[] {
  return bills
    .filter((bill) => bill.procedure_steps === 0 || bill.documents === 0)
    .filter((bill) => Boolean(bill.identifiers?.deputies) || bill.source_urls.some((url) => /cdep\.ro.*proiecte/i.test(url)))
    .slice(0, sampleLimit)
    .map((bill) => ({
      id: bill.id,
      title: bill.title,
      identifiers: bill.identifiers ?? {},
      chamber: bill.chamber_of_origin,
      submittedOn: bill.submitted_on,
      latestEventOn: bill.latest_event_on,
      procedureSteps: bill.procedure_steps,
      documents: bill.documents,
      sourceUrls: bill.source_urls,
      action: "Import or reimport the CDEP bill dossier page; do not infer steps from vote titles."
    }));
}

function duplicateIdentifierGroups(bills: BillRow[]): DuplicateIdentifierGroup[] {
  const groups = new Map<string, BillRow[]>();
  for (const bill of bills) {
    for (const [kind, value] of Object.entries(bill.identifiers ?? {})) {
      const key = `${kind}:${value}`;
      groups.set(key, [...(groups.get(key) ?? []), bill]);
    }
  }
  return Array.from(groups.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({
      key,
      rows: rows.map((bill) => ({
        id: bill.id,
        title: bill.title,
        chamber: bill.chamber_of_origin,
        submittedOn: bill.submitted_on,
        latestEventOn: bill.latest_event_on,
        sourceUrls: bill.source_urls
      })),
      action: "Review as one legislative lifecycle before merging. Preserve Senate and Deputies identifiers on the canonical bill."
    }));
}

function discoveryHasMatch(discovery: DiscoveryRow, bills: BillRow[], votes: VoteRow[]): boolean {
  if (discovery.kind === "vote") {
    return votes.some((vote) => sameUrl(vote.source_url, discovery.source_url));
  }
  return bills.some(
    (bill) =>
      (discovery.official_id && Object.values(bill.identifiers ?? {}).includes(discovery.official_id)) ||
      bill.source_urls.some((url) => sameUrl(url, discovery.source_url))
  );
}

function candidatesForDiscovery(discovery: DiscoveryRow, bills: BillRow[], votes: VoteRow[]): BillCandidate[] {
  if (discovery.kind === "vote") {
    const vote = votes.find((item) => sameUrl(item.source_url, discovery.source_url));
    if (vote?.bill_id) {
      const bill = bills.find((item) => item.id === vote.bill_id);
      return bill ? [billCandidate(bill, "vote source already links to this bill")] : [];
    }
  }
  const text = `${discovery.official_id ?? ""} ${discovery.title ?? ""} ${discovery.source_url}`;
  return candidatesFromText(text, bills);
}

function candidatesForVote(vote: VoteRow, bills: BillRow[]): BillCandidate[] {
  return candidatesFromText(`${vote.title} ${vote.source_url ?? ""}`, bills);
}

function candidatesFromText(text: string, bills: BillRow[]): BillCandidate[] {
  const identifiers = extractedIdentifierValues(text);
  const candidates: BillCandidate[] = [];
  for (const bill of bills) {
    const values = Object.values(bill.identifiers ?? {});
    const matchingIdentifier = values.find((value) => identifiers.includes(value));
    if (matchingIdentifier) {
      candidates.push(billCandidate(bill, `identifier match: ${matchingIdentifier}`));
      continue;
    }
    const normalizedTitle = normalizeText(bill.title);
    const normalizedInput = normalizeText(text);
    if (normalizedTitle.length > 24 && normalizedInput.includes(normalizedTitle.slice(0, 80))) {
      candidates.push(billCandidate(bill, "normalized title prefix appears in source text"));
    }
  }
  return uniqueCandidates(candidates);
}

function billCandidate(bill: BillRow, reason: string): BillCandidate {
  return {
    id: bill.id,
    title: bill.title,
    identifiers: bill.identifiers ?? {},
    chamber: bill.chamber_of_origin,
    reason,
    sourceUrls: bill.source_urls
  };
}

function extractedIdentifierValues(text: string): string[] {
  const year = text.match(/\b(20\d{2}|19\d{2})\b/)?.[1];
  return findOfficialIdentifiers(text, year ? Number(year) : undefined).map((identifier) => identifier.value);
}

function isWeakVoteTitle(title: string): boolean {
  const normalized = normalizeText(title);
  return (
    normalized.length < 18 ||
    /^(chamber vote|senate vote|vot|vot final|vot electronic|proiect de hotarare)$/i.test(normalized) ||
    /\bama\s*\d+\b/i.test(normalized)
  );
}

function sameUrl(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean(left && right && normalizeUrl(left) === normalizeUrl(right));
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/^http:\/\//i, "https://").replace(/&idl=1\b/i, "");
}

function uniqueCandidates(candidates: BillCandidate[]): BillCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.id)) return false;
    seen.add(candidate.id);
    return true;
  });
}
