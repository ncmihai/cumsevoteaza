import { NextResponse } from "next/server";
import { getDataHealthData } from "@/lib/data-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getDataHealthData());
}
