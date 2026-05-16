import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseChamberNominalVote } from "./parsers/chamber-vote";
import { parseSenateBill } from "./parsers/senate-bill";
import { parseSenateVote } from "./parsers/senate-vote";
import { fetchOfficialSource } from "./fetch-source";
import { snapshotFor } from "./parsers/utils";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

async function main() {
  const command = process.argv[2];

  if (command === "senate:bill") {
    const cod = flag("cod") ?? "27035";
    const url = flag("url") ?? `https://www.senat.ro/Legis/Lista.aspx?cod=${cod}`;
    const html = await loadHtml(url);
    await writeImport("senate-bill", parseSenateBill(html, url), html);
    return;
  }

  if (command === "senate:vote") {
    const url =
      flag("url") ??
      "https://www.senat.ro/VoturiPlenDetaliu.aspx?AppID=EF4EE11F-7327-4C71-9B76-2CB5C930E88C&Cod=27035&Data=2025-10-27";
    const html = await loadHtml(url);
    await writeImport("senate-vote", parseSenateVote(html, url), html);
    return;
  }

  if (command === "chamber:vote") {
    const url = flag("url") ?? "http://www.cdep.ro/pls/steno/evot2015.Nominal?idv=35953";
    try {
      const html = await loadHtml(url);
      await writeImport("chamber-vote", parseChamberNominalVote(html, url), html);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const snapshot = snapshotFor("chamber-nominal-vote", url, message, "failed", message);
      await writeImport("chamber-vote-failed", { sourceSnapshot: snapshot, error: message }, message);
    }
    return;
  }

  throw new Error(`Unknown command: ${command ?? "(missing)"}`);
}

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function loadHtml(url: string): Promise<string> {
  const fixture = flag("fixture");
  if (fixture) {
    return readFile(path.join(repoRoot, "packages/ingest/src/fixtures", fixture), "utf8");
  }
  return fetchOfficialSource(url);
}

async function writeImport(name: string, payload: unknown, raw: string) {
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const importDir = path.join(repoRoot, "data/imports");
  const snapshotDir = path.join(repoRoot, "data/snapshots");
  await mkdir(importDir, { recursive: true });
  await mkdir(snapshotDir, { recursive: true });
  await writeFile(path.join(importDir, `${now}-${name}.json`), JSON.stringify(payload, null, 2));
  await writeFile(path.join(snapshotDir, `${now}-${name}.html`), raw);
  console.log(`Wrote ${name} import at ${now}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
