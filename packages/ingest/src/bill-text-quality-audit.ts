import { sql } from "drizzle-orm";
import { createDbSession } from "@cumsevoteaza/db";

export interface BillTextQualityAuditOptions {
  year?: number;
  documentKind?: string;
  limit?: number;
  suspiciousOnly?: boolean;
  minChars?: number;
}

export interface BillTextQualityAuditResult {
  filters: {
    year?: number;
    documentKind: string;
    limit: number;
    suspiciousOnly: boolean;
    minChars: number;
  };
  counts: {
    scanned: number;
    suspicious: number;
    veryShort: number;
    lowLegalVocabulary: number;
    highNoise: number;
    highRepetition: number;
    missingChunks: number;
  };
  rows: BillTextQualityRow[];
}

export interface BillTextQualityRow {
  documentId: string;
  billId: string;
  billTitle: string;
  documentKind: string;
  officialUrl: string;
  eventOn?: string;
  chunkCount: number;
  charCount: number;
  wordCount: number;
  lineCount: number;
  legalVocabularyHits: number;
  weirdCharacterRatio: number;
  repeatedLineRatio: number;
  suspiciousReasons: string[];
  preview: string;
}

interface StoredTextRow extends Record<string, unknown> {
  document_id: string;
  bill_id: string;
  bill_title: string;
  document_kind: string;
  official_url: string;
  event_on: string | null;
  chunk_count: number | string | null;
  text: string | null;
}

const legalVocabularyPatterns = [
  /\blege\b/gi,
  /\bproiect\b/gi,
  /\bord(onanta|onanța|onanţă|onan[țt]e)\b/gi,
  /\bart(icolul)?\.?\b/gi,
  /\balin\.?\b/gi,
  /\blit\.?\b/gi,
  /\bguvern/gi,
  /\bparlament/gi,
  /\bmonitorul oficial\b/gi,
  /\brom[aâ]niei\b/gi
];

export async function auditBillTextQuality(options: BillTextQualityAuditOptions = {}): Promise<BillTextQualityAuditResult> {
  const documentKind = options.documentKind ?? "proposal";
  const limit = options.limit ?? 50;
  const minChars = options.minChars ?? 500;
  const session = createDbSession();
  try {
    const rows = await session.db.execute<StoredTextRow>(sql`
      with event_dates as (
        select
          bill_id,
          min(occurred_on) as submitted_on,
          max(occurred_on) as latest_event_on
        from bill_events
        group by bill_id
      )
      select
        d.id as document_id,
        d.bill_id,
        b.title as bill_title,
        d.document_kind,
        d.url as official_url,
        coalesce(bvs.latest_event_on, bvs.submitted_on, ed.latest_event_on, ed.submitted_on) as event_on,
        count(c.id)::int as chunk_count,
        string_agg(c.text, E'\n' order by c.chunk_index) as text
      from documents d
      join bills b on b.id = d.bill_id
      left join bill_vote_summaries bvs on bvs.bill_id = b.id
      left join event_dates ed on ed.bill_id = b.id
      left join bill_document_text_chunks c on c.document_id = d.id
      where d.text_status = 'stored'
        and d.document_kind = ${documentKind}
        ${
          options.year
            ? sql`and coalesce(bvs.latest_event_on, bvs.submitted_on, ed.latest_event_on, ed.submitted_on) >= ${`${options.year}-01-01`}::date
              and coalesce(bvs.latest_event_on, bvs.submitted_on, ed.latest_event_on, ed.submitted_on) < ${`${options.year + 1}-01-01`}::date`
            : sql``
        }
      group by d.id, d.bill_id, b.title, d.document_kind, d.url, coalesce(bvs.latest_event_on, bvs.submitted_on, ed.latest_event_on, ed.submitted_on)
      order by coalesce(bvs.latest_event_on, bvs.submitted_on, ed.latest_event_on, ed.submitted_on) desc nulls last, d.bill_id, d.id
      limit ${limit}
    `);

    const auditedRows = rows.map((row) => qualityRow(row, minChars));
    const visibleRows = options.suspiciousOnly ? auditedRows.filter((row) => row.suspiciousReasons.length > 0) : auditedRows;

    return {
      filters: {
        year: options.year,
        documentKind,
        limit,
        suspiciousOnly: Boolean(options.suspiciousOnly),
        minChars
      },
      counts: {
        scanned: auditedRows.length,
        suspicious: auditedRows.filter((row) => row.suspiciousReasons.length > 0).length,
        veryShort: auditedRows.filter((row) => row.suspiciousReasons.includes("very_short_text")).length,
        lowLegalVocabulary: auditedRows.filter((row) => row.suspiciousReasons.includes("low_legal_vocabulary")).length,
        highNoise: auditedRows.filter((row) => row.suspiciousReasons.includes("high_noise_ratio")).length,
        highRepetition: auditedRows.filter((row) => row.suspiciousReasons.includes("high_repeated_line_ratio")).length,
        missingChunks: auditedRows.filter((row) => row.suspiciousReasons.includes("missing_text_chunks")).length
      },
      rows: visibleRows
    };
  } finally {
    await session.close();
  }
}

function qualityRow(row: StoredTextRow, minChars: number): BillTextQualityRow {
  const text = row.text ?? "";
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const legalVocabularyHits = legalVocabularyPatterns.reduce((sum, pattern) => sum + (text.match(pattern)?.length ?? 0), 0);
  const weirdCharacterRatio = charCount === 0 ? 1 : weirdCharacterCount(text) / charCount;
  const repeatedLineRatio = repeatedLineRatioFor(lines);
  const chunkCount = Number(row.chunk_count ?? 0);
  const suspiciousReasons = [
    chunkCount === 0 ? "missing_text_chunks" : undefined,
    charCount > 0 && charCount < minChars ? "very_short_text" : undefined,
    charCount >= minChars && legalVocabularyHits < 3 ? "low_legal_vocabulary" : undefined,
    weirdCharacterRatio > 0.08 ? "high_noise_ratio" : undefined,
    repeatedLineRatio > 0.35 && lines.length >= 12 ? "high_repeated_line_ratio" : undefined
  ].filter((reason): reason is string => Boolean(reason));

  return {
    documentId: row.document_id,
    billId: row.bill_id,
    billTitle: row.bill_title,
    documentKind: row.document_kind,
    officialUrl: row.official_url,
    eventOn: row.event_on ?? undefined,
    chunkCount,
    charCount,
    wordCount,
    lineCount: lines.length,
    legalVocabularyHits,
    weirdCharacterRatio: roundRatio(weirdCharacterRatio),
    repeatedLineRatio: roundRatio(repeatedLineRatio),
    suspiciousReasons,
    preview: text.slice(0, 320)
  };
}

function weirdCharacterCount(text: string): number {
  return [...text].filter((char) => !/[\p{L}\p{N}\s.,;:!?'"()\/\-[\]{}%+*=<>ăâîșțĂÂÎȘȚ]/u.test(char)).length;
}

function repeatedLineRatioFor(lines: string[]): number {
  if (lines.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const line of lines) {
    const normalized = line.toLowerCase();
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  const repeated = [...counts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  return repeated / lines.length;
}

function roundRatio(value: number): number {
  return Math.round(value * 10000) / 10000;
}
