import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { runDailySync } from "@cumsevoteaza/ingest";
import { CACHE_TAGS } from "@/lib/server-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const maxImports = numberParam(request, "maxImports") ?? 5;
  const summary = await runDailySync({ maxImports });
  const status = summary.failed > 0 || summary.errors.length > 0 ? 207 : 200;
  revalidatePublicReadTags();

  return NextResponse.json(
    {
      ok: status === 200,
      summary
    },
    { status }
  );
}

function revalidatePublicReadTags() {
  for (const tag of Object.values(CACHE_TAGS)) {
    revalidateTag(tag, "max");
  }
}

function numberParam(request: Request, name: string): number | undefined {
  const value = new URL(request.url).searchParams.get(name);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
