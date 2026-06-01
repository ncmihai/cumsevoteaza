import { NextResponse } from "next/server";
import { searchBillText } from "@/lib/bill-text-features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const query = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ bill: id, query, results: await searchBillText(id, query) });
}
