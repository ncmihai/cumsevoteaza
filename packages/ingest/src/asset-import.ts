import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { createDbSession, storedAssets } from "@cumsevoteaza/db";
import type { ChamberId } from "@cumsevoteaza/parliament-model";

export type AssetType = "photo" | "party_logo" | "cv";
export type AssetEntityType = "member" | "person" | "party" | "formation" | "source_snapshot" | "pipeline_report";
export type StoredAssetStatus = "pending" | "stored" | "failed" | "missing" | "official_timeout";

export type AssetInventoryItem = {
  id: string;
  assetType: AssetType;
  entityType: AssetEntityType;
  entityId: string;
  legislature?: string;
  legislatureId?: string;
  chamber?: ChamberId;
  officialUrl: string;
  sourceProfileUrl?: string;
  sourceSnapshotContentHash?: string;
};

export type AssetImportOptions = {
  assetsPath: string;
  assetType?: AssetType;
  legislature?: string;
  limit?: number;
  maxUniqueOfficialUrls?: number;
  uniqueOfficialUrlOffset?: number;
  persist?: boolean;
  timeoutMs?: number;
  delayMs?: number;
  insecure?: boolean;
};

export type AssetImportSummary = {
  source: string;
  persist: boolean;
  selected: number;
  attempted: number;
  stored: number;
  skipped: number;
  missing: number;
  officialTimeout: number;
  failed: number;
  failures: Array<{ id: string; officialUrl: string; status: StoredAssetStatus; error?: string }>;
};

export async function importStoredAssetsFromInventory(options: AssetImportOptions): Promise<AssetImportSummary> {
  const items = selectAssetInventoryItemsForImport(await readAssetInventory(options.assetsPath), options);
  const summary: AssetImportSummary = {
    source: options.assetsPath,
    persist: Boolean(options.persist),
    selected: items.length,
    attempted: 0,
    stored: 0,
    skipped: 0,
    missing: 0,
    officialTimeout: 0,
    failed: 0,
    failures: []
  };

  if (!options.persist) return summary;

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required for assets:import --persist.");
  }

  const session = createDbSession();
  const resultByOfficialUrl = new Map<string, StoredAssetResult>();
  let processed = 0;
  try {
    for (const item of items) {
      processed += 1;
      const existing = await session.db.query.storedAssets.findFirst({
        where: eq(storedAssets.id, item.id)
      });
      if (existing?.fetchStatus === "stored" && existing.blobUrl) {
        summary.skipped += 1;
        if (processed % 100 === 0 || processed === items.length) {
          logAssetImportProgress(processed, items.length, summary);
        }
        continue;
      }

      summary.attempted += 1;
      let result = resultByOfficialUrl.get(item.officialUrl);
      if (!result) {
        result = await fetchAndStoreAsset(item, token, options.timeoutMs ?? 20_000, Boolean(options.insecure));
        resultByOfficialUrl.set(item.officialUrl, result);
        if (options.delayMs && options.delayMs > 0) {
          await sleep(options.delayMs);
        }
      }
      await upsertAsset(session.db, item, result);
      if (result.status === "stored") summary.stored += 1;
      else if (result.status === "missing") summary.missing += 1;
      else if (result.status === "official_timeout") summary.officialTimeout += 1;
      else summary.failed += 1;
      if (result.status !== "stored") {
        summary.failures.push({
          id: item.id,
          officialUrl: item.officialUrl,
          status: result.status,
          error: result.error
        });
      }
      if (processed % 100 === 0 || processed === items.length) {
        logAssetImportProgress(processed, items.length, summary);
      }
    }
  } finally {
    await session.close();
  }

  return summary;
}

function logAssetImportProgress(processed: number, total: number, summary: AssetImportSummary) {
  console.log(
    `assets:import progress ${processed}/${total} processed, ${summary.attempted} attempted, ` +
      `${summary.stored} stored, ${summary.skipped} skipped, ${summary.failed} failed`
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readAssetInventory(assetsPath: string): Promise<AssetInventoryItem[]> {
  const raw = await readFile(assetsPath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AssetInventoryItem)
    .filter((item) => Boolean(item.id && item.entityId && item.assetType && item.officialUrl));
}

export function selectAssetInventoryItems(items: AssetInventoryItem[], options: Pick<AssetImportOptions, "assetType" | "legislature" | "limit">) {
  const selected = items.filter((item) => {
    if (options.assetType && item.assetType !== options.assetType) return false;
    if (options.legislature) {
      const normalized = options.legislature.startsWith("leg-") ? options.legislature : `leg-${options.legislature}`;
      const itemLegislature = item.legislatureId ?? (item.legislature ? `leg-${item.legislature}` : "");
      if (!itemLegislature.startsWith(normalized)) return false;
    }
    return true;
  });
  return options.limit && options.limit > 0 ? selected.slice(0, options.limit) : selected;
}

export function selectAssetInventoryItemsForImport(
  items: AssetInventoryItem[],
  options: Pick<AssetImportOptions, "assetType" | "legislature" | "limit" | "maxUniqueOfficialUrls" | "uniqueOfficialUrlOffset">
) {
  const selected = selectAssetInventoryItems(items, options);
  if (!options.maxUniqueOfficialUrls || options.maxUniqueOfficialUrls <= 0) return selected;

  const offset = Math.max(0, options.uniqueOfficialUrlOffset ?? 0);
  const uniqueUrls: string[] = [];
  const seen = new Set<string>();
  for (const item of selected) {
    if (seen.has(item.officialUrl)) continue;
    seen.add(item.officialUrl);
    uniqueUrls.push(item.officialUrl);
  }
  const allowed = new Set(uniqueUrls.slice(offset, offset + options.maxUniqueOfficialUrls));
  return selected.filter((item) => allowed.has(item.officialUrl));
}

type StoredAssetResult = {
  status: StoredAssetStatus;
  blobUrl?: string;
  contentHash?: string;
  mimeType?: string;
  byteSize?: number;
  error?: string;
};

async function fetchAndStoreAsset(item: AssetInventoryItem, token: string, timeoutMs: number, insecure: boolean): Promise<StoredAssetResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const previousTlsSetting = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  try {
    if (insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const response = await fetch(normalizeOfficialAssetUrl(item.officialUrl), {
      headers: { "User-Agent": "cumsevoteaza-asset-import/0.1 (+local asset backup)" },
      signal: controller.signal
    });
    if (response.status === 404) {
      return { status: "missing", error: "Official asset returned 404." };
    }
    if (!response.ok) {
      return { status: "failed", error: `Official asset returned HTTP ${response.status}.` };
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const contentHash = createHash("sha256").update(bytes).digest("hex");
    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || mimeTypeFromUrl(item.officialUrl);
    const blob = await put(blobPathFor(item, contentHash, mimeType), bytes, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: mimeType,
      token
    });
    return {
      status: "stored",
      blobUrl: blob.url,
      contentHash,
      mimeType,
      byteSize: bytes.byteLength
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { status: "official_timeout", error: `Timed out after ${timeoutMs}ms.` };
    }
    return { status: "failed", error: errorMessageWithCause(error) };
  } finally {
    if (insecure) {
      if (previousTlsSetting === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      else process.env.NODE_TLS_REJECT_UNAUTHORIZED = previousTlsSetting;
    }
    clearTimeout(timeout);
  }
}

function normalizeOfficialAssetUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.hostname === "cdep.ro") parsed.hostname = "www.cdep.ro";
  return parsed.toString();
}

function errorMessageWithCause(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? `: ${error.cause.message}` : "";
  return `${error.message}${cause}`;
}

async function upsertAsset(
  db: ReturnType<typeof createDbSession>["db"],
  item: AssetInventoryItem,
  result: StoredAssetResult
) {
  const now = new Date();
  await db
    .insert(storedAssets)
    .values({
      id: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      assetType: item.assetType,
      legislatureId: item.legislatureId || null,
      chamber: item.chamber || null,
      officialUrl: item.officialUrl,
      blobUrl: result.blobUrl ?? null,
      contentHash: result.contentHash ?? null,
      mimeType: result.mimeType ?? null,
      byteSize: result.byteSize ?? null,
      fetchStatus: result.status,
      lastAttemptAt: now,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: storedAssets.id,
      set: {
        blobUrl: result.blobUrl ?? null,
        contentHash: result.contentHash ?? null,
        mimeType: result.mimeType ?? null,
        byteSize: result.byteSize ?? null,
        fetchStatus: result.status,
        lastAttemptAt: now,
        updatedAt: now
      }
    });
}

function blobPathFor(item: AssetInventoryItem, contentHash: string, mimeType: string): string {
  const section = item.assetType === "party_logo" ? "party-logos" : item.assetType === "cv" ? "cvs" : "photos";
  const legislature = safePathSegment(item.legislatureId || item.legislature || "unknown");
  const chamber = safePathSegment(item.chamber || "unknown");
  const entity = safePathSegment(item.entityId);
  return `parliament-assets/${section}/${entity}/${legislature}-${chamber}-${contentHash.slice(0, 16)}${extensionFor(item.officialUrl, mimeType)}`;
}

function extensionFor(url: string, mimeType: string): string {
  const fromUrl = path.extname(new URL(url).pathname).toLowerCase();
  if (fromUrl && fromUrl.length <= 8) return fromUrl;
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "application/pdf") return ".pdf";
  return ".bin";
}

function mimeTypeFromUrl(url: string): string {
  const extension = path.extname(new URL(url).pathname).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".gif") return "image/gif";
  if (extension === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

function safePathSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}
