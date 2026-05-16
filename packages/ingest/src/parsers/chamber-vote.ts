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
    const candidateName = cells.find((cell) => /\s/.test(cell) && cell.length > 5);
    const voteCell = cells.find((cell) => choiceFromText(cell) !== "unknown");
    if (!candidateName || !voteCell) return;

    const displayName = titleCase(candidateName);
    const memberId = `member-deputies-${slugify(displayName)}`;
    members.set(memberId, {
      id: memberId,
      slug: slugify(displayName),
      firstName: displayName.split(" ").slice(0, -1).join(" ") || displayName,
      lastName: displayName.split(" ").at(-1) ?? displayName,
      displayName,
      sourceIds: {}
    });
    individualVotes.push({
      id: `iv-${voteId}-${memberId}`,
      voteId,
      memberId,
      choice: choiceFromText(voteCell)
    });
  });

  if (individualVotes.length === 0) {
    warnings.push("No nominal vote rows detected. Source structure may require a specific Chamber parser update.");
  }

  return {
    sourceSnapshot: {
      ...sourceSnapshot,
      status: individualVotes.length > 0 ? "partial" : "failed",
      notes: warnings.join(" ")
    },
    vote: {
      id: voteId,
      chamber: "deputies",
      title: $("title").first().text() || "Chamber nominal vote",
      heldOn,
      voteType: "nominal",
      totals: {
        present: individualVotes.length,
        for: individualVotes.filter((vote) => vote.choice === "for").length,
        against: individualVotes.filter((vote) => vote.choice === "against").length,
        abstention: individualVotes.filter((vote) => vote.choice === "abstention").length,
        presentNotVoting: individualVotes.filter((vote) => vote.choice === "present_not_voting").length
      },
      sourceSnapshotId: sourceSnapshot.id
    },
    members: [...members.values()],
    individualVotes,
    warnings
  };
}

function choiceFromText(value: string): VoteChoice {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/\bpentru\b|\bda\b/.test(normalized)) return "for";
  if (/\bcontra\b|\bnu\b/.test(normalized)) return "against";
  if (/abtin/.test(normalized)) return "abstention";
  if (/nu a votat|nevotat/.test(normalized)) return "present_not_voting";
  return "unknown";
}

function inferDate(text: string): string | undefined {
  const match = text.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}
