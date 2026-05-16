import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseChamberNominalVote } from "./parsers/chamber-vote";
import { parseDeputiesMemberProfile, parseDeputiesRosterGroup, parseDeputiesRosterIndex } from "./parsers/deputies-roster";
import { legislatureFromFlag, partyCatalog, uniqueBy, type ParsedMemberProfile, type ParsedRoster } from "./parsers/roster";
import { parseSenateBill } from "./parsers/senate-bill";
import { parseSenateMemberProfile, parseSenateRosterGroup, parseSenateRosterIndex } from "./parsers/senate-roster";
import { parseSenateVote } from "./parsers/senate-vote";
import { fetchOfficialSource } from "./fetch-source";
import { governmentSkeletonData } from "./government-skeleton";
import { canonicalizeOfficialUrl } from "./official-urls";
import { backfillPeopleFromMembers, persistChamberVote, persistGovernmentSkeleton, persistRoster, persistSenateBill, persistSenateVote } from "./persist";
import { snapshotFor } from "./parsers/utils";
import {
  discoverDeputiesSources,
  discoverDeputiesVoteSources,
  discoverSenateSources,
  importPendingDiscoveries,
  runBackfill2024,
  runDailySync
} from "./sync";

type RosterGroupRef = {
  group?: ParsedRoster["groups"][number];
  url: string;
  expectedCount?: number;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

async function main() {
  const command = process.argv[2];

  if (command === "senate:bill") {
    const cod = flag("cod") ?? "27035";
    const url = flag("url") ?? `https://www.senat.ro/Legis/Lista.aspx?cod=${cod}`;
    const html = await loadHtml(url);
    const parsed = parseSenateBill(html, url);
    await writeImport("senate-bill", parsed, html);
    if (hasFlag("persist")) {
      console.log(JSON.stringify(await persistSenateBill(parsed), null, 2));
    }
    return;
  }

  if (command === "senate:vote") {
    const url =
      flag("url") ??
      "https://www.senat.ro/VoturiPlenDetaliu.aspx?AppID=EF4EE11F-7327-4C71-9B76-2CB5C930E88C&Cod=27035&Data=2025-10-27";
    const html = await loadHtml(url);
    const parsed = parseSenateVote(html, url);
    await writeImport("senate-vote", parsed, html);
    if (hasFlag("persist")) {
      console.log(JSON.stringify(await persistSenateVote(parsed), null, 2));
    }
    return;
  }

  if (command === "chamber:vote") {
    const url = canonicalizeOfficialUrl(flag("url") ?? "https://www.cdep.ro/ords/pls/steno/evot2015.Nominal?idv=35953");
    try {
      const html = await loadHtml(url);
      const parsed = parseChamberNominalVote(html, url);
      await writeImport("chamber-vote", parsed, html);
      if (hasFlag("persist")) {
        console.log(JSON.stringify(await persistChamberVote(parsed), null, 2));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const snapshot = snapshotFor("chamber-nominal-vote", url, message, "failed", message);
      await writeImport("chamber-vote-failed", { sourceSnapshot: snapshot, error: message }, message);
    }
    return;
  }

  if (command === "senate:roster") {
    const parsed = await importSenateRoster();
    await writeImport("senate-roster", parsed, JSON.stringify(parsed, null, 2));
    logRosterSummary(parsed);
    if (hasFlag("persist")) {
      console.log(JSON.stringify(await persistRoster(parsed), null, 2));
    }
    return;
  }

  if (command === "deputies:roster") {
    const parsed = await importDeputiesRoster();
    await writeImport("deputies-roster", parsed, JSON.stringify(parsed, null, 2));
    logRosterSummary(parsed);
    if (hasFlag("persist")) {
      console.log(JSON.stringify(await persistRoster(parsed), null, 2));
    }
    return;
  }

  if (command === "roster:all") {
    const senate = await importSenateRoster();
    const deputies = await importDeputiesRoster();
    const parsed = { senate, deputies };
    await writeImport("roster-all", parsed, JSON.stringify(parsed, null, 2));
    if (hasFlag("persist")) {
      console.log(
        JSON.stringify(
          {
            senate: await persistRoster(senate),
            deputies: await persistRoster(deputies)
          },
          null,
          2
        )
      );
    }
    return;
  }

  if (command === "people:backfill") {
    console.log(JSON.stringify(await backfillPeopleFromMembers(), null, 2));
    return;
  }

  if (command === "governments:skeleton") {
    console.log(JSON.stringify(await persistGovernmentSkeleton(governmentSkeletonData()), null, 2));
    return;
  }

  if (command === "discover:senate") {
    console.log(JSON.stringify(await discoverSenateSources(syncOptions()), null, 2));
    return;
  }

  if (command === "discover:deputies") {
    console.log(JSON.stringify(await discoverDeputiesSources(syncOptions()), null, 2));
    return;
  }

  if (command === "discover:deputies-votes") {
    console.log(JSON.stringify(await discoverDeputiesVoteSources(syncOptions()), null, 2));
    return;
  }

  if (command === "backfill:2024") {
    console.log(JSON.stringify(await runBackfill2024(syncOptions()), null, 2));
    return;
  }

  if (command === "sync:daily") {
    console.log(JSON.stringify(await runDailySync(syncOptions()), null, 2));
    return;
  }

  if (command === "import:pending") {
    console.log(JSON.stringify(await importPendingDiscoveries(syncOptions()), null, 2));
    return;
  }

  throw new Error(`Unknown command: ${command ?? "(missing)"}`);
}

async function importSenateRoster(): Promise<ParsedRoster> {
  const legislature = rosterLegislature();
  const groupUrls = listFlag("group-urls");
  const indexUrl = flag("url") ?? "https://www.senat.ro/EnumGrupuri.aspx";
  const index = groupUrls
    ? undefined
    : parseSenateRosterIndex(await loadHtml(indexUrl), indexUrl);
  const limitValue = Number(flag("limit") ?? "0");
  const groupRefs: RosterGroupRef[] = groupUrls
    ? groupUrls.map((url) => ({ url }))
    : (index?.groups ?? []);
  const groupsToFetch = limitValue > 0 ? groupRefs.slice(0, limitValue) : groupRefs;
  const groupParts = [];
  const profiles: ParsedMemberProfile[] = [];
  const concurrency = Number(flag("concurrency") ?? "6");

  for (const groupRef of groupsToFetch) {
    console.log(`Fetching Senate group ${groupRef.group?.shortName ?? groupRef.url}`);
    const html = await fetchWithFailureSnapshot(groupRef.url, "senate-roster-group");
    const group = parseSenateRosterGroup(html, groupRef.url, groupRef.group, { legislature });
    group.expectedCount = groupRef.expectedCount ?? group.expectedCount;
    if (groupRef.expectedCount && group.members.length > groupRef.expectedCount) {
      group.members = group.members.slice(0, groupRef.expectedCount);
    }
    groupParts.push(group);
    const membersToFetch = limitValue > 0 ? group.members.slice(0, limitValue) : group.members;
    profiles.push(
      ...(await mapLimit(membersToFetch, concurrency, async (memberRef) => {
        const profileHtml = await fetchOptional(memberRef.profileUrl, "senate-member-profile");
        return profileHtml ? parseSenateMemberProfile(profileHtml, memberRef.profileUrl, { legislature }) : undefined;
      }))
    );
  }

  return {
    chamber: "senate",
    legislature,
    sourceSnapshots: uniqueBy(
      [
        ...(index ? [index.sourceSnapshot] : []),
        ...groupParts.map((group) => group.sourceSnapshot),
        ...profiles.map((profile) => profile.sourceSnapshot)
      ],
      (source) => source.id
    ),
    parties: uniqueBy(
      [
        ...(index?.groups ?? []).flatMap((group) => (group.party ? [group.party] : [])),
        ...groupParts.flatMap((group) => (group.party ? [group.party] : [])),
        ...profiles.flatMap((profile) => profile.parties ?? []),
        ...partiesFromGroups([...(index?.groups ?? []).map((group) => group.group), ...groupParts.map((group) => group.group)])
      ],
      (party) => party.id
    ),
    groups: uniqueBy([...(index?.groups ?? []).map((group) => group.group), ...groupParts.map((group) => group.group)], (group) => group.id),
    members: uniqueBy(
      [...groupParts.flatMap((group) => group.members.map((member) => member.member)), ...profiles.map((profile) => profile.member)],
      (member) => member.id
    ),
    mandates: uniqueBy(profiles.flatMap((profile) => (profile.mandate ? [profile.mandate] : [])), (mandate) => mandate.id),
    groupMemberships: uniqueBy(
      [
        ...groupParts.flatMap((group) => group.members.map((member) => member.membership)),
        ...profiles.flatMap((profile) => profile.groupMemberships)
      ],
      (membership) => membership.id
    ),
    partyAffiliations: uniqueBy(
      [
        ...groupParts.flatMap((group) => group.members.flatMap((member) => (member.partyAffiliation ? [member.partyAffiliation] : []))),
        ...profiles.flatMap((profile) => profile.partyAffiliations)
      ],
      (affiliation) => affiliation.id
    ),
    committeeMemberships: uniqueBy(profiles.flatMap((profile) => profile.committeeMemberships), (membership) => membership.id),
    roles: uniqueBy(
      [...groupParts.flatMap((group) => group.members.flatMap((member) => (member.role ? [member.role] : []))), ...profiles.flatMap((profile) => profile.roles)],
      (role) => role.id
    ),
    groupCounts: groupParts.map((group) => ({
      groupId: group.group.id,
      expected: group.expectedCount ?? 0,
      parsed: group.members.length
    }))
  };
}

async function importDeputiesRoster(): Promise<ParsedRoster> {
  const legislature = rosterLegislature();
  const memberIdFrom = numberFlag("member-id-from");
  const memberIdTo = numberFlag("member-id-to");
  if (memberIdFrom && memberIdTo) {
    return importDeputiesRosterByMemberIds(legislature, memberIdFrom, memberIdTo);
  }

  const groupUrls = listFlag("group-urls");
  const indexUrl = flag("url") ?? defaultDeputiesRosterUrl(legislature.label);
  const index = groupUrls
    ? undefined
    : parseDeputiesRosterIndex(await loadHtml(indexUrl), indexUrl);
  const limitValue = Number(flag("limit") ?? "0");
  const groupRefs: RosterGroupRef[] = groupUrls
    ? groupUrls.map((url) => ({ url }))
    : (index?.groups ?? []);
  const groupsToFetch = limitValue > 0 ? groupRefs.slice(0, limitValue) : groupRefs;
  const groupParts = [];
  const profiles: ParsedMemberProfile[] = [];
  const concurrency = Number(flag("concurrency") ?? "6");

  for (const groupRef of groupsToFetch) {
    console.log(`Fetching Deputies group ${groupRef.group?.shortName ?? groupRef.url}`);
    const html = await fetchWithFailureSnapshot(groupRef.url, "deputies-roster-group");
    const group = parseDeputiesRosterGroup(html, groupRef.url, groupRef.group, { legislature });
    group.expectedCount = groupRef.expectedCount ?? group.expectedCount;
    if (groupRef.expectedCount && group.members.length > groupRef.expectedCount) {
      group.members = group.members.slice(0, groupRef.expectedCount);
    }
    groupParts.push(group);
    const membersToFetch = limitValue > 0 ? group.members.slice(0, limitValue) : group.members;
    profiles.push(
      ...(await mapLimit(membersToFetch, concurrency, async (memberRef) => {
        const profileHtml = await fetchOptional(memberRef.profileUrl, "deputies-member-profile");
        return profileHtml ? parseDeputiesMemberProfile(profileHtml, memberRef.profileUrl, { legislature }) : undefined;
      }))
    );
  }

  return {
    chamber: "deputies",
    legislature,
    sourceSnapshots: uniqueBy(
      [
        ...(index ? [index.sourceSnapshot] : []),
        ...groupParts.map((group) => group.sourceSnapshot),
        ...profiles.map((profile) => profile.sourceSnapshot)
      ],
      (source) => source.id
    ),
    parties: uniqueBy(
      [
        ...(index?.groups ?? []).flatMap((group) => (group.party ? [group.party] : [])),
        ...groupParts.flatMap((group) => (group.party ? [group.party] : [])),
        ...profiles.flatMap((profile) => profile.parties ?? []),
        ...partiesFromGroups([
          ...(index?.groups ?? []).map((group) => group.group),
          ...groupParts.map((group) => group.group),
          ...profiles.flatMap((profile) => profile.groups ?? [])
        ])
      ],
      (party) => party.id
    ),
    groups: uniqueBy(
      [
        ...(index?.groups ?? []).map((group) => group.group),
        ...groupParts.map((group) => group.group),
        ...profiles.flatMap((profile) => profile.groups ?? [])
      ],
      (group) => group.id
    ),
    members: uniqueBy(
      [...profiles.map((profile) => profile.member), ...groupParts.flatMap((group) => group.members.map((member) => member.member))],
      (member) => member.id
    ),
    mandates: uniqueBy(profiles.flatMap((profile) => (profile.mandate ? [profile.mandate] : [])), (mandate) => mandate.id),
    groupMemberships: uniqueBy(
      [
        ...groupParts.flatMap((group) => group.members.map((member) => member.membership)),
        ...profiles.flatMap((profile) => profile.groupMemberships)
      ],
      (membership) => membership.id
    ),
    partyAffiliations: uniqueBy(
      [
        ...groupParts.flatMap((group) => group.members.flatMap((member) => (member.partyAffiliation ? [member.partyAffiliation] : []))),
        ...profiles.flatMap((profile) => profile.partyAffiliations)
      ],
      (affiliation) => affiliation.id
    ),
    committeeMemberships: uniqueBy(profiles.flatMap((profile) => profile.committeeMemberships), (membership) => membership.id),
    roles: uniqueBy(
      [...groupParts.flatMap((group) => group.members.flatMap((member) => (member.role ? [member.role] : []))), ...profiles.flatMap((profile) => profile.roles)],
      (role) => role.id
    ),
    groupCounts: groupParts.map((group) => ({
      groupId: group.group.id,
      expected: group.expectedCount ?? 0,
      parsed: group.members.length
    }))
  };
}

async function importDeputiesRosterByMemberIds(
  legislature: ParsedRoster["legislature"],
  from: number,
  to: number
): Promise<ParsedRoster> {
  const concurrency = Number(flag("concurrency") ?? "8");
  const ids = Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);
  const profiles = await mapLimit(ids, concurrency, async (officialId) => {
    const url = defaultDeputiesMemberProfileUrl(legislature.label, officialId);
    const profileHtml = await fetchOptional(url, "deputies-member-profile");
    if (!profileHtml) return undefined;
    const profile = parseDeputiesMemberProfile(profileHtml, url, { legislature });
    return looksLikeParsedDeputiesMember(profile) ? profile : undefined;
  });

  return {
    chamber: "deputies",
    legislature,
    sourceSnapshots: uniqueBy(profiles.map((profile) => profile.sourceSnapshot), (source) => source.id),
    parties: uniqueBy(
      [...profiles.flatMap((profile) => profile.parties ?? []), ...partiesFromGroups(profiles.flatMap((profile) => profile.groups ?? []))],
      (party) => party.id
    ),
    groups: uniqueBy(profiles.flatMap((profile) => profile.groups ?? []), (group) => group.id),
    members: uniqueBy(profiles.map((profile) => profile.member), (member) => member.id),
    mandates: uniqueBy(profiles.flatMap((profile) => (profile.mandate ? [profile.mandate] : [])), (mandate) => mandate.id),
    groupMemberships: uniqueBy(profiles.flatMap((profile) => profile.groupMemberships), (membership) => membership.id),
    partyAffiliations: uniqueBy(profiles.flatMap((profile) => profile.partyAffiliations), (affiliation) => affiliation.id),
    committeeMemberships: uniqueBy(profiles.flatMap((profile) => profile.committeeMemberships), (membership) => membership.id),
    roles: uniqueBy(profiles.flatMap((profile) => profile.roles), (role) => role.id),
    groupCounts: []
  };
}

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function partiesFromGroups(groups: ParsedRoster["groups"]): ParsedRoster["parties"] {
  const partiesById = new Map(Object.values(partyCatalog).map((party) => [party.id, party]));
  return groups.flatMap((group) => {
    if (!group.partyId) return [];
    const party = partiesById.get(group.partyId);
    return party ? [party] : [];
  });
}

function logRosterSummary(parsed: ParsedRoster) {
  console.log(
    JSON.stringify(
      {
        chamber: parsed.chamber,
        legislature: parsed.legislature.label,
        sources: parsed.sourceSnapshots.length,
        groups: parsed.groups.length,
        members: parsed.members.length,
        mandates: parsed.mandates.length,
        groupMemberships: parsed.groupMemberships.length,
        committeeMemberships: parsed.committeeMemberships.length,
        groupCounts: parsed.groupCounts
      },
      null,
      2
    )
  );
}

function rosterLegislature() {
  return legislatureFromFlag(flag("legislature") ?? flag("year"));
}

function defaultDeputiesRosterUrl(label: string): string {
  if (label === "2020-2024") {
    return "https://www.cdep.ro/pls/parlam/structura.gp?leg=2020";
  }
  return "https://cdep.ro/ords/pls/dic/site2015.home?idl=1";
}

function defaultDeputiesMemberProfileUrl(label: string, officialId: number): string {
  const leg = label.slice(0, 4);
  return `https://www.cdep.ro/ords/pls/parlam/structura2015.mp?cam=2&idl=1&idm=${officialId}&leg=${leg}&pag=1`;
}

function looksLikeParsedDeputiesMember(profile: ParsedMemberProfile): boolean {
  if (!profile.member.displayName || !profile.mandate) return false;
  return ![
    "activitate-parlamentara",
    "activitate-publica",
    "biografie",
    "camera-deputatilor",
    "curriculum-vitae",
    "declaratia-de-avere",
    "declaratia-de-interese",
    "votul-electronic"
  ].includes(profile.member.slug);
}

async function loadHtml(url: string): Promise<string> {
  const fixture = flag("fixture");
  if (fixture) {
    return readFile(path.join(repoRoot, "packages/ingest/src/fixtures", fixture), "utf8");
  }
  return fetchOfficialSource(url);
}

async function fetchWithFailureSnapshot(url: string, parser: string): Promise<string> {
  try {
    return await fetchOfficialSource(url, 3);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const snapshot = snapshotFor(parser, url, message, "failed", message);
    await writeImport(`${parser}-failed`, { sourceSnapshot: snapshot, error: message }, message);
    throw error;
  }
}

async function fetchOptional(url: string, parser: string): Promise<string | undefined> {
  try {
    return await fetchWithFailureSnapshot(url, parser);
  } catch {
    return undefined;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R | undefined>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      if (!current) continue;
      const result = await task(current);
      if (result) results.push(result);
    }
  });
  await Promise.all(workers);
  return results;
}

async function writeImport(name: string, payload: unknown, raw: string) {
  if (hasFlag("no-files") || process.env.VERCEL === "1") {
    console.log(`Skipped local file output for ${name}`);
    return;
  }
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const importDir = path.join(repoRoot, "data/imports");
  const snapshotDir = path.join(repoRoot, "data/snapshots");
  await mkdir(importDir, { recursive: true });
  await mkdir(snapshotDir, { recursive: true });
  await writeFile(path.join(importDir, `${now}-${name}.json`), JSON.stringify(payload, null, 2));
  await writeFile(path.join(snapshotDir, `${now}-${name}.html`), raw);
  console.log(`Wrote ${name} import at ${now}`);
}

function syncOptions() {
  const years = flag("years")
    ?.split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value));
  return {
    years: years && years.length > 0 ? years : undefined,
    maxImports: numberFlag("max-imports"),
    maxRetries: numberFlag("max-retries"),
    discoveryLimit: numberFlag("discovery-limit"),
    chamber: chamberFlag(),
    kind: kindFlag(),
    deputiesVoteDates: listFlag("deputies-vote-dates"),
    deputiesVoteMonths: numberListFlag("deputies-vote-months"),
    senateFrom: numberFlag("senate-from"),
    senateTo: numberFlag("senate-to"),
    senatePrefixes: senatePrefixesFlag()
  };
}

function numberFlag(name: string): number | undefined {
  const value = flag(name);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function listFlag(name: string): string[] | undefined {
  const value = flag(name);
  if (!value) return undefined;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function numberListFlag(name: string): number[] | undefined {
  const values = listFlag(name)
    ?.map((value) => Number(value))
    .filter((value) => Number.isInteger(value));
  return values && values.length > 0 ? values : undefined;
}

function senatePrefixesFlag(): Array<"B" | "BP" | "L" | "PLX"> | undefined {
  const value = flag("senate-prefixes");
  if (!value) return undefined;
  const prefixes = value
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item): item is "B" | "BP" | "L" | "PLX" => ["B", "BP", "L", "PLX"].includes(item));
  return prefixes.length > 0 ? prefixes : undefined;
}

function chamberFlag(): "senate" | "deputies" | undefined {
  const value = flag("chamber");
  return value === "senate" || value === "deputies" ? value : undefined;
}

function kindFlag(): "bill" | "vote" | undefined {
  const value = flag("kind");
  return value === "bill" || value === "vote" ? value : undefined;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
