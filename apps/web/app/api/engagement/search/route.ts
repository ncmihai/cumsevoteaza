import { NextRequest, NextResponse } from "next/server";
import { createDbSession } from "@cumsevoteaza/db";
import * as schema from "@cumsevoteaza/db";
import {
  analyticsEnabled,
  hashValue,
  isEngagementEntityType,
  isLocaleValue,
  normalizeTrackedQuery,
  setVisitorCookie,
  visitorHashForRequest
} from "@/lib/engagement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!analyticsEnabled()) {
    return NextResponse.json({ ok: false, disabled: true }, { status: 202 });
  }

  const body = await request.json().catch(() => undefined) as { entityType?: unknown; query?: unknown; locale?: unknown } | undefined;
  const query = normalizeTrackedQuery(body?.query);
  if (!body || !isEngagementEntityType(body.entityType) || body.entityType === "search" || !query) {
    return NextResponse.json({ error: "Invalid search event" }, { status: 400 });
  }

  const visitor = visitorHashForRequest(request);
  if (!visitor) return NextResponse.json({ ok: false, disabled: true }, { status: 202 });

  const session = createDbSession();
  try {
    await session.db.insert(schema.engagementEvents).values({
      id: crypto.randomUUID(),
      eventType: "search",
      entityType: body.entityType,
      queryHash: hashValue(query),
      queryText: query,
      locale: isLocaleValue(body.locale) ? body.locale : "ro",
      visitorHash: visitor.visitorHash,
      occurredAt: new Date()
    });
  } finally {
    await session.close();
  }

  const response = NextResponse.json({ ok: true });
  if (visitor.shouldSetCookie) setVisitorCookie(response, visitor.visitorId);
  return response;
}
