"use client";

import { useState, useTransition } from "react";
import { TrendingUp } from "lucide-react";

export function HotButton({
  entityType,
  entityId,
  initialCount,
  label = "Public interest"
}: {
  entityType: "bill" | "vote";
  entityId: string;
  initialCount: number;
  label?: string;
}) {
  const [count, setCount] = useState(initialCount);
  const [active, setActive] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending || active}
      onClick={() => {
        startTransition(async () => {
          const response = await fetch("/api/reactions/hot", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ entityType, entityId })
          });
          if (!response.ok && response.status !== 202) return;
          const payload = await response.json().catch(() => undefined) as { count?: number } | undefined;
          if (typeof payload?.count === "number") setCount(payload.count);
          setActive(true);
        });
      }}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${
        active ? "border-blue-800 bg-blue-800 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-blue-800 hover:text-blue-800"
      }`}
      aria-label={`${label}: ${count}`}
    >
      <TrendingUp size={14} aria-hidden="true" />
      {label} {count}
    </button>
  );
}
