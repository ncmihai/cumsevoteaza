"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate, type Bill, type BillProcedureStep, type DocumentSource } from "@cumsevoteaza/parliament-model";
import type { AppLocale } from "@/lib/i18n";
import { BillDocumentTextToggle } from "./BillDocumentTextToggle";

type VoteBillDossierLabels = {
  billDossier: string;
  decisionChamber: string;
  documents: string;
  initiators: string;
  recentProcedure: string;
  fullProcedure: string;
  showFullDossier: string;
  hideFullDossier: string;
  officialDocuments: string;
  extractedText: string;
  noExtractedText: string;
  fullBillPage: string;
  showText: string;
  hideText: string;
  loadingText: string;
  failedText: string;
  textUnavailable: string;
  chambers: Record<string, string>;
  documentKinds: Record<string, string>;
};

export function VoteBillDossierPanel({
  locale,
  bill,
  billHref,
  voteDate,
  procedureSteps,
  documents,
  sponsorNames,
  sponsorOverflowCount,
  labels
}: {
  locale: AppLocale;
  bill: Bill;
  billHref: string;
  voteDate: string;
  procedureSteps: BillProcedureStep[];
  documents: DocumentSource[];
  sponsorNames: string[];
  sponsorOverflowCount: number;
  labels: VoteBillDossierLabels;
}) {
  const [open, setOpen] = useState(false);
  const billIdentifiers = [bill.identifiers.senate, bill.identifiers.deputies].filter(Boolean).join(" / ");
  const previewSteps = procedureSteps
    .filter((step) => step.occurredOn <= voteDate)
    .slice(-3)
    .reverse();
  const documentKinds = uniqueDisplayNames(documents.flatMap((document) => (document.documentKind ? [document.documentKind] : []))).slice(0, 4);
  const storedTextDocuments = documents.filter((document) => document.textStatus === "stored");

  return (
    <section className="mt-3 max-w-5xl border border-slate-300 bg-white text-sm">
      <div className="p-4">
        <div className="text-xs font-semibold uppercase text-teal-700">{labels.billDossier}</div>
        <Link href={billHref} className="font-medium text-slate-900 underline">
          {billIdentifiers ? `${billIdentifiers} · ` : null}
          {bill.title}
        </Link>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
          {bill.status ? <span>{bill.status}</span> : null}
          {bill.decisionChamber ? <span>{labels.decisionChamber}: {labels.chambers[bill.decisionChamber] ?? bill.decisionChamber}</span> : null}
          {documents.length > 0 ? <span>{labels.documents}: {documents.length}</span> : null}
          {documentKinds.length > 0 ? (
            <span>{documentKinds.map((kind) => labels.documentKinds[kind] ?? kind).join(", ")}</span>
          ) : null}
        </div>
        {sponsorNames.length > 0 ? (
          <div className="mt-3 text-xs text-slate-700">
            <span className="font-semibold uppercase text-slate-500">{labels.initiators}</span>{" "}
            {sponsorNames.join(", ")}
            {sponsorOverflowCount > 0 ? ` +${sponsorOverflowCount}` : null}
          </div>
        ) : null}
      </div>

      {previewSteps.length > 0 ? (
        <div className="border-t border-slate-200 px-4 py-3">
          <div className="text-xs font-semibold uppercase text-slate-500">{labels.recentProcedure}</div>
          <ol className="mt-2 grid gap-2 text-xs text-slate-700">
            {previewSteps.map((step) => (
              <li key={step.id} className="grid gap-1 md:grid-cols-[7rem_1fr]">
                <span className="font-semibold text-slate-500">{formatDate(step.occurredOn, locale)}</span>
                <span>
                  <span className="font-medium text-slate-900">{step.title}</span>
                  {step.committeeName ? <span className="text-slate-500"> · {step.committeeName}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="border-t border-slate-200 p-4">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
          aria-expanded={open}
        >
          {open ? labels.hideFullDossier : labels.showFullDossier}
        </button>
      </div>

      {open ? (
        <div className="border-t border-slate-200">
          <section className="p-4">
            <div className="font-semibold text-slate-950">{labels.fullProcedure}</div>
            <ol className="mt-3 divide-y divide-slate-200 border border-slate-200">
              {procedureSteps.map((step) => (
                <li key={step.id} className="grid gap-2 md:grid-cols-[8rem_1fr]">
                  <div className="bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-600">
                    {formatDate(step.occurredOn, locale)}
                  </div>
                  <div className="px-3 py-3">
                    <div className="font-medium text-slate-950">{step.title}</div>
                    {step.description ? <div className="mt-1 text-sm leading-6 text-slate-700">{step.description}</div> : null}
                    {step.committeeName ? <div className="mt-2 text-sm font-medium text-teal-700">{step.committeeName}</div> : null}
                    <div className="mt-1 text-xs uppercase text-slate-500">{labels.chambers[step.chamber] ?? step.chamber}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="border-t border-slate-200 p-4">
            <div className="font-semibold text-slate-950">{labels.extractedText}</div>
            {storedTextDocuments.length > 0 ? (
              <div className="mt-3 grid gap-3">
                {storedTextDocuments.map((document) => (
                  <div key={document.id} className="border border-slate-200 p-3">
                    <div className="font-medium text-slate-950">{document.label}</div>
                    <div className="mt-1 text-xs uppercase text-slate-500">
                      {document.documentKind ? labels.documentKinds[document.documentKind] ?? document.documentKind : labels.documentKinds.other}
                    </div>
                    <BillDocumentTextToggle
                      documentId={document.id}
                      preview={document.textPreview}
                      labels={{
                        show: labels.showText,
                        hide: labels.hideText,
                        loading: labels.loadingText,
                        failed: labels.failedText
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">{labels.noExtractedText}</p>
            )}
          </section>

          {documents.length > 0 ? (
            <section className="border-t border-slate-200 p-4">
              <div className="font-semibold text-slate-950">{labels.officialDocuments}</div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {documents.map((document) => (
                  <a
                    key={document.id}
                    href={document.url}
                    target="_blank"
                    rel="noreferrer"
                    className="border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-950 underline">{document.label}</span>
                    <span className="mt-1 block text-xs uppercase text-slate-500">
                      {document.documentKind ? labels.documentKinds[document.documentKind] ?? document.documentKind : labels.documentKinds.other}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          <div className="border-t border-slate-200 p-4">
            <Link href={billHref} className="text-sm font-medium text-blue-800 underline">
              {labels.fullBillPage}
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function uniqueDisplayNames(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value);
  }
  return result;
}
