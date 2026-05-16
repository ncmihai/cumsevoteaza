"use client";

import Link from "next/link";
import { Check, Circle, CircleHelp, Minus, X } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  ChamberId,
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
  chamber: ChamberId;
  groups: ParliamentaryGroup[];
  members: Member[];
  individualVotes: IndividualVote[];
  groupTotals: GroupVoteTotal[];
}

interface PositionedSeat {
  vote: IndividualVote;
  member?: Member;
  group?: ParliamentaryGroup;
  left: number;
  top: number;
}

const choiceOrder: VoteChoice[] = ["for", "against", "abstention", "present_not_voting", "absent", "unknown"];

interface SeatSlot {
  left: number;
  top: number;
  progress: number;
  rowIndex: number;
}

export function VoteExplorer({ locale, chamber, groups, members, individualVotes, groupTotals }: VoteExplorerProps) {
  const [activeGroup, setActiveGroup] = useState<string>("all");
  const [activeChoice, setActiveChoice] = useState<VoteChoice | "all">("all");
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);

  const chamberGroups = useMemo(() => {
    const usedGroupIds = new Set([
      ...individualVotes.flatMap((vote) => (vote.groupId ? [vote.groupId] : [])),
      ...groupTotals.map((total) => total.groupId)
    ]);
    return groups
      .filter((group) => group.chamber === chamber && usedGroupIds.has(group.id))
      .sort((a, b) => countSeats(individualVotes, b.id) - countSeats(individualVotes, a.id) || a.shortName.localeCompare(b.shortName, "ro"));
  }, [chamber, groupTotals, groups, individualVotes]);

  const orderedVotes = useMemo(
    () =>
      orderVotesByGroup({
        votes: individualVotes,
        groups: chamberGroups,
        members: memberById
      }),
    [chamberGroups, individualVotes, memberById]
  );
  const seats = useMemo(() => positionSeats(orderedVotes, memberById, groupById), [groupById, memberById, orderedVotes]);
  const breakdown = useMemo(() => buildBreakdown(individualVotes, chamberGroups), [chamberGroups, individualVotes]);
  const voteCounts = useMemo(() => countChoices(individualVotes), [individualVotes]);
  const labels = explorerLabels[locale];

  return (
    <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_430px]">
      <div className="min-w-0 border border-slate-300 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setActiveGroup("all")} className={buttonClass(activeGroup === "all")}>
            {labels.allGroups}
          </button>
          {chamberGroups.map((group) => (
            <button
              type="button"
              key={group.id}
              onClick={() => setActiveGroup(activeGroup === group.id ? "all" : group.id)}
              className={buttonClass(activeGroup === group.id)}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: group.color }} />
              {group.shortName}
            </button>
          ))}
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setActiveChoice("all")} className={buttonClass(activeChoice === "all")}>
            {labels.allVotes}
          </button>
          {choiceOrder.map((choice) => (
            <button
              type="button"
              key={choice}
              onClick={() => setActiveChoice(activeChoice === choice ? "all" : choice)}
              className={buttonClass(activeChoice === choice)}
            >
              <VoteMark choice={choice} className="h-3.5 w-3.5" />
              {voteChoiceLabels[locale][choice]}
            </button>
          ))}
        </div>

        <div className="relative mx-auto aspect-[2/1] min-h-[250px] w-full max-w-5xl overflow-visible">
          <div className="absolute left-1/2 top-[77%] -translate-x-1/2 text-center">
            <div className="text-5xl font-semibold leading-none tracking-normal text-slate-950 md:text-6xl">{individualVotes.length}</div>
            <div className="mt-1 text-xs font-semibold uppercase text-slate-500">{labels.seats}</div>
          </div>
          {seats.map((seat) => {
            const muted =
              (activeGroup !== "all" && seat.vote.groupId !== activeGroup) ||
              (activeChoice !== "all" && seat.vote.choice !== activeChoice);
            const memberLabel = seat.member?.displayName ?? seat.vote.memberId;
            const groupLabel = seat.group?.shortName ?? labels.unknownGroup;
            const voteLabel = voteChoiceLabels[locale][seat.vote.choice];
            return (
              <Link
                key={seat.vote.id}
                href={seat.member ? `/${locale}/members/${seat.member.slug}` : `/${locale}/votes/${seat.vote.voteId}`}
                title={`${memberLabel} · ${groupLabel} · ${voteLabel}`}
                className={[
                  "group/seat absolute block rounded-full border border-white shadow-sm outline-offset-2 transition",
                  muted ? "opacity-20" : "opacity-100 hover:scale-125 focus:scale-125"
                ].join(" ")}
                style={{
                  left: percent(seat.left),
                  top: percent(seat.top),
                  width: seatSize(individualVotes.length),
                  height: seatSize(individualVotes.length),
                  backgroundColor: seat.group?.color ?? "#94a3b8",
                  transform: "translate(-50%, -50%)"
                }}
              >
                <span className="absolute bottom-0 right-0 grid h-[62%] w-[62%] translate-x-1/5 translate-y-1/5 place-items-center rounded-full border border-white bg-white">
                  <VoteMark choice={seat.vote.choice} className="h-[80%] w-[80%]" />
                </span>
                <span className="pointer-events-none absolute left-1/2 top-0 z-20 hidden min-w-max -translate-x-1/2 -translate-y-[calc(100%+8px)] border border-slate-300 bg-white px-2 py-1 text-left text-[11px] font-medium leading-tight text-slate-950 shadow-md group-hover/seat:block group-focus-visible/seat:block">
                  {memberLabel}
                  <span className="mt-0.5 block font-normal text-slate-600">
                    {groupLabel} · {voteLabel}
                  </span>
                </span>
                <span className="sr-only">
                  {memberLabel} {groupLabel} {voteLabel}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
          {choiceOrder.map((choice) => (
            <span key={choice} className="inline-flex items-center gap-1.5">
              <VoteMark choice={choice} className="h-3.5 w-3.5" />
              {voteChoiceLabels[locale][choice]}: {voteCounts[choice]}
            </span>
          ))}
        </div>
      </div>

      <div className="min-w-0 overflow-hidden border border-slate-300 bg-white">
        <div className="border-b border-slate-300 px-4 py-3 text-sm font-semibold text-slate-950">
          {labels.groupBreakdown}
        </div>
        <div className="divide-y divide-slate-200">
          {breakdown.map((row) => (
            <div
              key={row.group.id}
              className="grid grid-cols-[minmax(0,1fr)_repeat(5,minmax(30px,42px))] items-center gap-2 px-4 py-3 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2 font-medium">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.group.color }} />
                <span className="truncate">{row.group.shortName}</span>
              </div>
              <span className="text-right text-emerald-700">{row.counts.for}</span>
              <span className="text-right text-red-700">{row.counts.against}</span>
              <span className="text-right text-amber-700">{row.counts.abstention}</span>
              <span className="text-right text-slate-600">{row.counts.present_not_voting}</span>
              <span className="text-right text-slate-400">{row.counts.absent + row.counts.unknown}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function orderVotesByGroup(input: {
  votes: IndividualVote[];
  groups: ParliamentaryGroup[];
  members: Map<string, Member>;
}): IndividualVote[] {
  const groupOrder = new Map(input.groups.map((group, index) => [group.id, index]));
  return [...input.votes].sort((a, b) => {
    const groupA = a.groupId ? groupOrder.get(a.groupId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    const groupB = b.groupId ? groupOrder.get(b.groupId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    const memberA = input.members.get(a.memberId)?.displayName ?? a.memberId;
    const memberB = input.members.get(b.memberId)?.displayName ?? b.memberId;
    return groupA - groupB || memberA.localeCompare(memberB, "ro");
  });
}

function positionSeats(
  votes: IndividualVote[],
  members: Map<string, Member>,
  groups: Map<string, ParliamentaryGroup>
): PositionedSeat[] {
  const slots = buildSeatSlots(votes.length);
  return votes.flatMap((vote, index) => {
    const slot = slots[index];
    if (!slot) return [];
    return {
      vote,
      member: members.get(vote.memberId),
      group: vote.groupId ? groups.get(vote.groupId) : undefined,
      left: slot.left,
      top: slot.top
    };
  });
}

function buildSeatSlots(total: number): SeatSlot[] {
  const rows = total > 260 ? 8 : total > 170 ? 7 : 6;
  const counts = distributeCounts(total, rows);
  const slots: SeatSlot[] = [];

  counts.forEach((count, rowIndex) => {
    const radius = 22 + (rowIndex / Math.max(rows - 1, 1)) * 34;
    const startAngle = 210;
    const endAngle = 330;
    for (let seatIndex = 0; seatIndex < count; seatIndex += 1) {
      const progress = count === 1 ? 0.5 : seatIndex / (count - 1);
      const angle = startAngle + progress * (endAngle - startAngle);
      const radians = (angle * Math.PI) / 180;
      slots.push({
        left: 50 + Math.cos(radians) * radius,
        top: 86 + Math.sin(radians) * radius,
        progress,
        rowIndex
      });
    }
  });

  return slots.sort((a, b) => a.progress - b.progress || b.rowIndex - a.rowIndex);
}

function distributeCounts(total: number, rows: number): number[] {
  if (total <= 0) return [];
  const weights = Array.from({ length: rows }, (_, index) => 0.62 + index * 0.34);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const counts = weights.map((weight) => Math.max(1, Math.round((total * weight) / weightTotal)));
  while (counts.reduce((sum, count) => sum + count, 0) > total) {
    const maxIndex = counts.indexOf(Math.max(...counts));
    counts[maxIndex] = (counts[maxIndex] ?? 1) - 1;
  }
  while (counts.reduce((sum, count) => sum + count, 0) < total) {
    const lastIndex = counts.length - 1;
    counts[lastIndex] = (counts[lastIndex] ?? 0) + 1;
  }
  return counts;
}

function buildBreakdown(votes: IndividualVote[], groups: ParliamentaryGroup[]) {
  return groups.map((group) => ({
    group,
    counts: countChoices(votes.filter((vote) => vote.groupId === group.id))
  }));
}

function countChoices(votes: IndividualVote[]): Record<VoteChoice, number> {
  return choiceOrder.reduce(
    (counts, choice) => ({
      ...counts,
      [choice]: votes.filter((vote) => vote.choice === choice).length
    }),
    {
      for: 0,
      against: 0,
      abstention: 0,
      present_not_voting: 0,
      absent: 0,
      unknown: 0
    }
  );
}

function countSeats(votes: IndividualVote[], groupId: string): number {
  return votes.filter((vote) => vote.groupId === groupId).length;
}

function seatSize(total: number): string {
  if (total > 260) return "clamp(6px, 1.45vw, 13px)";
  if (total > 150) return "clamp(7px, 1.75vw, 14px)";
  return "clamp(9px, 2.15vw, 16px)";
}

function percent(value: number): string {
  return `${value.toFixed(4)}%`;
}

function VoteMark({ choice, className }: { choice: VoteChoice; className?: string }) {
  const color = voteChoiceColors[choice];
  if (choice === "for") return <Check aria-hidden="true" className={className} color={color} strokeWidth={3.2} />;
  if (choice === "against") return <X aria-hidden="true" className={className} color={color} strokeWidth={3.2} />;
  if (choice === "abstention") return <Minus aria-hidden="true" className={className} color={color} strokeWidth={3.2} />;
  if (choice === "present_not_voting") return <Circle aria-hidden="true" className={className} color={color} strokeWidth={2.7} />;
  if (choice === "unknown") return <CircleHelp aria-hidden="true" className={className} color={color} strokeWidth={2.7} />;
  return <Minus aria-hidden="true" className={className} color={color} strokeWidth={3.2} />;
}

function buttonClass(active: boolean) {
  return [
    "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
    active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
  ].join(" ");
}

const explorerLabels = {
  ro: {
    allGroups: "Toate grupurile",
    allVotes: "Toate voturile",
    groupBreakdown: "Distribuție pe grupuri",
    seats: "mandate",
    unknownGroup: "Grup necunoscut"
  },
  en: {
    allGroups: "All groups",
    allVotes: "All votes",
    groupBreakdown: "Breakdown by group",
    seats: "seats",
    unknownGroup: "Unknown group"
  }
} satisfies Record<Locale, Record<string, string>>;
