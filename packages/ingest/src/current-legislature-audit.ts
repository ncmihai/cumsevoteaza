import { sql } from "drizzle-orm";
import { createDbSession } from "@cumsevoteaza/db";
import type { ChamberId } from "@cumsevoteaza/parliament-model";

export type AuditSeverity = "info" | "warning" | "error";

export interface CurrentLegislatureAuditOptions {
  legislatureId?: string;
  chamber?: ChamberId;
  sampleLimit?: number;
}

export interface AuditIssue<T = unknown> {
  severity: AuditSeverity;
  code: string;
  message: string;
  count: number;
  samples: T[];
}

export interface CurrentLegislatureAuditResult {
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
    discoveries: {
      bills: number;
      votes: number;
      importedBills: number;
      importedVotes: number;
      pendingBills: number;
      pendingVotes: number;
      failedBills: number;
      failedVotes: number;
    };
    database: {
      bills: number;
      votes: number;
      votesWithoutBill: number;
      votesWithNominalCoverage: number;
      votesWithGroupOnlyCoverage: number;
      votesWithResultOnlyCoverage: number;
      votesWithSourceOnlyCoverage: number;
    };
  };
  issues: AuditIssue[];
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

interface BillAuditRow extends Record<string, unknown> {
  id: string;
  slug: string;
  title: string;
  identifiers: Record<string, string>;
  chamber_of_origin: string;
  submitted_on: string | null;
  latest_event_on: string | null;
  source_status: string | null;
  source_urls: string[];
}

interface VoteAuditRow extends Record<string, unknown> {
  id: string;
  bill_id: string | null;
  chamber: ChamberId;
  title: string;
  held_on: string;
  source_url: string | null;
  source_status: string | null;
  coverage_level: string | null;
  nominal_votes: number | null;
  group_totals: number | null;
  for_count: number;
  against: number;
  abstention: number;
  present_not_voting: number;
  absent: number | null;
}

export async function auditCurrentLegislature(options: CurrentLegislatureAuditOptions = {}): Promise<CurrentLegislatureAuditResult> {
  const sampleLimit = options.sampleLimit ?? 25;
  const legislature = await loadLegislature(options.legislatureId);
  const [discoveries, bills, votes] = await Promise.all([
    loadDiscoveries(legislature, options.chamber),
    loadBills(legislature, options.chamber),
    loadVotes(legislature, options.chamber)
  ]);

  const issues: AuditIssue[] = [
    discoveryCoverageIssue(discoveries, bills, votes, sampleLimit),
    duplicateBillIdentifierIssue(bills, sampleLimit),
    duplicateBillFingerprintIssue(bills, sampleLimit),
    duplicateVoteFingerprintIssue(votes, sampleLimit),
    votesWithoutBillIssue(votes, sampleLimit),
    weakVoteTitleIssue(votes, sampleLimit),
    partialCoverageIssue(votes, sampleLimit)
  ].filter((issue): issue is AuditIssue => Boolean(issue));

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
      discoveries: discoveryCounts(discoveries),
      database: {
        bills: bills.length,
        votes: votes.length,
        votesWithoutBill: votes.filter((vote) => !vote.bill_id).length,
        votesWithNominalCoverage: votes.filter((vote) => vote.coverage_level === "nominal").length,
        votesWithGroupOnlyCoverage: votes.filter((vote) => vote.coverage_level === "group_totals").length,
        votesWithResultOnlyCoverage: votes.filter((vote) => vote.coverage_level === "result_only").length,
        votesWithSourceOnlyCoverage: votes.filter((vote) => vote.coverage_level === "source_only" || !vote.coverage_level).length
      },
    },
    issues
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

async function loadBills(legislature: LegislatureRow, chamber?: ChamberId): Promise<BillAuditRow[]> {
  const session = createDbSession();
  try {
    return await session.db.execute<BillAuditRow>(sql`
      select
        b.id,
        b.slug,
        b.title,
        b.identifiers,
        b.chamber_of_origin,
        bvs.submitted_on,
        bvs.latest_event_on,
        bvs.source_status,
        coalesce(array_agg(distinct ss.source_url) filter (where ss.source_url is not null), '{}')::text[] as source_urls
      from bills b
      left join bill_vote_summaries bvs on bvs.bill_id = b.id
      left join lateral jsonb_array_elements_text(b.source_snapshot_ids) as sid(id) on true
      left join source_snapshots ss on ss.id = sid.id
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

async function loadVotes(legislature: LegislatureRow, chamber?: ChamberId): Promise<VoteAuditRow[]> {
  const session = createDbSession();
  try {
    return await session.db.execute<VoteAuditRow>(sql`
      select
        v.id,
        v.bill_id,
        v.chamber,
        v.title,
        v.held_on,
        ss.source_url,
        ss.status as source_status,
        vcs.coverage_level,
        vcs.nominal_votes,
        vcs.group_totals,
        v.for_count,
        v.against,
        v.abstention,
        v.present_not_voting,
        v.absent
      from votes v
      left join source_snapshots ss on ss.id = v.source_snapshot_id
      left join vote_coverage_summaries vcs on vcs.vote_id = v.id
      where v.held_on >= ${legislature.starts_on}
        and v.held_on < ${legislature.ends_on}
        ${chamber ? sql`and v.chamber = ${chamber}` : sql``}
      order by v.held_on desc, v.id
    `);
  } finally {
    await session.close();
  }
}

function discoveryCounts(discoveries: DiscoveryRow[]) {
  const by = (kind: DiscoveryRow["kind"], status?: DiscoveryRow["status"]) =>
    discoveries.filter((discovery) => discovery.kind === kind && (!status || discovery.status === status)).length;
  return {
    bills: by("bill"),
    votes: by("vote"),
    importedBills: by("bill", "imported"),
    importedVotes: by("vote", "imported"),
    pendingBills: by("bill", "pending"),
    pendingVotes: by("vote", "pending"),
    failedBills: by("bill", "failed"),
    failedVotes: by("vote", "failed")
  };
}

function discoveryCoverageIssue(discoveries: DiscoveryRow[], bills: BillAuditRow[], votes: VoteAuditRow[], sampleLimit: number): AuditIssue | undefined {
  const billOfficialIds = new Set(bills.flatMap((bill) => Object.values(bill.identifiers ?? {})));
  const billSourceUrls = new Set(bills.flatMap((bill) => bill.source_urls.map(normalizeUrl)));
  const voteSourceUrls = new Set(votes.map((vote) => vote.source_url).filter((url): url is string => Boolean(url)).map(normalizeUrl));

  const unmatched = discoveries
    .filter((discovery) => discovery.status === "imported" || discovery.status === "partial")
    .filter((discovery) => {
      if (discovery.kind === "bill") {
        return !(discovery.official_id && billOfficialIds.has(discovery.official_id)) && !billSourceUrls.has(normalizeUrl(discovery.source_url));
      }
      return !voteSourceUrls.has(normalizeUrl(discovery.source_url));
    });
  const samples = unmatched.slice(0, sampleLimit).map((discovery) => pickDiscovery(discovery));

  return samples.length
    ? {
        severity: "warning",
        code: "imported_discovery_without_db_match",
        message: "Imported/partial discoveries without a high-confidence DB match by official identifier or source URL.",
        count: unmatched.length,
        samples
      }
    : undefined;
}

function duplicateBillIdentifierIssue(bills: BillAuditRow[], sampleLimit: number): AuditIssue | undefined {
  const entries = bills.flatMap((bill) =>
    Object.entries(bill.identifiers ?? {}).map(([kind, value]) => ({
      key: `${kind}:${value}`,
      kind,
      value,
      billId: bill.id,
      title: bill.title,
      chamber: bill.chamber_of_origin
    }))
  );
  const duplicates = duplicated(entries, (entry) => entry.key).slice(0, sampleLimit);
  return duplicates.length
    ? {
        severity: "error",
        code: "duplicate_bill_identifier",
        message: "Multiple bills share the same official identifier key.",
        count: duplicates.length,
        samples: duplicates
      }
    : undefined;
}

function duplicateBillFingerprintIssue(bills: BillAuditRow[], sampleLimit: number): AuditIssue | undefined {
  const fingerprints = bills.map((bill) => ({
    key: [bill.chamber_of_origin, bill.submitted_on ?? bill.latest_event_on ?? "unknown", normalizeText(bill.title)].join("|"),
    billId: bill.id,
    title: bill.title,
    chamber: bill.chamber_of_origin,
    date: bill.submitted_on ?? bill.latest_event_on
  }));
  const duplicates = duplicated(fingerprints, (entry) => entry.key).slice(0, sampleLimit);
  return duplicates.length
    ? {
        severity: "warning",
        code: "duplicate_bill_title_date_chamber",
        message: "Multiple bills share the same normalized title/date/chamber fingerprint.",
        count: duplicates.length,
        samples: duplicates
      }
    : undefined;
}

function duplicateVoteFingerprintIssue(votes: VoteAuditRow[], sampleLimit: number): AuditIssue | undefined {
  const fingerprints = votes.map((vote) => ({
    key: [
      vote.chamber,
      vote.held_on,
      normalizeText(vote.title),
      vote.for_count,
      vote.against,
      vote.abstention,
      vote.present_not_voting,
      vote.absent ?? "unknown"
    ].join("|"),
    voteId: vote.id,
    title: vote.title,
    chamber: vote.chamber,
    heldOn: vote.held_on,
    sourceUrl: vote.source_url
  }));
  const duplicates = duplicated(fingerprints, (entry) => entry.key).slice(0, sampleLimit);
  return duplicates.length
    ? {
        severity: "warning",
        code: "duplicate_vote_title_date_chamber_totals",
        message: "Multiple votes share the same normalized title/date/chamber/totals fingerprint.",
        count: duplicates.length,
        samples: duplicates
      }
    : undefined;
}

function votesWithoutBillIssue(votes: VoteAuditRow[], sampleLimit: number): AuditIssue | undefined {
  const samples = votes.filter((vote) => !vote.bill_id).slice(0, sampleLimit).map(pickVote);
  return samples.length
    ? {
        severity: "warning",
        code: "vote_without_linked_bill",
        message: "Votes imported without a linked bill. These need title/identifier reconciliation.",
        count: votes.filter((vote) => !vote.bill_id).length,
        samples
      }
    : undefined;
}

function weakVoteTitleIssue(votes: VoteAuditRow[], sampleLimit: number): AuditIssue | undefined {
  const weak = votes.filter((vote) => {
    const normalized = normalizeText(vote.title);
    return normalized.length < 18 || /^(chamber vote|senate vote|vot|vot final|vot electronic|proiect de hotarare)$/i.test(normalized);
  });
  const samples = weak.slice(0, sampleLimit).map(pickVote);
  return samples.length
    ? {
        severity: "warning",
        code: "weak_vote_title",
        message: "Votes with weak/generic subjects. These should be reconciled against bill title, official page title, or source context.",
        count: weak.length,
        samples
      }
    : undefined;
}

function partialCoverageIssue(votes: VoteAuditRow[], sampleLimit: number): AuditIssue | undefined {
  const partial = votes.filter((vote) => vote.coverage_level !== "nominal");
  const samples = partial.slice(0, sampleLimit).map(pickVote);
  return samples.length
    ? {
        severity: "info",
        code: "non_nominal_vote_coverage",
        message: "Votes without nominal coverage. This may be expected for some old/source-limited votes, but should be explicit.",
        count: partial.length,
        samples
      }
    : undefined;
}

function duplicated<T>(items: T[], keyFor: (item: T) => string): Array<{ key: string; rows: T[] }> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    if (!key || key.includes("unknown") || key.endsWith("|")) continue;
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return Array.from(map.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({ key, rows }));
}

function pickDiscovery(discovery: DiscoveryRow) {
  return {
    id: discovery.id,
    kind: discovery.kind,
    chamber: discovery.chamber,
    officialId: discovery.official_id,
    title: discovery.title,
    discoveredOn: discovery.discovered_on,
    status: discovery.status,
    sourceUrl: discovery.source_url,
    lastError: discovery.last_error
  };
}

function pickVote(vote: VoteAuditRow) {
  return {
    id: vote.id,
    billId: vote.bill_id,
    chamber: vote.chamber,
    title: vote.title,
    heldOn: vote.held_on,
    sourceUrl: vote.source_url,
    coverageLevel: vote.coverage_level,
    nominalVotes: vote.nominal_votes,
    totals: {
      for: vote.for_count,
      against: vote.against,
      abstention: vote.abstention,
      presentNotVoting: vote.present_not_voting,
      absent: vote.absent
    }
  };
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/^http:\/\//i, "https://").replace(/&idl=1\b/i, "");
}
