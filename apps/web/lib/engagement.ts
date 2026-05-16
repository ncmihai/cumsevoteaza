import { createHash, randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export type EngagementEntityType = "member" | "bill" | "vote" | "party" | "search";
export type ReactionEntityType = "bill" | "vote";

export const VISITOR_COOKIE = "cumsevoteaza_visitor";

export function analyticsEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.ANALYTICS_SALT);
}

export function visitorHashForRequest(request: NextRequest): { visitorId: string; visitorHash: string; shouldSetCookie: boolean } | undefined {
  const salt = process.env.ANALYTICS_SALT;
  if (!salt) return undefined;

  const existing = request.cookies.get(VISITOR_COOKIE)?.value;
  const visitorId = existing && /^[a-f0-9-]{36}$/i.test(existing) ? existing : randomUUID();
  return {
    visitorId,
    visitorHash: hashValue(`${salt}:${visitorId}`),
    shouldSetCookie: !existing
  };
}

export function setVisitorCookie(response: NextResponse, visitorId: string) {
  response.cookies.set(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
}

export function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeTrackedQuery(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return normalized ? normalized.slice(0, 120) : undefined;
}

export function isEngagementEntityType(value: unknown): value is EngagementEntityType {
  return value === "member" || value === "bill" || value === "vote" || value === "party" || value === "search";
}

export function isReactionEntityType(value: unknown): value is ReactionEntityType {
  return value === "bill" || value === "vote";
}

export function isLocaleValue(value: unknown): value is "ro" | "en" {
  return value === "ro" || value === "en";
}
