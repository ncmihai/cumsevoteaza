import type { Locale, MemberCareerSegment } from "@cumsevoteaza/parliament-model";
import { chamberLabels, formatDate } from "@cumsevoteaza/parliament-model";
import Link from "next/link";
import type { ReactNode } from "react";

export function MemberCareerTimeline({
  segments,
  locale
}: {
  segments: MemberCareerSegment[];
  locale: Locale;
}) {
  if (segments.length === 0) return null;

  const sorted = [...segments].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  const displaySegments = mergeDisplaySegments(sorted);
  const start = dateMs(sorted[0]?.startsOn);
  const end = Math.max(...displaySegments.map((segment) => dateMs(segment.endsOn) || Date.now()), Date.now());
  const span = Math.max(1, end - start);
  const events = uniqueEvents(sorted);
  const legislatureBreaks = uniqueLegislatureBreaks(sorted);
  const labels = timelineLabels[locale];

  return (
    <section className="mt-6 border border-slate-300 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-[#309898]">
            {locale === "ro" ? "Traseu parlamentar" : "Parliamentary path"}
          </div>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            {locale === "ro" ? "Partide și grupuri în timp" : "Parties and groups over time"}
          </h2>
        </div>
        <div className="text-sm text-slate-600">
          {yearLabel(sorted[0]?.startsOn)} - {yearLabel(sorted.at(-1)?.endsOn) ?? (locale === "ro" ? "prezent" : "present")}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto pb-2">
        <div className="min-w-[680px]">
          <div className="relative h-36 border border-slate-200 bg-slate-50">
            <div className="absolute left-0 right-0 top-[74px] h-px bg-slate-300" />
            {legislatureBreaks.map((breakpoint) => {
              const left = ((dateMs(breakpoint.date) - start) / span) * 100;
              return (
                <div
                  key={breakpoint.id}
                  className="absolute bottom-6 top-3 z-[1] w-px bg-slate-500"
                  style={{ left: `${left}%` }}
                  title={breakpoint.label}
                >
                  <span className="absolute -left-8 top-full mt-1 whitespace-nowrap border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm">
                    {breakpoint.label}
                  </span>
                </div>
              );
            })}
            {displaySegments.map((segment, index) => {
              const left = ((dateMs(segment.startsOn) - start) / span) * 100;
              const width = Math.max(3, (((dateMs(segment.endsOn) || end) - dateMs(segment.startsOn)) / span) * 100);
              return (
                <div
                  key={segment.id}
                  className="absolute top-16 z-[2] h-10 overflow-hidden border-x border-white shadow-sm"
                  style={{
                    left: `${left}%`,
                    width: `${Math.min(width, 100 - left)}%`,
                    backgroundColor: segment.color ?? "#FF9F00"
                  }}
                  title={`${segment.label}: ${formatDate(segment.startsOn, locale)} - ${
                    segment.endsOn ? formatDate(segment.endsOn, locale) : locale === "ro" ? "prezent" : "present"
                  }`}
                >
                  {(segment.governance ?? []).map((context) => {
                    const contextStart = Math.max(dateMs(context.startsOn), dateMs(segment.startsOn));
                    const contextEnd = Math.min(dateMs(context.endsOn) || end, dateMs(segment.endsOn) || end);
                    const segmentStart = dateMs(segment.startsOn);
                    const segmentSpan = Math.max(1, (dateMs(segment.endsOn) || end) - segmentStart);
                    const contextLeft = ((contextStart - segmentStart) / segmentSpan) * 100;
                    const contextWidth = Math.max(1, ((contextEnd - contextStart) / segmentSpan) * 100);
                    return (
                      <span
                        key={`${segment.id}-${context.governmentId}-${context.startsOn}-${context.alignment}`}
                        className="absolute bottom-0 h-1.5"
                        style={{
                          left: `${contextLeft}%`,
                          width: `${Math.min(contextWidth, 100 - contextLeft)}%`,
                          backgroundColor: alignmentColor(context.alignment)
                        }}
                        title={`${context.governmentName}: ${formatDate(context.startsOn, locale)} - ${
                          context.endsOn ? formatDate(context.endsOn, locale) : labels.present
                        } · ${alignmentLabel(context.alignment, locale)}`}
                      />
                    );
                  })}
                  <PartyMaybeLink
                    partySlug={segmentPartySlug(segment)}
                    locale={locale}
                    className="relative flex h-full items-center justify-center overflow-hidden px-2 pb-1.5 text-xs font-semibold text-slate-950 hover:underline"
                  >
                    {segmentLogoUrl(segment, sorted) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={segmentLogoUrl(segment, sorted)} alt="" className="mr-1 h-5 w-5 shrink-0 border border-white bg-white object-contain" />
                    ) : null}
                    <span className="truncate">{segmentLabel(segment, displaySegments[index - 1])}</span>
                  </PartyMaybeLink>
                </div>
              );
            })}
            {events.map((event) => {
              const left = ((dateMs(event.date) - start) / span) * 100;
              const label = locale === "ro" ? event.labelRo : event.labelEn;
              const description = locale === "ro" ? event.descriptionRo : event.descriptionEn;
              return (
                <a
                  key={event.id}
                  href={event.sourceUrl}
                  target={event.sourceUrl ? "_blank" : undefined}
                  rel={event.sourceUrl ? "noreferrer" : undefined}
                  className="group absolute top-2 z-10 -translate-x-1/2 text-center"
                  style={{ left: `${left}%` }}
                  title={`${formatDate(event.date, locale)} · ${description}`}
                >
                  <span className="mx-auto block h-4 w-4 border-2 border-white bg-[#309898] shadow-sm transition group-hover:scale-110 group-focus-visible:scale-110" />
                  <span className="mt-1 block max-w-28 truncate bg-white px-1 text-[10px] font-semibold text-slate-700 shadow-sm group-hover:text-[#0c6464] group-focus-visible:text-[#0c6464]">
                    {label}
                  </span>
                  <span className="pointer-events-none absolute left-1/2 top-8 z-30 hidden w-72 -translate-x-1/2 border border-slate-300 bg-white p-3 text-left text-xs text-slate-600 shadow-xl group-hover:block group-focus-visible:block">
                    <span className="block font-semibold text-slate-950">{formatDate(event.date, locale)} · {label}</span>
                    <span className="mt-1 block leading-5">{description}</span>
                    {event.sourceUrl ? <span className="mt-2 block font-medium text-[#309898]">{labels.openSource}</span> : null}
                  </span>
                </a>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase text-slate-500">
            {Object.entries(labels.alignments).map(([alignment, label]) => (
              <span key={alignment} className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-5" style={{ backgroundColor: alignmentColor(alignment as NonNullable<MemberCareerSegment["governance"]>[number]["alignment"]) }} />
                {label}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {displaySegments.map((segment) => (
              <PartyMaybeLink
                key={`${segment.id}-legend`}
                partySlug={segmentPartySlug(segment)}
                locale={locale}
                className="flex items-center gap-2 border border-slate-200 bg-slate-50 px-2 py-1 text-xs hover:border-[#309898]"
              >
                <span className="h-2.5 w-2.5" style={{ backgroundColor: segment.color ?? "#FF9F00" }} />
                {segmentLogoUrl(segment, sorted) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={segmentLogoUrl(segment, sorted)} alt="" className="h-5 w-5 border border-slate-200 bg-white object-contain" />
                ) : null}
                <span className="font-medium">{segment.label}</span>
                <span className="text-slate-500">
                  {formatDate(segment.startsOn, locale)} - {segment.endsOn ? formatDate(segment.endsOn, locale) : labels.present}
                </span>
                <span className="text-slate-500">{chamberLabels[locale][segment.chamber]}</span>
              </PartyMaybeLink>
            ))}
          </div>
          {events.length > 0 ? (
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase text-slate-500">{labels.whyChanged}</div>
              <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
              {events.map((event) => (
                <a
                  key={`${event.id}-note`}
                  href={event.sourceUrl}
                  target={event.sourceUrl ? "_blank" : undefined}
                  rel={event.sourceUrl ? "noreferrer" : undefined}
                  className="border border-slate-200 bg-white px-2 py-1 hover:border-[#309898]"
                >
                  <span className="font-semibold text-slate-950">
                    {formatDate(event.date, locale)} · {locale === "ro" ? event.labelRo : event.labelEn}
                  </span>
                  <span className="mt-0.5 block">{locale === "ro" ? event.descriptionRo : event.descriptionEn}</span>
                </a>
              ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function dateMs(value?: string): number {
  return value ? new Date(`${value}T00:00:00Z`).getTime() : 0;
}

function yearLabel(value?: string): string | undefined {
  return value?.slice(0, 4);
}

function mergeDisplaySegments(segments: MemberCareerSegment[]): MemberCareerSegment[] {
  const merged: MemberCareerSegment[] = [];
  for (const segment of segments) {
    const previous = merged.at(-1);
    if (
      previous &&
      previous.label === segment.label &&
      previous.chamber === segment.chamber &&
      rangesTouchOrOverlap(previous.endsOn, segment.startsOn)
    ) {
      previous.endsOn = maxOptionalDate(previous.endsOn, segment.endsOn);
      previous.events = mergeEvents(previous.events ?? [], segment.events ?? []);
      previous.governance = mergeGovernance(previous.governance ?? [], segment.governance ?? []);
      previous.logoUrl ??= segment.logoUrl;
      previous.color ??= segment.color;
      continue;
    }
    merged.push({
      ...segment,
      events: [...(segment.events ?? [])],
      governance: [...(segment.governance ?? [])]
    });
  }
  return merged;
}

function segmentLabel(segment: MemberCareerSegment, previous?: MemberCareerSegment): string {
  if (previous?.label === segment.label) return "";
  return segment.label;
}

function uniqueEvents(segments: MemberCareerSegment[]): NonNullable<MemberCareerSegment["events"]> {
  const events = new Map<string, NonNullable<MemberCareerSegment["events"]>[number]>();
  for (const segment of segments) {
    for (const event of segment.events ?? []) {
      events.set(event.id, event);
    }
  }
  return [...events.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function uniqueLegislatureBreaks(segments: MemberCareerSegment[]): Array<{ id: string; date: string; label: string }> {
  const breaks = new Map<string, { id: string; date: string; label: string }>();
  for (const segment of segments) {
    if (!segment.legislatureId) continue;
    const label = segment.legislatureId.replace(/^leg-/, "");
    const existing = breaks.get(segment.legislatureId);
    if (existing && existing.date <= segment.startsOn) continue;
    breaks.set(segment.legislatureId, {
      id: segment.legislatureId,
      date: segment.startsOn,
      label
    });
  }
  return [...breaks.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function mergeEvents(
  a: NonNullable<MemberCareerSegment["events"]>,
  b: NonNullable<MemberCareerSegment["events"]>
): NonNullable<MemberCareerSegment["events"]> {
  const events = new Map([...a, ...b].map((event) => [event.id, event]));
  return [...events.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function mergeGovernance(
  a: NonNullable<MemberCareerSegment["governance"]>,
  b: NonNullable<MemberCareerSegment["governance"]>
): NonNullable<MemberCareerSegment["governance"]> {
  const contexts = new Map([...a, ...b].map((context) => [[context.governmentId, context.alignment, context.startsOn, context.endsOn ?? ""].join("|"), context]));
  return [...contexts.values()].sort((left, right) => left.startsOn.localeCompare(right.startsOn));
}

function rangesTouchOrOverlap(end: string | undefined, nextStart: string): boolean {
  if (!end) return true;
  return dateMs(nextStart) <= dateMs(end) + 24 * 60 * 60 * 1000;
}

function maxOptionalDate(a?: string, b?: string): string | undefined {
  if (!a || !b) return undefined;
  return a > b ? a : b;
}

function alignmentColor(alignment: NonNullable<MemberCareerSegment["governance"]>[number]["alignment"]): string {
  return {
    government: "#10b981",
    governing_support: "#84cc16",
    opposition: "#0ea5e9",
    mixed: "#f59e0b",
    unaffiliated: "#94a3b8",
    unknown: "#cbd5e1"
  }[alignment];
}

function alignmentLabel(alignment: NonNullable<MemberCareerSegment["governance"]>[number]["alignment"], locale: Locale): string {
  return timelineLabels[locale].alignments[alignment];
}

function segmentPartySlug(segment: MemberCareerSegment): string | undefined {
  return segment.partySlug ?? knownPartySlugByLabel[segment.label.trim().toUpperCase()];
}

function segmentLogoUrl(segment: MemberCareerSegment, allSegments: MemberCareerSegment[]): string | undefined {
  const slug = segmentPartySlug(segment);
  if (!segment.logoUrl || !slug) return segment.logoUrl;
  if (logoLooksCompatible(segment.logoUrl, slug)) return segment.logoUrl;
  const compatible = allSegments
    .filter((candidate) => candidate.id !== segment.id && segmentPartySlug(candidate) === slug && candidate.logoUrl)
    .filter((candidate) => logoLooksCompatible(candidate.logoUrl!, slug))
    .sort((a, b) => Math.abs(dateMs(a.startsOn) - dateMs(segment.startsOn)) - Math.abs(dateMs(b.startsOn) - dateMs(segment.startsOn)));
  return compatible[0]?.logoUrl ?? segment.logoUrl;
}

function logoLooksCompatible(logoUrl: string, slug: string): boolean {
  const normalized = logoUrl.toLowerCase().replace(/[^a-z0-9]/g, "");
  const tokens = logoTokensBySlug[slug] ?? [slug.replace(/-/g, "")];
  return tokens.some((token) => normalized.includes(token));
}

const timelineLabels = {
  ro: {
    present: "prezent",
    whyChanged: "De ce s-a schimbat traseul",
    openSource: "Deschide sursa",
    alignments: {
      government: "guvern",
      governing_support: "susținere",
      opposition: "opoziție",
      mixed: "mixt",
      unaffiliated: "neafiliat",
      unknown: "necunoscut"
    }
  },
  en: {
    present: "present",
    whyChanged: "Why the path changed",
    openSource: "Open source",
    alignments: {
      government: "government",
      governing_support: "support",
      opposition: "opposition",
      mixed: "mixed",
      unaffiliated: "unaffiliated",
      unknown: "unknown"
    }
  }
} as const;

function PartyMaybeLink({
  partySlug,
  locale,
  className,
  children
}: {
  partySlug?: string;
  locale: Locale;
  className: string;
  children: ReactNode;
}) {
  if (!partySlug) return <span className={className}>{children}</span>;
  return (
    <Link href={`/${locale}/parties/${partySlug}`} className={className}>
      {children}
    </Link>
  );
}

const knownPartySlugByLabel: Record<string, string> = {
  ALDE: "alde",
  AUR: "aur",
  PC: "pc",
  PD: "pd",
  PDL: "pdl",
  PDSR: "pdsr",
  PER: "per",
  PMP: "pmp",
  PNL: "pnl",
  "PNȚCD": "pntcd",
  PNTCD: "pntcd",
  POT: "pot",
  "PRO ROMÂNIA": "pro-romania",
  "PRO ROMANIA": "pro-romania",
  PRM: "prm",
  PSD: "psd",
  PSDR: "psdr",
  PUNR: "punr",
  PUR: "pur",
  PACE: "pace",
  "SOS RO": "sos-ro",
  "S.O.S. RO": "sos-ro",
  UDMR: "udmr",
  UNPR: "unpr",
  UPR: "upr",
  USR: "usr"
};

const logoTokensBySlug: Record<string, string[]> = {
  "pro-romania": ["proromania", "pro"],
  "sos-ro": ["sosro", "sos"],
  pntcd: ["pntcd"],
  pnl: ["pnl"],
  pdl: ["pdl"],
  pd: ["pd"],
  psd: ["psd"],
  pdsr: ["pdsr"],
  psdr: ["psdr"],
  pur: ["pur"],
  pc: ["pc"],
  prm: ["prm"],
  punr: ["punr"],
  udmr: ["udmr"],
  unpr: ["unpr"],
  usr: ["usr"],
  aur: ["aur"],
  pot: ["pot"],
  pmp: ["pmp"],
  alde: ["alde"]
};
