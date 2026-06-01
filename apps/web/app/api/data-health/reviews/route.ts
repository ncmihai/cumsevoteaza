import { NextResponse } from "next/server";
import {
  isDataHealthReviewStatus,
  type DataHealthIssueType
} from "@cumsevoteaza/parliament-model";
import { upsertDataHealthReview } from "@/lib/data-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const issueTypes = new Set(["ocr", "vote-unlinked", "duplicate-bill-identifier", "missing-procedure", "weak-vote-title", "weak-section-parse"]);

export async function POST(request: Request) {
  const secret = process.env.DATA_HEALTH_REVIEW_TOKEN;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => undefined) as Partial<{
    issueKey: string;
    issueType: DataHealthIssueType;
    entityType: string;
    entityId: string;
    status: string;
    note: string;
    reviewer: string;
  }> | undefined;
  if (!body?.issueKey || !body.issueType || !body.entityType || !body.entityId || !isDataHealthReviewStatus(body.status)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!issueTypes.has(body.issueType)) {
    return NextResponse.json({ error: "Invalid issue type" }, { status: 400 });
  }

  await upsertDataHealthReview({
    issueKey: body.issueKey,
    issueType: body.issueType,
    entityType: body.entityType,
    entityId: body.entityId,
    status: body.status,
    note: body.note,
    reviewer: body.reviewer
  });

  return NextResponse.json({ ok: true });
}
