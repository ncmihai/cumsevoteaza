export type ParsedBillSectionType =
  | "article"
  | "unique_article"
  | "amendment"
  | "point"
  | "paragraph"
  | "annex"
  | "preamble"
  | "unknown";

export type BillParserWarning =
  | "empty_text"
  | "no_structural_headings"
  | "amendment_only_document"
  | "huge_section"
  | "duplicate_section_heading"
  | "too_many_short_sections";

export interface ParsedBillText {
  parserVersion: string;
  quality: "good" | "partial" | "weak";
  sections: ParsedBillSection[];
  warnings: BillParserWarning[];
}

export interface ParsedBillSection {
  id: string;
  heading: string;
  normalizedHeading: string;
  sectionType: ParsedBillSectionType;
  number?: string;
  text: string;
  startOffset: number;
  endOffset: number;
}

const PARSER_VERSION = "bill-parser-v1";

const structuralHeadingPattern =
  /^(?<heading>(?:Articol\s+unic|Art\.?\s+(?<articleNumber>[0-9IVXLCDM]+)[¹²³]?[.)]?|Articolul\s+(?<articleWordNumber>[0-9IVXLCDM]+)[¹²³]?[.)]?|La\s+articolul\s+(?<amendmentArticle>[0-9IVXLCDM]+)[¹²³]?.*|Punctul\s+(?<pointNumber>[0-9IVXLCDM]+)[.)]?.*|Alineatul\s+\(?(?<paragraphNumber>[0-9IVXLCDM]+)\)?.*|Anexa(?:\s+nr\.?\s*(?<annexNumber>[0-9IVXLCDM]+))?.*))$/iu;

const amendmentInstructionPattern = /\b(se\s+modific[ăa]|se\s+completeaz[ăa]|se\s+abrog[ăa]|va\s+avea\s+urm[ăa]torul\s+cuprins|dup[ăa]\s+.*se\s+introduce)\b/iu;

export function parseBillText(text: string): ParsedBillText {
  const normalizedText = text.replace(/\r/g, "\n");
  if (!normalizedText.trim()) {
    return {
      parserVersion: PARSER_VERSION,
      quality: "weak",
      sections: [],
      warnings: ["empty_text"]
    };
  }

  const lines = lineOffsets(normalizedText);
  const sections: ParsedBillSection[] = [];
  let currentHeading = "Document";
  let currentType: ParsedBillSectionType = "preamble";
  let currentNumber: string | undefined;
  let currentStart = lines[0]?.start ?? 0;
  let currentLines: string[] = [];

  for (const line of lines) {
    const heading = classifyHeading(line.text);
    if (heading) {
      pushParsedSection(sections, {
        heading: currentHeading,
        sectionType: currentType,
        number: currentNumber,
        lines: currentLines,
        startOffset: currentStart,
        endOffset: line.start
      });
      currentHeading = heading.heading;
      currentType = heading.sectionType;
      currentNumber = heading.number;
      currentStart = line.start;
      currentLines = [line.text];
    } else {
      currentLines.push(line.text);
    }
  }

  pushParsedSection(sections, {
    heading: currentHeading,
    sectionType: currentType,
    number: currentNumber,
    lines: currentLines,
    startOffset: currentStart,
    endOffset: normalizedText.length
  });

  const nonPreambleSections = sections.filter((section) => section.sectionType !== "preamble");
  const warnings = parserWarnings(normalizedText, sections, nonPreambleSections);
  return {
    parserVersion: PARSER_VERSION,
    quality: warnings.length === 0 ? "good" : warnings.length <= 2 && nonPreambleSections.length > 0 ? "partial" : "weak",
    sections,
    warnings
  };
}

function lineOffsets(text: string): Array<{ text: string; start: number; end: number }> {
  const rows: Array<{ text: string; start: number; end: number }> = [];
  const pattern = /[^\n]+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const value = match[0]!.trim();
    if (!value) continue;
    rows.push({ text: value, start: match.index, end: match.index + match[0]!.length });
  }
  return rows;
}

function classifyHeading(line: string): { heading: string; sectionType: ParsedBillSectionType; number?: string } | undefined {
  const match = structuralHeadingPattern.exec(line);
  if (!match?.groups?.heading) return undefined;
  const heading = match.groups.heading.trim();
  if (/^Articol\s+unic/i.test(heading)) return { heading, sectionType: "unique_article" };
  if (match.groups.articleNumber || match.groups.articleWordNumber) {
    return { heading, sectionType: "article", number: match.groups.articleNumber ?? match.groups.articleWordNumber };
  }
  if (match.groups.amendmentArticle) return { heading, sectionType: "amendment", number: match.groups.amendmentArticle };
  if (match.groups.pointNumber) return { heading, sectionType: "point", number: match.groups.pointNumber };
  if (match.groups.paragraphNumber) return { heading, sectionType: "paragraph", number: match.groups.paragraphNumber };
  if (/^Anexa/i.test(heading)) return { heading, sectionType: "annex", number: match.groups.annexNumber };
  return { heading, sectionType: "unknown" };
}

function pushParsedSection(
  sections: ParsedBillSection[],
  input: {
    heading: string;
    sectionType: ParsedBillSectionType;
    number?: string;
    lines: string[];
    startOffset: number;
    endOffset: number;
  }
) {
  const text = input.lines.join("\n").trim();
  if (!text) return;
  const normalizedHeading = normalizeSectionHeading(input.heading);
  sections.push({
    id: `${normalizedHeading}-${sections.length + 1}`,
    heading: input.heading,
    normalizedHeading,
    sectionType: input.sectionType,
    number: input.number,
    text,
    startOffset: input.startOffset,
    endOffset: input.endOffset
  });
}

function parserWarnings(text: string, sections: ParsedBillSection[], nonPreambleSections: ParsedBillSection[]): BillParserWarning[] {
  const warnings = new Set<BillParserWarning>();
  if (nonPreambleSections.length === 0 && text.length > 700) warnings.add("no_structural_headings");
  if (nonPreambleSections.length > 0 && nonPreambleSections.every((section) => ["amendment", "point", "paragraph"].includes(section.sectionType))) {
    warnings.add("amendment_only_document");
  }
  if (sections.some((section) => section.text.length > 8000)) warnings.add("huge_section");

  const headingCounts = new Map<string, number>();
  for (const section of nonPreambleSections) {
    headingCounts.set(section.normalizedHeading, (headingCounts.get(section.normalizedHeading) ?? 0) + 1);
  }
  if ([...headingCounts.values()].some((count) => count > 1)) warnings.add("duplicate_section_heading");

  const shortSections = nonPreambleSections.filter((section) => section.text.length < 80).length;
  if (nonPreambleSections.length >= 8 && shortSections / nonPreambleSections.length > 0.5) warnings.add("too_many_short_sections");

  if (nonPreambleSections.length === 0 && amendmentInstructionPattern.test(text)) warnings.add("amendment_only_document");
  return [...warnings];
}

export function normalizeSectionHeading(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "document";
}
