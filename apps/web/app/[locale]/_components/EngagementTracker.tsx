"use client";

import { useEffect } from "react";
import type { AppLocale } from "@/lib/i18n";

export function EngagementTracker({
  entityType,
  entityId,
  locale
}: {
  entityType: "member" | "bill" | "vote" | "party";
  entityId: string;
  locale: AppLocale;
}) {
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/engagement/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entityType, entityId, locale }),
      signal: controller.signal
    }).catch(() => undefined);
    return () => controller.abort();
  }, [entityId, entityType, locale]);

  return null;
}

export function SearchEngagementTracker({
  entityType,
  query,
  locale
}: {
  entityType: "member" | "bill" | "vote";
  query?: string;
  locale: AppLocale;
}) {
  useEffect(() => {
    if (!query?.trim()) return;
    const controller = new AbortController();
    fetch("/api/engagement/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entityType, query, locale }),
      signal: controller.signal
    }).catch(() => undefined);
    return () => controller.abort();
  }, [entityType, locale, query]);

  return null;
}
