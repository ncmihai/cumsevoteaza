import type { ChamberId, Locale, VoteChoice } from "./types";

export const chamberLabels: Record<Locale, Record<ChamberId, string>> = {
  ro: {
    senate: "Senat",
    deputies: "Camera Deputaților"
  },
  en: {
    senate: "Senate",
    deputies: "Chamber of Deputies"
  }
};

export const voteChoiceLabels: Record<Locale, Record<VoteChoice, string>> = {
  ro: {
    for: "Pentru",
    against: "Contra",
    abstention: "Abținere",
    present_not_voting: "Prezent, nu a votat",
    absent: "Absent",
    unknown: "Necunoscut"
  },
  en: {
    for: "For",
    against: "Against",
    abstention: "Abstention",
    present_not_voting: "Present, did not vote",
    absent: "Absent",
    unknown: "Unknown"
  }
};

export const voteChoiceColors: Record<VoteChoice, string> = {
  for: "#168a4a",
  against: "#c43a31",
  abstention: "#c9891a",
  present_not_voting: "#64748b",
  absent: "#cbd5e1",
  unknown: "#94a3b8"
};

export function formatDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(date));
}
