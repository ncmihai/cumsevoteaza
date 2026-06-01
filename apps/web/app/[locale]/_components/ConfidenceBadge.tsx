import type { SourceConfidence } from "@/lib/source-confidence";
import { confidenceClass, confidenceLabel } from "@/lib/source-confidence";
import type { AppLocale } from "@/lib/i18n";

export function ConfidenceBadge({ confidence, locale }: { confidence: SourceConfidence; locale: AppLocale }) {
  return (
    <span className={`inline-flex items-center border px-2 py-1 text-xs font-semibold uppercase ${confidenceClass(confidence)}`}>
      {confidenceLabel(confidence, locale)}
    </span>
  );
}
