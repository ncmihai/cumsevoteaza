import type { DocumentTextStatus, SourceSnapshot } from "@cumsevoteaza/parliament-model";

export type SourceConfidence =
  | "official_parsed"
  | "partial_dossier"
  | "ocr_extracted"
  | "needs_review"
  | "accepted_ocr"
  | "missing_text"
  | "unsupported_text";

export function confidenceForSource(source?: SourceSnapshot, hasOpenIssue = false): SourceConfidence {
  if (hasOpenIssue) return "needs_review";
  if (source?.status === "partial" || source?.status === "failed") return "partial_dossier";
  return "official_parsed";
}

export function confidenceForDocument(input: {
  textStatus?: DocumentTextStatus;
  hasOpenIssue?: boolean;
  reviewStatus?: string;
}): SourceConfidence {
  if (input.hasOpenIssue) return "needs_review";
  if (input.textStatus === "missing") return "missing_text";
  if (input.textStatus === "unsupported" || input.textStatus === "failed") return "unsupported_text";
  if (input.textStatus === "stored" && (input.reviewStatus === "accepted" || input.reviewStatus === "reviewed")) return "accepted_ocr";
  if (input.textStatus === "stored") return "ocr_extracted";
  return "official_parsed";
}

export function confidenceLabel(confidence: SourceConfidence, locale: "ro" | "en"): string {
  const labels = {
    ro: {
      official_parsed: "oficial parsată",
      partial_dossier: "dosar parțial",
      ocr_extracted: "OCR extras",
      needs_review: "necesită revizuire",
      accepted_ocr: "OCR acceptat",
      missing_text: "text lipsă",
      unsupported_text: "text indisponibil"
    },
    en: {
      official_parsed: "official parsed",
      partial_dossier: "partial dossier",
      ocr_extracted: "OCR extracted",
      needs_review: "needs review",
      accepted_ocr: "OCR accepted",
      missing_text: "missing text",
      unsupported_text: "text unavailable"
    }
  } satisfies Record<"ro" | "en", Record<SourceConfidence, string>>;
  return labels[locale][confidence];
}

export function confidenceClass(confidence: SourceConfidence): string {
  if (confidence === "needs_review") return "border-amber-300 bg-amber-50 text-amber-800";
  if (confidence === "partial_dossier" || confidence === "unsupported_text" || confidence === "missing_text") return "border-slate-300 bg-slate-100 text-slate-700";
  if (confidence === "accepted_ocr") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (confidence === "ocr_extracted") return "border-blue-300 bg-blue-50 text-blue-800";
  return "border-teal-300 bg-teal-50 text-teal-800";
}
