import type {
  ChamberId,
  Legislature,
  Member,
  MemberCommitteeMembership,
  MemberGroupMembership,
  MemberMandate,
  MemberPartyAffiliation,
  MemberRole,
  ParliamentaryGroup,
  Party,
  SourceSnapshot
} from "@cumsevoteaza/parliament-model";
import { cleanText, slugify } from "./utils";

export interface ParsedRoster {
  chamber: ChamberId;
  legislature: Legislature;
  sourceSnapshots: SourceSnapshot[];
  parties: Party[];
  groups: ParliamentaryGroup[];
  members: Member[];
  mandates: MemberMandate[];
  groupMemberships: MemberGroupMembership[];
  partyAffiliations: MemberPartyAffiliation[];
  committeeMemberships: MemberCommitteeMembership[];
  roles: MemberRole[];
  groupCounts: Array<{ groupId: string; expected: number; parsed: number }>;
}

export interface ParsedRosterIndex {
  sourceSnapshot: SourceSnapshot;
  groups: Array<{
    group: ParliamentaryGroup;
    party?: Party;
    url: string;
    expectedCount?: number;
  }>;
}

export interface ParsedRosterGroup {
  sourceSnapshot: SourceSnapshot;
  group: ParliamentaryGroup;
  party?: Party;
  expectedCount?: number;
  members: Array<{
    member: Member;
    profileUrl: string;
    membership: MemberGroupMembership;
    role?: MemberRole;
    partyAffiliation?: MemberPartyAffiliation;
  }>;
}

export interface ParsedMemberProfile {
  sourceSnapshot: SourceSnapshot;
  member: Member;
  parties?: Party[];
  groups?: ParliamentaryGroup[];
  mandate?: MemberMandate;
  partyAffiliations: MemberPartyAffiliation[];
  groupMemberships: MemberGroupMembership[];
  committeeMemberships: MemberCommitteeMembership[];
  roles: MemberRole[];
}

export const legislature2024: Legislature = {
  id: "leg-2024-2028",
  label: "2024-2028",
  startsOn: "2024-12-21",
  endsOn: "2028-12-20"
};

export const legislature2020: Legislature = {
  id: "leg-2020-2024",
  label: "2020-2024",
  startsOn: "2020-12-21",
  endsOn: "2024-12-20"
};

export const legislature2016: Legislature = {
  id: "leg-2016-2020",
  label: "2016-2020",
  startsOn: "2016-12-21",
  endsOn: "2020-12-20"
};

export const legislature2012: Legislature = {
  id: "leg-2012-2016",
  label: "2012-2016",
  startsOn: "2012-12-19",
  endsOn: "2016-12-20"
};

export const legislatureCatalog: Record<string, Legislature> = {
  "2012": legislature2012,
  "2012-2016": legislature2012,
  "leg-2012-2016": legislature2012,
  "2016": legislature2016,
  "2016-2020": legislature2016,
  "leg-2016-2020": legislature2016,
  "2020": legislature2020,
  "2020-2024": legislature2020,
  "leg-2020-2024": legislature2020,
  "2024": legislature2024,
  "2024-2028": legislature2024,
  "leg-2024-2028": legislature2024
};

export function legislatureFromFlag(value: string | undefined): Legislature {
  if (!value) return legislature2024;
  const normalized = value.trim().toLowerCase();
  const legislature = legislatureCatalog[normalized];
  if (!legislature) {
    throw new Error(`Unsupported legislature "${value}". Supported values: 2012, 2016, 2020, 2024.`);
  }
  return legislature;
}

export const partyCatalog: Record<string, Party> = {
  psd: { id: "party-psd", slug: "psd", shortName: "PSD", name: "Partidul Social Democrat", color: "#d71920" },
  pnl: { id: "party-pnl", slug: "pnl", shortName: "PNL", name: "Partidul Național Liberal", color: "#f2c230" },
  usr: { id: "party-usr", slug: "usr", shortName: "USR", name: "Uniunea Salvați România", color: "#1d71b8" },
  aur: { id: "party-aur", slug: "aur", shortName: "AUR", name: "Alianța pentru Unirea Românilor", color: "#111827" },
  udmr: { id: "party-udmr", slug: "udmr", shortName: "UDMR", name: "Uniunea Democrată Maghiară din România", color: "#159447" },
  alde: { id: "party-alde", slug: "alde", shortName: "ALDE", name: "Alianța Liberalilor și Democraților", color: "#f97316" },
  pmp: { id: "party-pmp", slug: "pmp", shortName: "PMP", name: "Partidul Mișcarea Populară", color: "#2563eb" },
  pdl: { id: "party-pdl", slug: "pdl", shortName: "PDL", name: "Partidul Democrat Liberal", color: "#f97316" },
  "pp-dd": { id: "party-pp-dd", slug: "pp-dd", shortName: "PP-DD", name: "Partidul Poporului - Dan Diaconescu", color: "#7c3aed" },
  pc: { id: "party-pc", slug: "pc", shortName: "PC", name: "Partidul Conservator", color: "#0f766e" },
  unpr: { id: "party-unpr", slug: "unpr", shortName: "UNPR", name: "Uniunea Națională pentru Progresul României", color: "#0ea5e9" },
  usl: { id: "party-usl", slug: "usl", shortName: "USL", name: "Uniunea Social Liberală", color: "#7f1d1d" },
  "pro-romania": { id: "party-pro-romania", slug: "pro-romania", shortName: "PRO România", name: "PRO România", color: "#0e7490" },
  "sos-ro": { id: "party-sos-ro", slug: "sos-ro", shortName: "SOS RO", name: "SOS România", color: "#7f1d1d" },
  pot: { id: "party-pot", slug: "pot", shortName: "POT", name: "Partidul Oamenilor Tineri", color: "#9333ea" },
  pace: { id: "party-pace", slug: "pace", shortName: "PACE", name: "PACE - Întâi România", color: "#0f766e" },
  upr: { id: "party-upr", slug: "upr", shortName: "UPR", name: "Uniți pentru România", color: "#0891b2" },
  minoritati: {
    id: "party-minoritati",
    slug: "minoritati",
    shortName: "Minorități",
    name: "Minorități naționale",
    color: "#64748b"
  }
};

export function partyFromText(value: string): Party | undefined {
  const text = normalize(value);
  if (text.includes("uniunea social liberala") || /\busl\b/.test(text)) return partyCatalog.usl;
  if (text.includes("alianta liberalilor") || /\balde\b/.test(text)) return partyCatalog.alde;
  if (text.includes("miscarea populara") || /\bpmp\b/.test(text)) return partyCatalog.pmp;
  if (text.includes("democrat liberal") || /\bpdl\b/.test(text)) return partyCatalog.pdl;
  if (text.includes("partidul poporului") || /\bpp-?dd\b/.test(text)) return partyCatalog["pp-dd"];
  if (text.includes("partidul conservator") || /\bpc\b/.test(text)) return partyCatalog.pc;
  if (text.includes("progresul romaniei") || /\bunpr\b/.test(text)) return partyCatalog.unpr;
  if (text.includes("pro romania")) return partyCatalog["pro-romania"];
  if (text.includes("social democrat") || /\bpsd\b/.test(text)) return partyCatalog.psd;
  if (text.includes("national liberal") || /\bpnl\b/.test(text)) return partyCatalog.pnl;
  if (text.includes("salvati romania") || /\busr\b/.test(text)) return partyCatalog.usr;
  if (text.includes("alianta pentru unirea romanilor") || /\baur\b/.test(text)) return partyCatalog.aur;
  if (text.includes("democrate maghiare") || /\budmr\b/.test(text)) return partyCatalog.udmr;
  if (text.includes("sos romania")) return partyCatalog["sos-ro"];
  if (text.includes("oamenilor tineri") || /\bpot\b/.test(text)) return partyCatalog.pot;
  if (text.includes("pace") || text.includes("intai romania")) return partyCatalog.pace;
  if (text.includes("uniti pentru romania")) return partyCatalog.upr;
  if (text.includes("minoritat")) return partyCatalog.minoritati;
  return undefined;
}

export function shortNameFromGroupName(name: string): string {
  const party = partyFromText(name);
  if (party) return party.shortName;
  const normalized = cleanText(name);
  if (/neafili/i.test(normalized)) return "Neafiliați";
  return normalized.replace(/^Grupul parlamentar(?: al)?/i, "").trim().slice(0, 32) || "Grup";
}

export function groupId(chamber: ChamberId, name: string, fallback?: string): string {
  const party = partyFromText(name);
  if (party) return `group-${chamber}-${party.slug}`;
  if (/neafili/i.test(name)) return `group-${chamber}-unaffiliated`;
  return `group-${chamber}-${slugify(fallback ?? name)}`;
}

export function memberId(chamber: ChamberId, officialId: string): string {
  return `member-${chamber}-${officialId.toLowerCase()}`;
}

export function parseRomanianDate(value: string): string | undefined {
  const text = cleanText(value);
  const numeric = text.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (numeric) {
    const [, day, month, year] = numeric;
    if (!day || !month || !year) return undefined;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const long = normalize(text).match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (!long) return undefined;
  const [, day, monthName, year] = long;
  if (!day || !monthName || !year) return undefined;
  const month = monthNumbers[monthName];
  return month ? `${year}-${month}-${day.padStart(2, "0")}` : undefined;
}

export function normalize(value: string): string {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function splitDisplayName(value: string): { firstName: string; lastName: string; displayName: string } {
  const displayName = cleanText(value);
  const parts = displayName.split(/\s+/);
  if (parts.length === 1) return { firstName: displayName, lastName: "", displayName };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? "",
    displayName
  };
}

export function mergeRoster(parts: ParsedRoster[]): ParsedRoster {
  const first = parts[0];
  if (!first) {
    throw new Error("Cannot merge an empty roster");
  }
  return {
    chamber: first.chamber,
    legislature: first.legislature,
    sourceSnapshots: uniqueBy(parts.flatMap((part) => part.sourceSnapshots), (item) => item.id),
    parties: uniqueBy(parts.flatMap((part) => part.parties), (item) => item.id),
    groups: uniqueBy(parts.flatMap((part) => part.groups), (item) => item.id),
    members: uniqueBy(parts.flatMap((part) => part.members), (item) => item.id),
    mandates: uniqueBy(parts.flatMap((part) => part.mandates), (item) => item.id),
    groupMemberships: uniqueBy(parts.flatMap((part) => part.groupMemberships), (item) => item.id),
    partyAffiliations: uniqueBy(parts.flatMap((part) => part.partyAffiliations), (item) => item.id),
    committeeMemberships: uniqueBy(parts.flatMap((part) => part.committeeMemberships), (item) => item.id),
    roles: uniqueBy(parts.flatMap((part) => part.roles), (item) => item.id),
    groupCounts: parts.flatMap((part) => part.groupCounts)
  };
}

export function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(getKey(item), item);
  }
  return [...map.values()];
}

const monthNumbers: Record<string, string> = {
  ianuarie: "01",
  februarie: "02",
  martie: "03",
  aprilie: "04",
  mai: "05",
  iunie: "06",
  iulie: "07",
  august: "08",
  septembrie: "09",
  octombrie: "10",
  noiembrie: "11",
  decembrie: "12"
};
