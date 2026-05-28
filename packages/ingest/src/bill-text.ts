import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { createDbSession } from "@cumsevoteaza/db";
import * as schema from "@cumsevoteaza/db";
import type { BillDocumentTextChunk, DocumentTextStatus } from "@cumsevoteaza/parliament-model";
import { uploadDerivedAsset } from "./asset-import";

const execFileAsync = promisify(execFile);

export type BillTextImportOptions = {
  billId?: string;
  documentId?: string;
  documentKind?: string;
  persist?: boolean;
  timeoutMs?: number;
  insecure?: boolean;
};

export async function importBillText(options: BillTextImportOptions) {
  if (!options.billId && !options.documentId) {
    throw new Error("ingest:bill-text requires --bill=<bill-id> or --document=<document-id>.");
  }

  const session = createDbSession();
  try {
    const document = await selectDocument(session.db, options);
    if (!document) {
      return { status: "missing" as const, documentId: options.documentId, billId: options.billId, reason: "No matching document found." };
    }

    if (!options.persist) {
      return {
        status: "dry_run" as const,
        documentId: document.id,
        billId: document.billId,
        documentKind: document.documentKind,
        officialUrl: document.url
      };
    }

    const now = new Date();
    const extraction = await fetchAndExtractPdfText(document.url, {
      timeoutMs: options.timeoutMs ?? 30_000,
      insecure: Boolean(options.insecure)
    });
    if (extraction.status !== "stored") {
      await updateDocumentTextStatus(session.db, document.id, extraction.status, undefined, undefined, now);
      return {
        status: extraction.status,
        documentId: document.id,
        billId: document.billId,
        error: extraction.error
      };
    }

    const text = cleanExtractedText(extraction.text);
    const chunks = chunkText(text).map((chunk, index): BillDocumentTextChunk => ({
      id: `bill-text-chunk-${document.id}-${index}`,
      documentId: document.id,
      billId: document.billId,
      chunkIndex: index,
      text: chunk
    }));
    const bytes = Buffer.from(text, "utf8");
    const contentHash = createHash("sha256").update(bytes).digest("hex");
    const object = await uploadDerivedAsset({
      objectPath: `parliament-assets/bill-text/${document.billId}/${document.id}-${contentHash.slice(0, 16)}.txt`,
      bytes,
      mimeType: "text/plain; charset=utf-8"
    });
    const assetId = `asset-bill-text-${document.id}`;

    await session.db
      .insert(schema.storedAssets)
      .values({
        id: assetId,
        entityType: "bill_document",
        entityId: document.id,
        assetType: "bill_text",
        officialUrl: document.url,
        storageProvider: object.storageProvider,
        storagePath: object.storagePath,
        publicUrl: object.publicUrl ?? null,
        blobUrl: object.blobUrl ?? null,
        contentHash,
        mimeType: "text/plain; charset=utf-8",
        byteSize: bytes.byteLength,
        fetchStatus: "stored",
        lastAttemptAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: schema.storedAssets.id,
        set: {
          storageProvider: object.storageProvider,
          storagePath: object.storagePath,
          publicUrl: object.publicUrl ?? null,
          blobUrl: object.blobUrl ?? null,
          contentHash,
          mimeType: "text/plain; charset=utf-8",
          byteSize: bytes.byteLength,
          fetchStatus: "stored",
          lastAttemptAt: now,
          updatedAt: now
        }
      });

    await session.db.delete(schema.billDocumentTextChunks).where(eq(schema.billDocumentTextChunks.documentId, document.id));
    if (chunks.length > 0) {
      await session.db.insert(schema.billDocumentTextChunks).values(chunks);
    }
    await updateDocumentTextStatus(session.db, document.id, "stored", assetId, text.slice(0, 800), now);

    return {
      status: "stored" as const,
      documentId: document.id,
      billId: document.billId,
      assetId,
      chunks: chunks.length,
      byteSize: bytes.byteLength
    };
  } finally {
    await session.close();
  }
}

async function selectDocument(db: ReturnType<typeof createDbSession>["db"], options: BillTextImportOptions) {
  if (options.documentId) {
    return db.query.documents.findFirst({ where: eq(schema.documents.id, options.documentId) });
  }
  const rows = await db.select().from(schema.documents).where(eq(schema.documents.billId, options.billId!));
  const wantedKind = options.documentKind ?? "proposal";
  return rows.find((row) => row.documentKind === wantedKind) ?? rows[0];
}

async function fetchAndExtractPdfText(url: string, options: { timeoutMs: number; insecure: boolean }): Promise<
  | { status: "stored"; text: string }
  | { status: Exclude<DocumentTextStatus, "pending" | "stored">; error: string }
> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const previousTlsSetting = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  try {
    if (options.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const response = await fetch(url, {
      headers: { "User-Agent": "cumsevoteaza-bill-text/0.1 (+temporary PDF text extraction)" },
      signal: controller.signal
    });
    if (response.status === 404) return { status: "missing", error: "Official PDF returned 404." };
    if (!response.ok) return { status: "failed", error: `Official PDF returned HTTP ${response.status}.` };
    const bytes = Buffer.from(await response.arrayBuffer());
    const text = await extractPdfText(bytes);
    if (text.length < 40) return { status: "unsupported", error: "No useful text could be extracted from this PDF." };
    return { status: "stored", text };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : String(error) };
  } finally {
    if (options.insecure) {
      if (previousTlsSetting === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      else process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousTlsSetting;
    }
    clearTimeout(timeout);
  }
}

export function cleanExtractedText(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkText(text: string, size = 1800): string[] {
  const chunks: string[] = [];
  const normalized = cleanExtractedText(text);
  for (let index = 0; index < normalized.length; index += size) {
    chunks.push(normalized.slice(index, index + size).trim());
  }
  return chunks.filter(Boolean);
}

async function extractPdfText(bytes: Buffer): Promise<string> {
  const pythonText = await extractPdfTextWithPython(bytes);
  if (pythonText && pythonText.length > 40) return pythonText;
  const raw = bytes.toString("latin1");
  const literalStrings = [...raw.matchAll(/\(([^()]{3,1000})\)\s*Tj/g)].map((match) => decodePdfLiteral(match[1] ?? ""));
  const arrayStrings = [...raw.matchAll(/\[((?:\s*\([^()]{1,1000}\)\s*-?\d*\.?\d*)+)\]\s*TJ/g)].flatMap((match) =>
    [...(match[1] ?? "").matchAll(/\(([^()]{1,1000})\)/g)].map((part) => decodePdfLiteral(part[1] ?? ""))
  );
  return cleanExtractedText([...literalStrings, ...arrayStrings].join(" "));
}

async function extractPdfTextWithPython(bytes: Buffer): Promise<string | undefined> {
  const candidates = [
    process.env.PYTHON_BIN,
    process.env.HOME ? path.join(process.env.HOME, "miniconda3/bin/python") : undefined,
    "python3"
  ].filter(Boolean) as string[];
  const tempDir = await mkdtemp(path.join(tmpdir(), "cumvoteaza-bill-pdf-"));
  const pdfPath = path.join(tempDir, "document.pdf");
  try {
    await writeFile(pdfPath, bytes);
    for (const python of candidates) {
      if (python.includes("/") && !existsSync(python)) continue;
      try {
        const { stdout } = await execFileAsync(
          python,
          [
            "-c",
            [
              "from pypdf import PdfReader",
              "import sys",
              "reader = PdfReader(sys.argv[1])",
              "print('\\n\\n'.join((page.extract_text() or '') for page in reader.pages))"
            ].join("; "),
            pdfPath
          ],
          { maxBuffer: 20 * 1024 * 1024 }
        );
        const text = cleanExtractedText(stdout);
        if (text.length > 40) return text;
      } catch {
        continue;
      }
    }
    return undefined;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\([()\\])/g, "$1");
}

async function updateDocumentTextStatus(
  db: ReturnType<typeof createDbSession>["db"],
  documentId: string,
  status: DocumentTextStatus,
  textAssetId: string | undefined,
  textPreview: string | undefined,
  now: Date
) {
  await db
    .update(schema.documents)
    .set({
      textStatus: status,
      textAssetId,
      textPreview,
      lastTextAttemptAt: now
    })
    .where(eq(schema.documents.id, documentId));
}
