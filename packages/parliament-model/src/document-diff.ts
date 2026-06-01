import { parseBillText } from "./bill-parser";

export interface LegalSection {
  heading: string;
  key: string;
  text: string;
}

export interface DocumentKindText {
  documentId: string;
  label: string;
  documentKind: string;
  text: string;
}

export interface SectionDiff {
  key: string;
  heading: string;
  status: "added" | "removed" | "changed" | "unchanged";
  before?: string;
  after?: string;
  wordDiff?: WordDiffToken[];
}

export interface DocumentComparison {
  from: DocumentKindText;
  to: DocumentKindText;
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  sections: SectionDiff[];
}

export interface WordDiffToken {
  value: string;
  type: "same" | "added" | "removed";
}

export function parseLegalSections(text: string): LegalSection[] {
  const parsed = parseBillText(text);
  return parsed.sections.map((section) => ({
    heading: section.heading,
    key: section.normalizedHeading,
    text: section.text
  }));
}

export function compareDocumentTexts(from: DocumentKindText, to: DocumentKindText): DocumentComparison {
  const before = new Map(parseLegalSections(from.text).map((section) => [section.key, section]));
  const after = new Map(parseLegalSections(to.text).map((section) => [section.key, section]));
  const keys = [...new Set([...before.keys(), ...after.keys()])];
  const sections = keys.map((key): SectionDiff => {
    const left = before.get(key);
    const right = after.get(key);
    if (!left && right) return { key, heading: right.heading, status: "added", after: excerpt(right.text), wordDiff: cappedWordDiff("", right.text) };
    if (left && !right) return { key, heading: left.heading, status: "removed", before: excerpt(left.text), wordDiff: cappedWordDiff(left.text, "") };
    if (left && right && normalizeSectionText(left.text) !== normalizeSectionText(right.text)) {
      return {
        key,
        heading: right.heading || left.heading,
        status: "changed",
        before: excerpt(left.text),
        after: excerpt(right.text),
        wordDiff: cappedWordDiff(left.text, right.text)
      };
    }
    return { key, heading: right?.heading ?? left?.heading ?? key, status: "unchanged", before: left ? excerpt(left.text) : undefined, after: right ? excerpt(right.text) : undefined };
  });
  return {
    from,
    to,
    added: sections.filter((section) => section.status === "added").length,
    removed: sections.filter((section) => section.status === "removed").length,
    changed: sections.filter((section) => section.status === "changed").length,
    unchanged: sections.filter((section) => section.status === "unchanged").length,
    sections
  };
}

export function compareDocumentSequence(documents: DocumentKindText[]): DocumentComparison[] {
  return documents.slice(1).map((document, index) => compareDocumentTexts(documents[index]!, document));
}

function normalizeSectionText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function excerpt(value: string, max = 900): string {
  const clean = value.trim();
  return clean.length > max ? `${clean.slice(0, max).trim()}...` : clean;
}

function cappedWordDiff(before: string, after: string): WordDiffToken[] | undefined {
  if (before.length + after.length > 4000) return undefined;
  return wordDiff(before, after).slice(0, 240);
}

function wordDiff(before: string, after: string): WordDiffToken[] {
  const left = words(before);
  const right = words(after);
  const dp: number[][] = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      dp[i]![j] = left[i] === right[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const tokens: WordDiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      tokens.push({ value: left[i]!, type: "same" });
      i += 1;
      j += 1;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      tokens.push({ value: left[i]!, type: "removed" });
      i += 1;
    } else {
      tokens.push({ value: right[j]!, type: "added" });
      j += 1;
    }
  }
  while (i < left.length) tokens.push({ value: left[i++]!, type: "removed" });
  while (j < right.length) tokens.push({ value: right[j++]!, type: "added" });
  return mergeAdjacentTokens(tokens);
}

function words(value: string): string[] {
  return value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}

function mergeAdjacentTokens(tokens: WordDiffToken[]): WordDiffToken[] {
  const merged: WordDiffToken[] = [];
  for (const token of tokens) {
    const last = merged.at(-1);
    if (last?.type === token.type) {
      last.value = `${last.value} ${token.value}`;
    } else {
      merged.push({ ...token });
    }
  }
  return merged;
}
