import { sql } from "drizzle-orm";
import {
  dataHealthIssueKey,
  parseBillText,
  scoreOcrHealth,
  type DataHealthIssueType,
  type DataHealthReviewStatus
} from "@cumsevoteaza/parliament-model";
import * as schema from "@cumsevoteaza/db";
import { createWebDbSession } from "./server-db";

export type HealthIssueStatus = DataHealthReviewStatus;

export interface HealthCandidate {
  id: string;
  title: string;
  href?: string;
  reason: string;
}

export interface HealthIssue {
  issueKey: string;
  issueType: DataHealthIssueType;
  entityType: "document" | "vote" | "bill" | "identifier";
  entityId: string;
  title: string;
  href?: string;
  officialUrl?: string;
  reason: string;
  action: string;
  status: HealthIssueStatus;
  note?: string;
  reviewer?: string;
  reviewedAt?: string;
  candidates: HealthCandidate[];
  metrics?: Record<string, number | string>;
}

export interface DataHealthData {
  counts: {
    totalOpen: number;
    ocr: number;
    unlinkedVotes: number;
    duplicateIdentifiers: number;
    missingProcedures: number;
    weakVoteTitles: number;
    weakSectionParses: number;
  };
  sections: {
    ocr: HealthIssue[];
    unlinkedVotes: HealthIssue[];
    duplicateIdentifiers: HealthIssue[];
    missingProcedures: HealthIssue[];
    weakVoteTitles: HealthIssue[];
    weakSectionParses: HealthIssue[];
  };
}

interface ReviewRow extends Record<string, unknown> {
  issue_key: string;
  status: HealthIssueStatus;
  note: string | null;
  reviewer: string | null;
  reviewed_at: Date | string | null;
}

interface BillIndexRow extends Record<string, unknown> {
  bill_id: string;
  slug: string;
  title: string;
  identifiers: Record<string, string>;
}

interface OcrRow extends Record<string, unknown> {
  document_id: string;
  bill_id: string;
  bill_slug: string;
  bill_title: string;
  document_kind: string;
  official_url: string;
  chunk_count: number | string | null;
  text: string | null;
}

interface VoteIssueRow extends Record<string, unknown> {
  vote_id: string;
  title: string;
  chamber: string;
  held_on: string;
  source_url: string | null;
  bill_id: string | null;
  bill_title: string | null;
}

interface DuplicateIdentifierRow extends Record<string, unknown> {
  identifier_key: string;
  rows: Array<{
    id: string;
    slug: string;
    title: string;
  }>;
}

interface MissingProcedureRow extends Record<string, unknown> {
  bill_id: string;
  slug: string;
  title: string;
  identifiers: Record<string, string>;
  source_urls: string[];
  documents: number | string;
}

const MAX_ROWS = 50;

export async function getDataHealthData(): Promise<DataHealthData> {
  if (!process.env.DATABASE_URL) return emptyHealthData();
  const session = createWebDbSession();
  try {
    const [reviewRows, billRows, ocrRows, voteRows, duplicateRows, missingProcedureRows] = await Promise.all([
      session.db.execute<ReviewRow>(sql`
        select issue_key, status, note, reviewer, reviewed_at
        from data_health_reviews
      `).catch(() => []),
      loadBillIndex(session.db),
      loadOcrRows(session.db),
      loadVoteRows(session.db),
      loadDuplicateRows(session.db),
      loadMissingProcedureRows(session.db)
    ]);
    const reviews = reviewMap(reviewRows);
    const billIndex = billIndexMap(billRows);
    const ocr = ocrRows.flatMap((row) => ocrIssues(row, reviews));
    const weakSectionParses = ocrRows.flatMap((row) => weakSectionParseIssues(row, reviews)).slice(0, MAX_ROWS);
    const unlinkedVotes = voteRows
      .filter((row) => !row.bill_id)
      .slice(0, MAX_ROWS)
      .map((row) => voteIssue(row, billIndex, reviews, "vote-unlinked"));
    const weakVoteTitles = voteRows
      .filter((row) => isWeakVoteTitle(row.title))
      .slice(0, MAX_ROWS)
      .map((row) => voteIssue(row, billIndex, reviews, "weak-vote-title"));
    const duplicateIdentifiers = duplicateRows.slice(0, MAX_ROWS).map((row) => duplicateIssue(row, reviews));
    const missingProcedures = missingProcedureRows.slice(0, MAX_ROWS).map((row) => missingProcedureIssue(row, reviews));

    return {
      counts: {
        totalOpen: [...ocr, ...unlinkedVotes, ...duplicateIdentifiers, ...missingProcedures, ...weakVoteTitles, ...weakSectionParses].filter(isOpenIssue).length,
        ocr: ocr.filter(isOpenIssue).length,
        unlinkedVotes: unlinkedVotes.filter(isOpenIssue).length,
        duplicateIdentifiers: duplicateIdentifiers.filter(isOpenIssue).length,
        missingProcedures: missingProcedures.filter(isOpenIssue).length,
        weakVoteTitles: weakVoteTitles.filter(isOpenIssue).length,
        weakSectionParses: weakSectionParses.filter(isOpenIssue).length
      },
      sections: {
        ocr,
        unlinkedVotes,
        duplicateIdentifiers,
        missingProcedures,
        weakVoteTitles,
        weakSectionParses
      }
    };
  } finally {
    await session.close();
  }
}

export async function upsertDataHealthReview(input: {
  issueKey: string;
  issueType: DataHealthIssueType;
  entityType: string;
  entityId: string;
  status: DataHealthReviewStatus;
  note?: string;
  reviewer?: string;
}) {
  const session = createWebDbSession();
  const now = new Date();
  const id = `data-health-review-${input.issueKey.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
  try {
    await session.db
      .insert(schema.dataHealthReviews)
      .values({
        id,
        issueKey: input.issueKey,
        issueType: input.issueType,
        entityType: input.entityType,
        entityId: input.entityId,
        status: input.status,
        note: input.note || null,
        reviewer: input.reviewer || null,
        reviewedAt: input.status === "open" ? null : now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: schema.dataHealthReviews.issueKey,
        set: {
          issueType: input.issueType,
          entityType: input.entityType,
          entityId: input.entityId,
          status: input.status,
          note: input.note || null,
          reviewer: input.reviewer || null,
          reviewedAt: input.status === "open" ? null : now,
          updatedAt: now
        }
      });
    return { ok: true };
  } finally {
    await session.close();
  }
}

async function loadBillIndex(db: ReturnType<typeof createWebDbSession>["db"]) {
  return db.execute<BillIndexRow>(sql`
    select
      b.id as bill_id,
      b.slug,
      b.title,
      b.identifiers
    from bills b
  `);
}

async function loadOcrRows(db: ReturnType<typeof createWebDbSession>["db"]) {
  return db.execute<OcrRow>(sql`
    select
      d.id as document_id,
      d.bill_id,
      b.slug as bill_slug,
      b.title as bill_title,
      d.document_kind,
      d.url as official_url,
      count(c.id)::int as chunk_count,
      string_agg(c.text, E'\n' order by c.chunk_index) as text
    from documents d
    join bills b on b.id = d.bill_id
    left join bill_document_text_chunks c on c.document_id = d.id
    where d.text_status = 'stored'
    group by d.id, d.bill_id, b.slug, b.title, d.document_kind, d.url
    order by d.bill_id, d.id
    limit 400
  `);
}

async function loadVoteRows(db: ReturnType<typeof createWebDbSession>["db"]) {
  return db.execute<VoteIssueRow>(sql`
    select
      v.id as vote_id,
      v.title,
      v.chamber,
      v.held_on,
      ss.source_url,
      v.bill_id,
      b.title as bill_title
    from votes v
    left join source_snapshots ss on ss.id = v.source_snapshot_id
    left join bills b on b.id = v.bill_id
    order by v.held_on desc, v.id desc
    limit 800
  `);
}

async function loadDuplicateRows(db: ReturnType<typeof createWebDbSession>["db"]) {
  return db.execute<DuplicateIdentifierRow>(sql`
    with identifiers as (
      select b.id, b.slug, b.title, 'deputies:' || (b.identifiers->>'deputies') as identifier_key
      from bills b
      where b.identifiers->>'deputies' is not null
      union all
      select b.id, b.slug, b.title, 'senate:' || (b.identifiers->>'senate') as identifier_key
      from bills b
      where b.identifiers->>'senate' is not null
    )
    select
      identifier_key,
      json_agg(json_build_object('id', id, 'slug', slug, 'title', title) order by id) as rows
    from identifiers
    group by identifier_key
    having count(*) > 1
    order by identifier_key
    limit 80
  `);
}

async function loadMissingProcedureRows(db: ReturnType<typeof createWebDbSession>["db"]) {
  return db.execute<MissingProcedureRow>(sql`
    with missing as (
      select b.id, b.slug, b.title, b.identifiers, b.source_snapshot_ids, count(distinct d.id)::int as documents
      from bills b
      join documents d on d.bill_id = b.id
      where not exists (
        select 1
        from bill_procedure_steps bps
        where bps.bill_id = b.id
      )
      group by b.id, b.slug, b.title, b.identifiers, b.source_snapshot_ids
      order by b.id desc
      limit 120
    )
    select
      m.id as bill_id,
      m.slug,
      m.title,
      m.identifiers,
      coalesce((
        select array_agg(distinct ss.source_url)
        from source_snapshots ss
        where ss.id in (select jsonb_array_elements_text(m.source_snapshot_ids))
      ), '{}') as source_urls,
      m.documents
    from missing m
  `);
}

function ocrIssues(row: OcrRow, reviews: Map<string, ReviewRow>): HealthIssue[] {
  return ocrReasons(row).map((reason) => {
    const issueKey = dataHealthIssueKey({ type: "ocr", entityId: row.document_id, reason });
    return withReview({
      issueKey,
      issueType: "ocr",
      entityType: "document",
      entityId: row.document_id,
      title: row.bill_title,
      href: `/ro/bills/${row.bill_slug}`,
      officialUrl: row.official_url,
      reason,
      action: `Inspectați PDF-ul oficial și, dacă e nevoie, rulați: npm run ingest:bill-text -- --document=${row.document_id} --persist --insecure. Dacă textul este corect, marcați issue-ul accepted/reviewed.`,
      status: "open",
      candidates: [],
      metrics: ocrMetrics(row)
    }, reviews);
  });
}

function weakSectionParseIssues(row: OcrRow, reviews: Map<string, ReviewRow>): HealthIssue[] {
  const parsed = parseBillText(row.text ?? "");
  if (parsed.warnings.length === 0) return [];
  return parsed.warnings.map((warning) => {
    const issueKey = dataHealthIssueKey({ type: "weak-section-parse", entityId: row.document_id, reason: warning });
    return withReview({
      issueKey,
      issueType: "weak-section-parse",
      entityType: "document",
      entityId: row.document_id,
      title: row.bill_title,
      href: `/ro/bills/${row.bill_slug}`,
      officialUrl: row.official_url,
      reason: warning,
      action: "Verificați dacă documentul este formă completă sau raport/amendament; dacă parserul confundă structura, adăugați un caz de parser înainte de difuzare largă.",
      status: "open",
      candidates: [],
      metrics: {
        quality: parsed.quality,
        sections: parsed.sections.length,
        parserVersion: parsed.parserVersion,
        documentKind: row.document_kind
      }
    }, reviews);
  });
}

function voteIssue(row: VoteIssueRow, billIndex: BillIndexRow[], reviews: Map<string, ReviewRow>, type: "vote-unlinked" | "weak-vote-title"): HealthIssue {
  const issueKey = dataHealthIssueKey({ type, entityId: row.vote_id });
  const candidates = candidatesForVote(row, billIndex);
  return withReview({
    issueKey,
    issueType: type,
    entityType: "vote",
    entityId: row.vote_id,
    title: row.title,
    href: `/ro/votes/${row.vote_id}`,
    officialUrl: row.source_url ?? undefined,
    reason: type === "vote-unlinked" ? "Vot importat fără proiect legat." : "Titlu procedural/slab; contextul proiectului ar trebui afișat separat.",
      action: type === "vote-unlinked"
        ? candidateActionForVote(row, candidates)
        : "Păstrați titlul brut și afișați contextul proiectului legat.",
    status: "open",
    candidates,
    metrics: { heldOn: row.held_on, candidates: candidates.length }
  }, reviews);
}

function duplicateIssue(row: DuplicateIdentifierRow, reviews: Map<string, ReviewRow>): HealthIssue {
  const issueKey = dataHealthIssueKey({ type: "duplicate-bill-identifier", entityId: row.identifier_key });
  return withReview({
    issueKey,
    issueType: "duplicate-bill-identifier",
    entityType: "identifier",
    entityId: row.identifier_key,
    title: row.identifier_key,
    reason: "Mai multe proiecte au același identificator oficial.",
    action: duplicateRepairAction(row),
    status: "open",
    candidates: row.rows.map((bill) => ({ id: bill.id, title: bill.title, href: `/ro/bills/${bill.slug}`, reason: "same identifier" })),
    metrics: { rows: row.rows.length }
  }, reviews);
}

function missingProcedureIssue(row: MissingProcedureRow, reviews: Map<string, ReviewRow>): HealthIssue {
  const issueKey = dataHealthIssueKey({ type: "missing-procedure", entityId: row.bill_id });
  return withReview({
    issueKey,
    issueType: "missing-procedure",
    entityType: "bill",
    entityId: row.bill_id,
    title: row.title,
    href: `/ro/bills/${row.slug}`,
    officialUrl: row.source_urls[0],
    reason: "Proiectul are documente, dar nu are pași de procedură structurați.",
    action: `Rulați reparația punctuală: npm run repair:refresh-missing-procedure -- --bill-id=${row.bill_id} --persist`,
    status: "open",
    candidates: [],
    metrics: { documents: Number(row.documents) }
  }, reviews);
}

function withReview(issue: HealthIssue, reviews: Map<string, ReviewRow>): HealthIssue {
  const review = reviews.get(issue.issueKey);
  if (!review) return issue;
  return {
    ...issue,
    status: review.status,
    note: review.note ?? undefined,
    reviewer: review.reviewer ?? undefined,
    reviewedAt: review.reviewed_at ? new Date(review.reviewed_at).toISOString() : undefined
  };
}

function reviewMap(rows: ReviewRow[]) {
  return new Map(rows.map((row) => [row.issue_key, row]));
}

function billIndexMap(rows: BillIndexRow[]) {
  return rows;
}

function candidatesForVote(vote: VoteIssueRow, bills: BillIndexRow[]): HealthCandidate[] {
  const ids = extractedIdentifiers(`${vote.title} ${vote.source_url ?? ""}`);
  if (ids.length === 0) return [];
  return bills
    .filter((bill) => ids.some((id) => Object.values(bill.identifiers ?? {}).some((value) => normalizeIdentifier(value) === normalizeIdentifier(id))))
    .slice(0, 5)
    .map((bill) => ({ id: bill.bill_id, title: bill.title, href: `/ro/bills/${bill.slug}`, reason: "identifier match" }));
}

function candidateActionForVote(vote: VoteIssueRow, candidates: HealthCandidate[]): string {
  const first = candidates[0];
  if (!first) return "Nu există candidat puternic. Nu legați automat; inspectați sursa oficială și titlul votului.";
  return `Verificați candidatul, apoi rulați: npm run repair:link-vote-bill -- --vote-id=${vote.vote_id} --bill-id=${first.id} --persist`;
}

function duplicateRepairAction(row: DuplicateIdentifierRow): string {
  const [primary, duplicate] = row.rows;
  if (!primary || !duplicate) return "Revizuiți manual dacă este un ciclu legislativ comun sau o dublură care trebuie unită.";
  return `Generați planul fără mutații: npm run repair:duplicate-bill-plan -- --primary-bill-id=${primary.id} --duplicate-bill-id=${duplicate.id}`;
}

function ocrReasons(row: OcrRow): string[] {
  return scoreOcrHealth({ text: row.text, chunkCount: row.chunk_count }).reasons;
}

function ocrMetrics(row: OcrRow): Record<string, number> {
  return scoreOcrHealth({ text: row.text, chunkCount: row.chunk_count }).metrics;
}

function extractedIdentifiers(value: string): string[] {
  return [...new Set([...value.matchAll(/\b(?:PL-x|PLX|L|B|BP)\s*[-]?\s*\d+\/\d{4}\b/gi)].map((match) => match[0].replace(/\s+/g, " ").trim()))];
}

function normalizeIdentifier(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "").replace("plx", "pl-x");
}

function isWeakVoteTitle(title: string): boolean {
  const normalized = title.toLowerCase();
  return normalized === "vot electronic" || normalized.includes("amendament") || normalized.includes("procedur") || normalized.length < 24;
}

function isOpenIssue(issue: HealthIssue): boolean {
  return issue.status === "open";
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function emptyHealthData(): DataHealthData {
  return {
    counts: { totalOpen: 0, ocr: 0, unlinkedVotes: 0, duplicateIdentifiers: 0, missingProcedures: 0, weakVoteTitles: 0, weakSectionParses: 0 },
    sections: { ocr: [], unlinkedVotes: [], duplicateIdentifiers: [], missingProcedures: [], weakVoteTitles: [], weakSectionParses: [] }
  };
}
