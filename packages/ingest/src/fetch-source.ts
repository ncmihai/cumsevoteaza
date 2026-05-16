import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fetchCandidateUrls } from "./official-urls";

const execFileAsync = promisify(execFile);

export async function fetchOfficialSource(url: string, attempts = 2): Promise<string> {
  let lastError: unknown;

  for (const candidateUrl of fetchCandidateUrls(url)) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);
        const response = await fetch(candidateUrl, {
          signal: controller.signal,
          headers: {
            "user-agent": "cumsevoteaza-ingest/0.1 (+private research)"
          }
        });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        return await response.text();
      } catch (error) {
        lastError = error;
        if (isCertificateError(error)) {
          return fetchWithCurl(candidateUrl);
        }
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown fetch error");
}

async function fetchWithCurl(url: string): Promise<string> {
  const { stdout } = await execFileAsync("curl", [
    "-L",
    "--max-time",
    "30",
    "-A",
    "cumsevoteaza-ingest/0.1 (+private research)",
    "-s",
    url
  ]);
  return stdout;
}

function isCertificateError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = (error as Error & { cause?: { code?: string; message?: string } }).cause;
  return (
    error.message.includes("fetch failed") &&
    Boolean(cause?.code?.includes("UNABLE_TO_VERIFY") || cause?.message?.includes("certificate"))
  );
}
