import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

export type LocalDataCleanupOptions = {
  repoRoot: string;
  confirm?: boolean;
  includeSystemJunk?: boolean;
  includeImports?: boolean;
  includeSnapshots?: boolean;
  includeCdepRaw?: boolean;
  includePipelineRaw?: boolean;
  includeParsed?: boolean;
  keepDays?: number;
  keepLatest?: number;
};

export type LocalDataCleanupCandidate = {
  path: string;
  category: LocalDataCleanupCategory;
  bytes: number;
  modifiedAt?: string;
  selected: boolean;
  reason: string;
};

export type LocalDataCleanupCategory =
  | "system_junk"
  | "import_logs"
  | "snapshots"
  | "cdep_raw"
  | "pipeline_raw"
  | "parsed_artifacts";

export type LocalDataCleanupResult = {
  dryRun: boolean;
  options: {
    keepDays: number;
    keepLatest: number;
    selectedCategories: LocalDataCleanupCategory[];
  };
  candidates: LocalDataCleanupCandidate[];
  summary: Array<{
    category: LocalDataCleanupCategory;
    candidates: number;
    selected: number;
    bytes: number;
    selectedBytes: number;
  }>;
  deleted?: {
    files: number;
    bytes: number;
  };
};

type FileEntry = {
  absolutePath: string;
  relativePath: string;
  bytes: number;
  mtimeMs: number;
  modifiedAt: string;
};

export async function cleanupLocalData(options: LocalDataCleanupOptions): Promise<LocalDataCleanupResult> {
  const keepDays = options.keepDays ?? 7;
  const keepLatest = options.keepLatest ?? 20;
  const selectedCategories = selectedCategoriesFor(options);
  const candidates = [
    ...(await systemJunkCandidates(options.repoRoot, selectedCategories)),
    ...(await ageBasedCandidates({
      repoRoot: options.repoRoot,
      dir: "data/imports",
      category: "import_logs",
      selectedCategories,
      keepDays,
      keepLatest,
      extension: ".json",
      reason: "Generated importer reports are rebuildable/debug artifacts."
    })),
    ...(await ageBasedCandidates({
      repoRoot: options.repoRoot,
      dir: "data/snapshots",
      category: "snapshots",
      selectedCategories,
      keepDays,
      keepLatest,
      extension: ".html",
      reason: "Generated raw HTML snapshots are rebuildable/debug artifacts."
    })),
    ...(await treeCandidates({
      repoRoot: options.repoRoot,
      dir: "data/cdep-history/raw",
      category: "cdep_raw",
      selectedCategories,
      reason: "Raw CDEP crawl files are local pipeline artifacts; parsed outputs and DB rows are the working data."
    })),
    ...(await treeCandidates({
      repoRoot: options.repoRoot,
      dir: "data/parliament-pipeline/tribunal-registry/raw",
      category: "pipeline_raw",
      selectedCategories,
      reason: "Raw Tribunal pipeline downloads are local source-review artifacts."
    })),
    ...(await parsedCandidates(options.repoRoot, selectedCategories))
  ].sort((a, b) => a.path.localeCompare(b.path));

  let deleted: LocalDataCleanupResult["deleted"];
  if (options.confirm) {
    let files = 0;
    let bytes = 0;
    for (const candidate of candidates.filter((item) => item.selected)) {
      await rm(path.join(options.repoRoot, candidate.path), { recursive: true, force: true });
      files += 1;
      bytes += candidate.bytes;
    }
    deleted = { files, bytes };
  }

  return {
    dryRun: !options.confirm,
    options: {
      keepDays,
      keepLatest,
      selectedCategories
    },
    candidates,
    summary: summarizeCandidates(candidates),
    deleted
  };
}

function selectedCategoriesFor(options: LocalDataCleanupOptions): LocalDataCleanupCategory[] {
  const selected = new Set<LocalDataCleanupCategory>();
  if (options.includeSystemJunk ?? true) selected.add("system_junk");
  if (options.includeImports) selected.add("import_logs");
  if (options.includeSnapshots) selected.add("snapshots");
  if (options.includeCdepRaw) selected.add("cdep_raw");
  if (options.includePipelineRaw) selected.add("pipeline_raw");
  if (options.includeParsed) selected.add("parsed_artifacts");
  return [...selected];
}

async function systemJunkCandidates(repoRoot: string, selectedCategories: LocalDataCleanupCategory[]): Promise<LocalDataCleanupCandidate[]> {
  const files = await walk(repoRoot, {
    repoRoot,
    ignoredDirs: new Set([".git", "node_modules", ".next", "dist", "out", ".turbo"])
  });
  return files
    .filter((file) => {
      const base = path.basename(file.relativePath);
      return base === ".DS_Store" || base.endsWith(".pyc") || file.relativePath.includes("__pycache__/");
    })
    .map((file) => toCandidate(file, "system_junk", selectedCategories, "OS/editor/runtime cache file."));
}

async function ageBasedCandidates(input: {
  repoRoot: string;
  dir: string;
  category: LocalDataCleanupCategory;
  selectedCategories: LocalDataCleanupCategory[];
  keepDays: number;
  keepLatest: number;
  extension: string;
  reason: string;
}): Promise<LocalDataCleanupCandidate[]> {
  const absoluteDir = path.join(input.repoRoot, input.dir);
  const files = (await walkIfExists(absoluteDir, input.repoRoot)).filter((file) => file.relativePath.endsWith(input.extension));
  const newest = new Set(
    [...files]
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, Math.max(0, input.keepLatest))
      .map((file) => file.relativePath)
  );
  const cutoff = Date.now() - input.keepDays * 24 * 60 * 60 * 1000;
  return files.map((file) => {
    const isOld = file.mtimeMs < cutoff;
    const isKeptLatest = newest.has(file.relativePath);
    const selected = input.selectedCategories.includes(input.category) && isOld && !isKeptLatest;
    const reason = selected
      ? `${input.reason} Older than ${input.keepDays} days and outside newest ${input.keepLatest}.`
      : `${input.reason} Kept because it is recent, protected by --keep-latest, or the category was not selected.`;
    return toCandidate(file, input.category, selected ? input.selectedCategories : [], reason);
  });
}

async function treeCandidates(input: {
  repoRoot: string;
  dir: string;
  category: LocalDataCleanupCategory;
  selectedCategories: LocalDataCleanupCategory[];
  reason: string;
}): Promise<LocalDataCleanupCandidate[]> {
  const absoluteDir = path.join(input.repoRoot, input.dir);
  const files = await walkIfExists(absoluteDir, input.repoRoot);
  return files.map((file) => toCandidate(file, input.category, input.selectedCategories, input.reason));
}

async function parsedCandidates(repoRoot: string, selectedCategories: LocalDataCleanupCategory[]): Promise<LocalDataCleanupCandidate[]> {
  const files = await walkIfExists(path.join(repoRoot, "data/cdep-history/parsed"), repoRoot);
  return files.map((file) =>
    toCandidate(
      file,
      "parsed_artifacts",
      selectedCategories,
      "Parsed JSON/JSONL outputs are rebuildable from raw CDEP pipeline runs; keep unless deliberately regenerating the full pipeline."
    )
  );
}

function toCandidate(
  file: FileEntry,
  category: LocalDataCleanupCategory,
  selectedCategories: LocalDataCleanupCategory[],
  reason: string
): LocalDataCleanupCandidate {
  return {
    path: file.relativePath,
    category,
    bytes: file.bytes,
    modifiedAt: file.modifiedAt,
    selected: selectedCategories.includes(category),
    reason
  };
}

function summarizeCandidates(candidates: LocalDataCleanupCandidate[]): LocalDataCleanupResult["summary"] {
  const byCategory = new Map<LocalDataCleanupCategory, LocalDataCleanupResult["summary"][number]>();
  for (const candidate of candidates) {
    const current =
      byCategory.get(candidate.category) ??
      {
        category: candidate.category,
        candidates: 0,
        selected: 0,
        bytes: 0,
        selectedBytes: 0
      };
    current.candidates += 1;
    current.bytes += candidate.bytes;
    if (candidate.selected) {
      current.selected += 1;
      current.selectedBytes += candidate.bytes;
    }
    byCategory.set(candidate.category, current);
  }
  return [...byCategory.values()].sort((a, b) => a.category.localeCompare(b.category));
}

async function walkIfExists(dir: string, repoRoot: string): Promise<FileEntry[]> {
  try {
    return await walk(dir, { repoRoot });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function walk(
  root: string,
  options: { repoRoot?: string; ignoredDirs?: Set<string> } = {}
): Promise<FileEntry[]> {
  const repoRoot = options.repoRoot ?? root;
  const entries = await readdir(root, { withFileTypes: true });
  const files: FileEntry[] = [];
  for (const entry of entries) {
    if (options.ignoredDirs?.has(entry.name)) continue;
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(absolutePath, { ...options, repoRoot })));
      continue;
    }
    if (!entry.isFile()) continue;
    const info = await stat(absolutePath);
    files.push({
      absolutePath,
      relativePath: path.relative(repoRoot, absolutePath),
      bytes: info.size,
      mtimeMs: info.mtimeMs,
      modifiedAt: info.mtime.toISOString()
    });
  }
  return files;
}
