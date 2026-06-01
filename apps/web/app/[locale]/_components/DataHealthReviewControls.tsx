"use client";

import { useState } from "react";
import type { DataHealthIssueType, DataHealthReviewStatus } from "@cumsevoteaza/parliament-model";

const statuses: DataHealthReviewStatus[] = ["reviewed", "ignored", "accepted", "fixed"];

export function DataHealthReviewControls({
  issue,
  labels,
  token,
  reviewer
}: {
  issue: {
    issueKey: string;
    issueType: DataHealthIssueType;
    entityType: string;
    entityId: string;
    status: DataHealthReviewStatus;
  };
  labels: {
    token: string;
    note: string;
    reviewer: string;
    save: string;
    saved: string;
    failed: string;
    missingToken: string;
  };
  token: string;
  reviewer: string;
}) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<DataHealthReviewStatus>(issue.status === "open" ? "reviewed" : issue.status);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  async function save() {
    if (!token.trim()) {
      setState("failed");
      return;
    }
    setState("saving");
    const response = await fetch("/api/data-health/reviews", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        ...issue,
        status,
        note,
        reviewer: reviewer.trim()
      })
    }).catch(() => undefined);
    setState(response?.ok ? "saved" : "failed");
  }

  return (
    <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3 text-xs sm:grid-cols-[1fr_auto]">
      <select value={status} onChange={(event) => setStatus(event.target.value as DataHealthReviewStatus)} className="border border-slate-300 px-2 py-1">
        {statuses.map((value) => (
          <option key={value} value={value}>{value}</option>
        ))}
      </select>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={labels.note}
        className="min-h-16 border border-slate-300 px-2 py-1"
      />
      <button type="button" onClick={save} className="border border-slate-950 bg-slate-950 px-3 py-1 font-medium text-white" disabled={state === "saving"}>
        {labels.save}
      </button>
      {!token.trim() ? <div className="text-slate-500 sm:col-span-2">{labels.missingToken}</div> : null}
      {state === "saved" ? <div className="text-emerald-700 sm:col-span-2">{labels.saved}</div> : null}
      {state === "failed" ? <div className="text-red-700 sm:col-span-2">{token.trim() ? labels.failed : labels.missingToken}</div> : null}
    </div>
  );
}
