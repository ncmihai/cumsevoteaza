import type {
  ChamberId,
  Member,
  MemberGroupMembership,
  MemberMandate,
  MemberPartyAffiliation,
  ParliamentaryGroup,
  Party
} from "@cumsevoteaza/parliament-model";
import { cleanText, slugify } from "./parsers/utils";
import { legislatureFromFlag, partyCatalog, splitDisplayName, uniqueBy, type ParsedRoster } from "./parsers/roster";
import type { WikipediaRosterPage, WikipediaRosterRow } from "./parsers/wikipedia-roster";

const fallbackPalette = ["#475569", "#64748b", "#0f766e", "#7c3aed", "#b45309", "#0369a1", "#9f1239", "#4d7c0f"];

export function wikipediaRosterToParsedRoster(page: WikipediaRosterPage, chamber: ChamberId): ParsedRoster {
  const rows = page.rows.filter((row) => row.chamber === chamber);
  const partyById = new Map(Object.values(partyCatalog).map((party) => [party.id, party]));
  const memberKeyCounts = new Map<string, number>();

  const groups = uniqueBy(rows.map((row) => groupFromRow(row, chamber, partyById)), (group) => group.id);
  const parties = uniqueBy(
    rows.flatMap((row) => {
      const party = row.partyId ? partyById.get(row.partyId) : undefined;
      return party ? [party] : [];
    }),
    (party) => party.id
  );

  const members: Member[] = [];
  const mandates: MemberMandate[] = [];
  const groupMemberships: MemberGroupMembership[] = [];
  const partyAffiliations: MemberPartyAffiliation[] = [];

  for (const row of rows) {
    const member = memberFromRow(row, memberKeyCounts);
    const group = groupFromRow(row, chamber, partyById);
    members.push(member);
    mandates.push({
      id: `mandate-${member.id}-${page.legislatureId}-${chamber}`,
      memberId: member.id,
      legislatureId: page.legislatureId,
      chamber,
      startsOn: pageLegislatureStart(page),
      endsOn: pageLegislatureEnd(page),
      constituency: row.constituency,
      status: "ended",
      sourceSnapshotId: row.sourceSnapshotId ?? page.sourceSnapshot.id
    });
    groupMemberships.push({
      id: `group-membership-${member.id}-${group.id}-${page.legislatureId}`,
      memberId: member.id,
      groupId: group.id,
      startsOn: pageLegislatureStart(page),
      endsOn: pageLegislatureEnd(page),
      sourceSnapshotId: row.sourceSnapshotId ?? page.sourceSnapshot.id
    });
    if (row.partyId && partyById.has(row.partyId)) {
      partyAffiliations.push({
        id: `party-affiliation-${member.id}-${row.partyId}-${page.legislatureId}`,
        memberId: member.id,
        partyId: row.partyId,
        startsOn: pageLegislatureStart(page),
        endsOn: pageLegislatureEnd(page),
        sourceSnapshotId: row.sourceSnapshotId ?? page.sourceSnapshot.id
      });
    }
  }

  return {
    chamber,
    legislature: legislatureFromFlag(page.legislatureLabel),
    sourceSnapshots: uniqueBy(page.sourceSnapshots ?? [page.sourceSnapshot], (source) => source.id),
    parties,
    groups,
    members: uniqueBy(members, (member) => member.id),
    mandates: uniqueBy(mandates, (mandate) => mandate.id),
    groupMemberships: uniqueBy(groupMemberships, (membership) => membership.id),
    partyAffiliations: uniqueBy(partyAffiliations, (affiliation) => affiliation.id),
    committeeMemberships: [],
    roles: [],
    groupCounts: groups.map((group) => ({
      groupId: group.id,
      expected: rows.filter((row) => groupFromRow(row, chamber, partyById).id === group.id).length,
      parsed: rows.filter((row) => groupFromRow(row, chamber, partyById).id === group.id).length
    }))
  };
}

function memberFromRow(row: WikipediaRosterRow, counts: Map<string, number>): Member {
  const baseKey = slugify(row.normalizedName || row.displayName);
  const count = (counts.get(baseKey) ?? 0) + 1;
  counts.set(baseKey, count);
  const suffix = count > 1 ? `-${count}` : "";
  const id = `member-${row.chamber}-wikipedia-${row.legislatureLabel.slice(0, 4)}-${baseKey}${suffix}`;
  const names = splitDisplayName(row.displayName);
  return {
    id,
    slug: `${slugify(row.displayName)}-${row.chamber}-wiki-${row.legislatureLabel.slice(0, 4)}${suffix}`,
    firstName: names.firstName,
    lastName: names.lastName,
    displayName: row.displayName,
    sourceIds: {
      wikipediaRoster: row.sourceUrl ?? "",
      ...(row.wikiProfileUrl ? { wikipediaProfile: row.wikiProfileUrl } : {})
    }
  };
}

function groupFromRow(row: WikipediaRosterRow, chamber: ChamberId, partyById: Map<string, Party>): ParliamentaryGroup {
  const party = row.partyId ? partyById.get(row.partyId) : undefined;
  const label = cleanText(row.partyLabel || "Necunoscut");
  const shortName = party?.shortName ?? normalizeGroupShortName(label);
  const slug = party?.slug ?? slugify(shortName || label || "unknown");
  return {
    id: groupId(chamber, slug, label),
    partyId: party?.id,
    chamber,
    shortName,
    name: party ? `Grup parlamentar ${party.shortName}` : label || "Grup necunoscut",
    color: party?.color ?? fallbackPalette[Math.abs(hashString(slug)) % fallbackPalette.length]!
  };
}

function groupId(chamber: ChamberId, slug: string, label: string): string {
  if (/neafili|independent|mixt/i.test(label)) return `group-${chamber}-unaffiliated`;
  return `group-${chamber}-${slug}`;
}

function normalizeGroupShortName(label: string): string {
  if (!label || label === "—") return "Necunoscut";
  if (/independent|neafili/i.test(label)) return "Neafiliați";
  return cleanText(label).slice(0, 40);
}

function hashString(value: string): number {
  return [...value].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0);
}

function pageLegislatureStart(page: WikipediaRosterPage): string {
  return legislatureFromFlag(page.legislatureLabel).startsOn;
}

function pageLegislatureEnd(page: WikipediaRosterPage): string {
  return legislatureFromFlag(page.legislatureLabel).endsOn;
}
