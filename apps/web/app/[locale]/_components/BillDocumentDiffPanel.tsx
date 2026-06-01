import type { DocumentComparison } from "@cumsevoteaza/parliament-model";
import type { AppLocale } from "@/lib/i18n";

export function BillDocumentDiffPanel({
  comparisons,
  locale
}: {
  comparisons: DocumentComparison[];
  locale: AppLocale;
}) {
  const labels = diffLabels[locale];
  if (comparisons.length === 0) return null;

  return (
    <section className="border border-slate-300 bg-white">
      <details>
        <summary className="cursor-pointer border-b border-slate-300 px-4 py-3 font-semibold text-slate-950">
          {labels.title}
        </summary>
        <div className="p-4">
          <p className="text-sm text-slate-600">{labels.note}</p>
          <div className="mt-4 space-y-4">
            {comparisons.map((comparison) => (
              <div key={`${comparison.from.documentId}-${comparison.to.documentId}`} className="border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-semibold">{comparison.from.documentKind}</span>
                  {" -> "}
                  <span className="font-semibold">{comparison.to.documentKind}</span>
                  <span className="ml-2 text-slate-500">
                    +{comparison.added} / -{comparison.removed} / {labels.changed}: {comparison.changed} / {labels.unchanged}: {comparison.unchanged}
                  </span>
                </div>
                <div className="divide-y divide-slate-200">
                  {comparison.sections.filter((section) => section.status !== "unchanged").slice(0, 8).map((section) => (
                    <div key={section.key} className="px-3 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={statusClass(section.status)}>{labels.status[section.status]}</span>
                        <span className="font-medium text-slate-950">{section.heading}</span>
                      </div>
                      {section.wordDiff ? (
                        <p className="mt-2 leading-7">
                          {section.wordDiff.map((token, index) => (
                            <span key={index} className={token.type === "added" ? "bg-emerald-100 text-emerald-900" : token.type === "removed" ? "bg-red-100 text-red-900 line-through" : ""}>
                              {token.value}{" "}
                            </span>
                          ))}
                        </p>
                      ) : (
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          {section.before ? <p className="border border-red-100 bg-red-50 p-2 leading-6 text-slate-700">{section.before}</p> : null}
                          {section.after ? <p className="border border-emerald-100 bg-emerald-50 p-2 leading-6 text-slate-700">{section.after}</p> : null}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </details>
    </section>
  );
}

function statusClass(status: string): string {
  if (status === "added") return "border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold uppercase text-emerald-800";
  if (status === "removed") return "border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold uppercase text-red-800";
  return "border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold uppercase text-amber-800";
}

const diffLabels = {
  ro: {
    title: "Ce s-a schimbat",
    note: "Comparație automată pe secțiuni extrase din textele derivate. Pentru citare, verificați documentele oficiale.",
    changed: "modificate",
    unchanged: "neschimbate",
    status: {
      added: "adăugat",
      removed: "eliminat",
      changed: "modificat",
      unchanged: "neschimbat"
    }
  },
  en: {
    title: "What changed",
    note: "Automatic section comparison from derived text. Use official documents for citation.",
    changed: "changed",
    unchanged: "unchanged",
    status: {
      added: "added",
      removed: "removed",
      changed: "changed",
      unchanged: "unchanged"
    }
  }
} satisfies Record<AppLocale, {
  title: string;
  note: string;
  changed: string;
  unchanged: string;
  status: Record<"added" | "removed" | "changed" | "unchanged", string>;
}>;
