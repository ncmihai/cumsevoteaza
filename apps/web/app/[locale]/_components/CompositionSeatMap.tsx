"use client";

import Link from "next/link";
import { useState } from "react";
import { chamberLabels, type ChamberId, type GovernanceAlignment, type Locale } from "@cumsevoteaza/parliament-model";
import type { CompositionSeat } from "@/lib/composition-data";

interface CompositionSeatMapProps {
  locale: Locale;
  chamber: ChamberId;
  seats: CompositionSeat[];
}

interface PositionedSeat {
  seat: CompositionSeat;
  left: number;
  top: number;
}

interface SeatSlot {
  left: number;
  top: number;
  progress: number;
  rowIndex: number;
}

const alignmentBorderColor: Record<GovernanceAlignment, string> = {
  government: "#10b981",
  governing_support: "#84cc16",
  opposition: "#0ea5e9",
  mixed: "#f59e0b",
  unaffiliated: "#94a3b8",
  unknown: "#cbd5e1"
};

export function CompositionSeatMap({ locale, chamber, seats }: CompositionSeatMapProps) {
  const labels = compositionMapLabels[locale];
  const positionedSeats = positionSeats(seats);
  const [pinnedSeatId, setPinnedSeatId] = useState<string | undefined>();

  return (
    <section className="border border-slate-300 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{chamberLabels[locale][chamber]}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {seats.length} {labels.seats}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          {Object.entries(labels.alignments).map(([alignment, label]) => (
            <span key={alignment} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full border-2 bg-white"
                style={{ borderColor: alignmentBorderColor[alignment as GovernanceAlignment] }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative isolate mx-auto mt-4 aspect-[2/1] min-h-[190px] w-full max-w-5xl overflow-visible sm:min-h-[220px]">
        <div className="pointer-events-none absolute left-1/2 top-[77%] z-0 -translate-x-1/2 text-center">
          <div className="text-5xl font-semibold leading-none tracking-normal text-slate-950 md:text-6xl">{seats.length}</div>
          <div className="mt-1 text-xs font-semibold uppercase text-slate-500">{labels.seats}</div>
        </div>
        {positionedSeats.map(({ seat, left, top }) => {
          const groupLabel = seat.group?.shortName ?? labels.unknownGroup;
          const alignmentLabel = labels.alignments[seat.alignment];
          const pinned = pinnedSeatId === seat.member.id;
          const profileHref = `/${locale}/members/${seat.member.slug}`;
          return (
            <div
              key={seat.member.id}
              className={["group/seat absolute", pinned ? "z-[500]" : "z-10 hover:z-[200]"].join(" ")}
              style={{
                left: percent(left),
                top: percent(top),
                transform: "translate(-50%, -50%)"
              }}
            >
              <button
                type="button"
                title={`${seat.member.displayName} · ${groupLabel} · ${alignmentLabel}`}
                onClick={() => setPinnedSeatId(pinned ? undefined : seat.member.id)}
                className="block rounded-full border-2 shadow-sm outline-offset-2 transition hover:scale-125 focus-visible:scale-125"
                style={{
                  width: seatSize(seats.length),
                  height: seatSize(seats.length),
                  backgroundColor: seat.group?.color ?? "#94a3b8",
                  borderColor: alignmentBorderColor[seat.alignment]
                }}
              >
                <span className="sr-only">
                  {seat.member.displayName} {groupLabel} {alignmentLabel}
                </span>
              </button>
              <Link
                href={profileHref}
                className={[
                  "absolute left-1/2 top-0 z-[600] min-w-max -translate-x-1/2 -translate-y-[calc(100%+8px)] border border-slate-300 bg-white px-2 py-1 text-left text-[11px] font-medium leading-tight text-slate-950 shadow-md",
                  pinned ? "block" : "pointer-events-none hidden group-hover/seat:block group-focus-within/seat:block"
                ].join(" ")}
              >
                {seat.member.displayName}
                <span className="mt-0.5 block font-normal text-slate-600">
                  {groupLabel} · {alignmentLabel}
                </span>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function positionSeats(seats: CompositionSeat[]): PositionedSeat[] {
  const orderedSeats = [...seats].sort(
    (a, b) =>
      (a.group?.shortName ?? "zzzz").localeCompare(b.group?.shortName ?? "zzzz", "ro") ||
      a.member.displayName.localeCompare(b.member.displayName, "ro")
  );
  const slots = buildSeatSlots(orderedSeats.length);
  return orderedSeats.flatMap((seat, index) => {
    const slot = slots[index];
    if (!slot) return [];
    return { seat, left: slot.left, top: slot.top };
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

function seatSize(total: number): string {
  if (total > 260) return "clamp(6px, 1.45vw, 13px)";
  if (total > 150) return "clamp(7px, 1.75vw, 14px)";
  return "clamp(9px, 2.15vw, 16px)";
}

function percent(value: number): string {
  return `${value.toFixed(4)}%`;
}

const compositionMapLabels = {
  ro: {
    seats: "mandate",
    unknownGroup: "Grup necunoscut",
    alignments: {
      government: "Guvern",
      governing_support: "Susținere",
      opposition: "Opoziție",
      mixed: "Mixt",
      unaffiliated: "Neafiliat",
      unknown: "Necunoscut"
    }
  },
  en: {
    seats: "seats",
    unknownGroup: "Unknown group",
    alignments: {
      government: "Government",
      governing_support: "Support",
      opposition: "Opposition",
      mixed: "Mixed",
      unaffiliated: "Unaffiliated",
      unknown: "Unknown"
    }
  }
} satisfies Record<Locale, { seats: string; unknownGroup: string; alignments: Record<GovernanceAlignment, string> }>;
