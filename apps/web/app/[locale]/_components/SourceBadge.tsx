import { ExternalLink } from "lucide-react";
import type { SourceSnapshot } from "@cumsevoteaza/parliament-model";

export function SourceBadge({ source, label }: { source: SourceSnapshot; label: string }) {
  return (
    <a
      href={source.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
    >
      <ExternalLink size={16} aria-hidden="true" />
      {label}
    </a>
  );
}
