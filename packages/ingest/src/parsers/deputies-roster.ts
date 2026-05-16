import * as cheerio from "cheerio";
import type {
  Legislature,
  Member,
  MemberCommitteeMembership,
  MemberGroupMembership,
  MemberMandate,
  MemberPartyAffiliation,
  MemberRole,
  ParliamentaryGroup,
  Party
} from "@cumsevoteaza/parliament-model";
import { cleanText, parseCount, slugify, snapshotFor } from "./utils";
import {
  groupId,
  legislature2024,
  memberId,
  normalize,
  parseRomanianDate,
  partyFromText,
  shortNameFromGroupName,
  splitDisplayName,
  type ParsedMemberProfile,
  type ParsedRosterGroup,
  type ParsedRosterIndex
} from "./roster";

const chamber = "deputies" as const;
const deputiesGroupSelector = "a[href*='structura2015.gp'][href*='idg='], a[href*='structura.gp'][href*='idg=']";
const deputiesProfileSelector = "a[href*='structura2015.mp'][href*='idm='], a[href*='structura.mp'][href*='idm=']";
const deputiesPartySelector = "a[href*='structura2015.fp'], a[href*='structura.fp']";
const deputiesCommitteeSelector = "a[href*='structura2015.co'], a[href*='structura.co']";

interface RosterParserOptions {
  legislature?: Legislature;
}

export function parseDeputiesRosterIndex(html: string, sourceUrl: string): ParsedRosterIndex {
  const $ = cheerio.load(html);
  const sourceSnapshot = snapshotFor("deputies-roster-index", sourceUrl, html, "parsed");
  const groups = $(deputiesGroupSelector)
    .toArray()
    .map((node) => {
      const link = $(node);
      const href = link.attr("href");
      const label = link.attr("aria-label") ?? cleanText(link.text());
      const name = cleanText(label.replace(/\s*-\s*\d+\s*membri.*$/i, "")) || cleanText(link.find("h3").text());
      if (!href || !name) return undefined;
      const idg = href.match(/idg=([^&]+)/i)?.[1] ?? slugify(name);
      const party = partyFromText(name);
      const group = buildGroup(name, party, idg);
      return {
        group,
        party,
        url: new URL(href, sourceUrl).toString(),
        expectedCount: parseCount(label)
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return { sourceSnapshot, groups };
}

export function parseDeputiesRosterGroup(
  html: string,
  sourceUrl: string,
  fallbackGroup?: ParliamentaryGroup,
  options: RosterParserOptions = {}
): ParsedRosterGroup {
  const legislature = options.legislature ?? legislature2024;
  const $ = cheerio.load(html);
  const sourceSnapshot = snapshotFor("deputies-roster-group", sourceUrl, html, "parsed");
  const heading = cleanText($("h1,h2,h3").filter((_, node) => /Grupul parlamentar|neafilia/i.test($(node).text())).first().text());
  const fallbackName = fallbackGroup?.name ?? (heading || "Grup parlamentar");
  const party = fallbackGroup?.partyId ? undefined : partyFromText(fallbackName);
  const group = fallbackGroup ?? buildGroup(fallbackName, party, sourceUrl.match(/idg=([^&]+)/i)?.[1] ?? fallbackName);
  const members: ParsedRosterGroup["members"] = [];
  const seen = new Set<string>();
  let pendingRole: string | undefined;

  $("tr").each((_, rowNode) => {
    const row = $(rowNode);
    const cells = row.find("td").toArray();
    const firstCell = cleanText($(cells[0]).text());
    const roleLabel = /^\d+\.?$/.test(firstCell) ? cleanText($(cells[1]).text()) : firstCell;
    const explicitRole = roleFromGroupRow(roleLabel);
    if (explicitRole) pendingRole = explicitRole;
    const element = row.find(deputiesProfileSelector).first();
    if (!element.length) return;
    const text = cleanText(element.text());
    const href = element.attr("href");
    const officialId = href?.match(/idm=(\d+)/i)?.[1];
    if (!href || !officialId || seen.has(officialId)) return;
    if (sourceUrl.includes("structura2015.gp") && element.closest("b").length === 0) return;
    seen.add(officialId);

    const displayName = cleanText(text);
    if (!displayName) return;
    if (/activitate|cv|biografie|declaratii|interpelari|initiative/i.test(normalize(displayName))) return;
    const member = buildMember(officialId, displayName, legislature);
    const rowText = cleanText(row.text());
    const startsOn = parseRomanianDate(rowText) ?? legislature.startsOn;
    const currentRole = explicitRole ?? pendingRole;
    pendingRole = undefined;
    const membership: MemberGroupMembership = {
      id: `group-membership-${member.id}-${group.id}-${startsOn}`,
      memberId: member.id,
      groupId: group.id,
      startsOn,
      sourceSnapshotId: sourceSnapshot.id
    };
    const partyAffiliation = group.partyId
      ? {
          id: `party-affiliation-${member.id}-${group.partyId}-${startsOn}`,
          memberId: member.id,
          partyId: group.partyId,
          startsOn,
          sourceSnapshotId: sourceSnapshot.id
        }
      : undefined;
    const role = currentRole
      ? {
          id: `role-${member.id}-${slugify(currentRole)}-${startsOn}`,
          memberId: member.id,
          title: currentRole,
          chamber,
          startsOn,
          sourceSnapshotId: sourceSnapshot.id
        }
      : undefined;
    members.push({ member, profileUrl: new URL(href, sourceUrl).toString(), membership, partyAffiliation, role });
  });

  return {
    sourceSnapshot,
    group,
    party: group.partyId ? undefined : party,
    expectedCount: parseCount($("body").text().match(/(\d+)\s*membri/i)?.[0]),
    members
  };
}

function roleFromGroupRow(rowText: string): string | undefined {
  if (/\bLider\b/i.test(rowText) && !/Vice/i.test(rowText)) return "Lider grup parlamentar";
  if (/Vicelider/i.test(rowText)) return "Vicelider grup parlamentar";
  if (/Secretar/i.test(rowText)) return "Secretar grup parlamentar";
  return undefined;
}

export function parseDeputiesMemberProfile(
  html: string,
  sourceUrl: string,
  options: RosterParserOptions = {}
): ParsedMemberProfile {
  const legislature = options.legislature ?? legislature2024;
  const $ = cheerio.load(html);
  const sourceSnapshot = snapshotFor("deputies-member-profile", sourceUrl, html, "parsed");
  const officialId = sourceUrl.match(/idm=(\d+)/i)?.[1] ?? slugify(sourceUrl);
  const headingName = cleanText(
    $("h1")
      .filter((_, node) => !/activitate parlamentara|mandate parlamentar|informatii personale/i.test(normalize($(node).text())))
      .first()
      .text()
  );
  const titleName = cleanText($("title").text()).replace(/^.* - /, "");
  const name = titleName || headingName;
  const member = buildMember(officialId, name, legislature);
  const bodyText = cleanText($("body").text());
  const mandateStart = parseRomanianDate(bodyText.match(/data validării:\s*([^-.]+)/i)?.[1] ?? "") ?? legislature.startsOn;
  const constituency = cleanText(bodyText.match(/circumscriptia electorala nr\.\d+\s*([^<\n]+)/i)?.[1] ?? "");
  const mandate: MemberMandate = {
    id: `mandate-${member.id}-${legislature.label}-deputies`,
    memberId: member.id,
    legislatureId: legislature.id,
    chamber,
    startsOn: mandateStart,
    constituency: constituency || undefined,
    status: "active",
    sourceSnapshotId: sourceSnapshot.id
  };

  return {
    sourceSnapshot,
    member,
    parties: parseDeputiesParties($),
    groups: parseDeputiesGroups($),
    mandate,
    partyAffiliations: parseDeputiesPartyAffiliations($, member.id, sourceSnapshot.id, legislature),
    groupMemberships: parseDeputiesGroupMemberships($, member.id, sourceSnapshot.id, legislature),
    committeeMemberships: parseDeputiesCommittees($, member.id, sourceSnapshot.id, legislature),
    roles: []
  };
}

function parseDeputiesParties($: cheerio.CheerioAPI): Party[] {
  const parties = new Map<string, Party>();
  $(deputiesPartySelector).each((_, node) => {
    const party = partyFromText(cleanText($(node).parent().text()));
    if (party) parties.set(party.id, party);
  });
  return [...parties.values()];
}

function parseDeputiesGroups($: cheerio.CheerioAPI): ParliamentaryGroup[] {
  const groups = new Map<string, ParliamentaryGroup>();
  $(deputiesGroupSelector).each((_, node) => {
    const link = $(node);
    const name = cleanText(link.text());
    if (!/Grupul parlamentar|neafilia/i.test(name)) return;
    const group = buildGroup(name, partyFromText(name), link.attr("href")?.match(/idg=([^&]+)/i)?.[1] ?? name);
    groups.set(group.id, group);
  });
  return [...groups.values()];
}

function buildGroup(name: string, party: Party | undefined, fallback: string): ParliamentaryGroup {
  return {
    id: groupId(chamber, name, fallback),
    partyId: party?.id,
    chamber,
    shortName: shortNameFromGroupName(name),
    name: cleanText(name),
    color: party?.color ?? "#64748b"
  };
}

function buildMember(officialId: string, displayName: string, legislature: Legislature = legislature2024): Member {
  const parsedName = splitDisplayName(displayName);
  const legislatureYear = legislature.label.slice(0, 4);
  return {
    id: legislature.id === legislature2024.id ? memberId(chamber, officialId) : memberId(chamber, `${legislatureYear}-${officialId}`),
    slug: slugify(displayName),
    firstName: parsedName.firstName,
    lastName: parsedName.lastName,
    displayName: parsedName.displayName,
    sourceIds: { deputies: officialId, [`deputies:${legislatureYear}`]: officialId }
  };
}

function parseDeputiesPartyAffiliations(
  $: cheerio.CheerioAPI,
  memberIdValue: string,
  sourceSnapshotId: string,
  legislature: Legislature
): MemberPartyAffiliation[] {
  return $(deputiesPartySelector)
    .toArray()
    .map((node) => {
      const line = cleanText($(node).parent().text());
      const party = partyFromText(line);
      if (!party) return undefined;
      const startsOn = parseRomanianDate(line) ?? legislature.startsOn;
      const affiliation: MemberPartyAffiliation = {
        id: `party-affiliation-${memberIdValue}-${party.id}-${startsOn}`,
        memberId: memberIdValue,
        partyId: party.id,
        startsOn,
        sourceSnapshotId
      };
      if (/până/i.test(line)) affiliation.endsOn = startsOn;
      return affiliation;
    })
    .filter((item): item is MemberPartyAffiliation => Boolean(item));
}

function parseDeputiesGroupMemberships(
  $: cheerio.CheerioAPI,
  memberIdValue: string,
  sourceSnapshotId: string,
  legislature: Legislature
): MemberGroupMembership[] {
  return $(deputiesGroupSelector)
    .toArray()
    .map((node) => {
      const link = $(node);
      const line = cleanText(link.parent().text());
      const name = cleanText(link.text());
      if (!/Grupul parlamentar|neafilia/i.test(name)) return undefined;
      const group = buildGroup(name, partyFromText(name), link.attr("href")?.match(/idg=([^&]+)/i)?.[1] ?? name);
      const startsOn = parseRomanianDate(line) ?? legislature.startsOn;
      const membership: MemberGroupMembership = {
        id: `group-membership-${memberIdValue}-${group.id}-${startsOn}`,
        memberId: memberIdValue,
        groupId: group.id,
        startsOn,
        sourceSnapshotId
      };
      if (/până/i.test(line)) membership.endsOn = startsOn;
      return membership;
    })
    .filter((item): item is MemberGroupMembership => Boolean(item));
}

function parseDeputiesCommittees(
  $: cheerio.CheerioAPI,
  memberIdValue: string,
  sourceSnapshotId: string,
  legislature: Legislature
): MemberCommitteeMembership[] {
  const committees: MemberCommitteeMembership[] = [];
  $("h4").each((_, headingNode) => {
    const heading = normalize($(headingNode).text());
    if (!heading.includes("comisii")) return;
    let sibling = $(headingNode).next();
    while (sibling.length && !/^h[1-4]$/i.test(sibling[0]?.tagName ?? "")) {
      sibling.find(deputiesCommitteeSelector).each((__, linkNode) => {
        const link = $(linkNode);
        const name = cleanText(link.text());
        if (!name) return;
        const line = cleanText(link.parent().text());
        const startsOn = parseRomanianDate(line) ?? legislature.startsOn;
        committees.push({
          id: `committee-${memberIdValue}-${slugify(name)}-${startsOn}`,
          memberId: memberIdValue,
          committeeName: name,
          chamber,
          role: roleFromCommitteeLine(line),
          startsOn,
          sourceSnapshotId
        });
      });
      sibling = sibling.next();
    }
  });
  return committees;
}

function roleFromCommitteeLine(line: string): string | undefined {
  const text = cleanText(line);
  if (/pre[șs]edinte/i.test(text)) return "Președinte";
  if (/vicepre[șs]edinte/i.test(text)) return "Vicepreședinte";
  if (/secretar/i.test(text)) return "Secretar";
  if (/membru/i.test(text)) return "Membru";
  return undefined;
}
