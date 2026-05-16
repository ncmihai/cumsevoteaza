"use client";

import { useMemo, useState } from "react";
import type {
  GroupVoteTotal,
  IndividualVote,
  Locale,
  Member,
  ParliamentaryGroup,
  VoteChoice
} from "@cumsevoteaza/parliament-model";
import { voteChoiceColors, voteChoiceLabels } from "@cumsevoteaza/parliament-model";

interface VoteExplorerProps {
  locale: Locale;
  groups: ParliamentaryGroup[];
  members: Member[];
  individualVotes: IndividualVote[];
  groupTotals: GroupVoteTotal[];
}

export function VoteExplorer({ locale, groups, members, individualVotes, groupTotals }: VoteExplorerProps) {
  const [activeGroup, setActiveGroup] = useState<string>("all");
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const visibleVotes = activeGroup === "all" ? individualVotes : individualVotes.filter((vote) => vote.groupId === activeGroup);
  const seats = materializeSeats(visibleVotes);

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="border border-slate-300 bg-white p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveGroup("all")}
            className={buttonClass(activeGroup === "all")}
          >
            Toate
          </button>
          {groups.map((group) => (
            <button
              type="button"
              key={group.id}
              onClick={() => setActiveGroup(group.id)}
              className={buttonClass(activeGroup === group.id)}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: group.color }} />
              {group.shortName}
            </button>
          ))}
        </div>

        <div className="mx-auto grid max-w-3xl grid-cols-12 gap-2 rounded-t-full border-t border-slate-300 px-4 pt-8">
          {seats.map((vote, index) => {
            const group = vote.groupId ? groupById.get(vote.groupId) : undefined;
            const member = memberById.get(vote.memberId);
            return (
              <div
                key={`${vote.id}-${index}`}
                title={`${member?.displayName ?? "Unknown"} · ${voteChoiceLabels[locale][vote.choice]}`}
                className="aspect-square rounded-full border border-white"
                style={{ backgroundColor: voteChoiceColors[vote.choice] }}
              >
                <span className="sr-only">
                  {member?.displayName} {group?.shortName} {voteChoiceLabels[locale][vote.choice]}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
          {(Object.keys(voteChoiceColors) as VoteChoice[]).map((choice) => (
            <span key={choice} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: voteChoiceColors[choice] }} />
              {voteChoiceLabels[locale][choice]}
            </span>
          ))}
        </div>
      </div>

      <div className="border border-slate-300 bg-white">
        <div className="border-b border-slate-300 px-4 py-3 text-sm font-semibold text-slate-950">
          Breakdown by group
        </div>
        <div className="divide-y divide-slate-200">
          {groupTotals.map((total) => {
            const group = groupById.get(total.groupId);
            return (
              <div key={total.id} className="grid grid-cols-[1fr_repeat(4,52px)] items-center gap-2 px-4 py-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: group?.color ?? "#64748b" }} />
                  {group?.shortName ?? total.groupId}
                </div>
                <span className="text-right text-emerald-700">{total.for}</span>
                <span className="text-right text-red-700">{total.against}</span>
                <span className="text-right text-amber-700">{total.abstention}</span>
                <span className="text-right text-slate-600">{total.presentNotVoting}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function materializeSeats(votes: IndividualVote[]): IndividualVote[] {
  if (votes.length >= 48) return votes;
  const repeated: IndividualVote[] = [];
  for (const vote of votes) {
    const repeats = vote.choice === "for" ? 12 : 4;
    for (let index = 0; index < repeats; index += 1) {
      repeated.push({ ...vote, id: `${vote.id}-${index}` });
    }
  }
  return repeated;
}

function buttonClass(active: boolean) {
  return [
    "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
    active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
  ].join(" ");
}
