import { ExternalLink } from "lucide-react";
import type { SourceSnapshot } from "@cumsevoteaza/parliament-model";
import type { SourceConfidence } from "@/lib/source-confidence";
import type { AppLocale } from "@/lib/i18n";
import { ConfidenceBadge } from "./ConfidenceBadge";

export function SourceBadge({
  source,
  label,
  confidence,
  locale = "ro"
}: {
  source: SourceSnapshot;
  label: string;
  confidence?: SourceConfidence;
  locale?: AppLocale;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <a
        href={source.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
      >
        <ExternalLink size={16} aria-hidden="true" />
        {label}
      </a>
      {confidence ? <ConfidenceBadge confidence={confidence} locale={locale} /> : null}
    </span>
  );
}
