import * as cheerio from "cheerio";
import type { IndividualVote, Member, SourceSnapshot, Vote, VoteChoice } from "@cumsevoteaza/parliament-model";
import { cleanText, slugify, snapshotFor, titleCase } from "./utils";

export interface ParsedChamberVote {
  sourceSnapshot: SourceSnapshot;
  vote: Vote;
  members: Member[];
  individualVotes: IndividualVote[];
  warnings: string[];
}

export function parseChamberNominalVote(html: string, sourceUrl: string): ParsedChamberVote {
  const $ = cheerio.load(html);
  const sourceSnapshot = snapshotFor("chamber-nominal-vote", sourceUrl, html, "partial");
  const text = cleanText($("body").text());
  const heldOn = inferDate(text) ?? new Date().toISOString().slice(0, 10);
  const voteId = `vote-deputies-${slugify(sourceUrl)}`;
  const warnings: string[] = [];
  const members = new Map<string, Member>();
  const individualVotes: IndividualVote[] = [];

  $("table tr").each((_, row) => {
    const cells = $(row).find("td").toArray().map((cell) => cleanText($(cell).text()));
    const rowNumber = cells[0]?.match(/^(\d+)\.$/)?.[1];
    const profileHref = $(row).find("a[href*='structura2015.mp']").attr("href");
    const officialId = profileHref?.match(/[?&]idm=(\d+)/i)?.[1];
    const candidateName = cells[1];
    const groupId = groupIdFromLabel(cells[2]);
    const voteCell = cells[3];
    if (!rowNumber || !officialId || !candidateName || !voteCell) return;
    const choice = choiceFromText(voteCell);
    if (choice === "unknown") return;

    const displayName = titleCase(candidateName);
    const memberId = `member-deputies-${officialId}`;
    members.set(memberId, {
      id: memberId,
      slug: slugify(displayName),
      firstName: displayName.split(" ").slice(0, -1).join(" ") || displayName,
      lastName: displayName.split(" ").at(-1) ?? displayName,
      displayName,
      sourceIds: { cdepIdm: officialId }
    });
    individualVotes.push({
      id: `iv-${voteId}-${memberId}`,
      voteId,
      memberId,
      groupId,
      choice
    });
  });

  if (individualVotes.length === 0) {
    warnings.push("No nominal vote rows detected. Source structure may require a specific Chamber parser update.");
  }

  const officialTotals = extractOfficialTotals(text);
  if (officialTotals && individualVotes.length > 0) {
    const parsedTotals = totalsFromVotes(individualVotes);
    if (
      parsedTotals.for !== officialTotals.for ||
      parsedTotals.against !== officialTotals.against ||
      parsedTotals.abstention !== officialTotals.abstention ||
      parsedTotals.presentNotVoting !== officialTotals.presentNotVoting
    ) {
      warnings.push(
        `Parsed nominal rows do not match official totals: parsed ${parsedTotals.for}/${parsedTotals.against}/${parsedTotals.abstention}/${parsedTotals.presentNotVoting}, official ${officialTotals.for}/${officialTotals.against}/${officialTotals.abstention}/${officialTotals.presentNotVoting}.`
      );
    }
  }

  const totals = totalsFromVotes(individualVotes);

  return {
    sourceSnapshot: {
      ...sourceSnapshot,
      status: individualVotes.length > 0 && warnings.length === 0 ? "parsed" : individualVotes.length > 0 ? "partial" : "failed",
      notes: warnings.join(" ")
    },
    vote: {
      id: voteId,
      chamber: "deputies",
      title: $("title").first().text() || "Chamber nominal vote",
      heldOn,
      voteType: "nominal",
      totals,
      sourceSnapshotId: sourceSnapshot.id
    },
    members: [...members.values()],
    individualVotes,
    warnings
  };
}

function totalsFromVotes(individualVotes: IndividualVote[]) {
  return {
    present: individualVotes.length,
    for: individualVotes.filter((vote) => vote.choice === "for").length,
    against: individualVotes.filter((vote) => vote.choice === "against").length,
    abstention: individualVotes.filter((vote) => vote.choice === "abstention").length,
    presentNotVoting: individualVotes.filter((vote) => vote.choice === "present_not_voting").length
  };
}

function extractOfficialTotals(text: string) {
  const forVotes = numberAfter(text, /Pentru\s*\(DA\):/i);
  const against = numberAfter(text, /Contra\s*\(NU\):/i);
  const abstention = numberAfter(text, /Abtineri\s*\(AB\):/i);
  const presentNotVoting = numberAfter(text, /Nu au votat\s*\(-\):/i);
  if ([forVotes, against, abstention, presentNotVoting].some((value) => value === undefined)) return undefined;
  return {
    for: forVotes ?? 0,
    against: against ?? 0,
    abstention: abstention ?? 0,
    presentNotVoting: presentNotVoting ?? 0
  };
}

function numberAfter(text: string, marker: RegExp): number | undefined {
  const index = text.search(marker);
  if (index === -1) return undefined;
  const match = text.slice(index).match(/\b(\d+)\b/);
  return match ? Number(match[1]) : undefined;
}

function groupIdFromLabel(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\(afiliat\)/i, "").trim();
  const slug = slugify(normalized);
  if (!slug) return undefined;
  if (/neafili/i.test(normalized)) return "group-deputies-unaffiliated";
  if (/minorit/i.test(normalized)) return "group-deputies-minoritati";
  if (/^SOS\b/i.test(normalized)) return "group-deputies-sos-ro";
  return `group-deputies-${slug}`;
}

function choiceFromText(value: string): VoteChoice {
  if (value.trim() === "-") return "present_not_voting";
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/\bpentru\b|\bda\b/.test(normalized)) return "for";
  if (/\bcontra\b|\bnu\b/.test(normalized)) return "against";
  if (/abtin|\bab\b/.test(normalized)) return "abstention";
  if (/nu a votat|nevotat/.test(normalized)) return "present_not_voting";
  return "unknown";
}

function inferDate(text: string): string | undefined {
  const match = text.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}
