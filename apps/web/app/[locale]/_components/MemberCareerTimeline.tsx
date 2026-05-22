import type { Locale, MemberCareerSegment } from "@cumsevoteaza/parliament-model";
import { chamberLabels, formatDate } from "@cumsevoteaza/parliament-model";

export function MemberCareerTimeline({
  segments,
  locale
}: {
  segments: MemberCareerSegment[];
  locale: Locale;
}) {
  if (segments.length === 0) return null;

  const sorted = [...segments].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  const start = dateMs(sorted[0]?.startsOn);
  const end = Math.max(...sorted.map((segment) => dateMs(segment.endsOn) || Date.now()), Date.now());
  const span = Math.max(1, end - start);
  const events = uniqueEvents(sorted);
  const legislatureBreaks = uniqueLegislatureBreaks(sorted);

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
          <div className="relative h-28 border border-slate-200 bg-slate-50">
            <div className="absolute left-0 right-0 top-[62px] h-px bg-slate-300" />
            {legislatureBreaks.map((breakpoint) => {
              const left = ((dateMs(breakpoint.date) - start) / span) * 100;
              return (
                <div
                  key={breakpoint.id}
                  className="absolute bottom-4 top-4 w-px bg-slate-300"
                  style={{ left: `${left}%` }}
                  title={breakpoint.label}
                >
                  <span className="absolute -left-4 top-full mt-1 text-[10px] font-semibold text-slate-500">
                    {breakpoint.label}
                  </span>
                </div>
              );
            })}
            {sorted.map((segment) => {
              const left = ((dateMs(segment.startsOn) - start) / span) * 100;
              const width = Math.max(3, (((dateMs(segment.endsOn) || end) - dateMs(segment.startsOn)) / span) * 100);
              return (
                <div
                  key={segment.id}
                  className="absolute top-12 h-9 border-x border-white shadow-sm"
                  style={{
                    left: `${left}%`,
                    width: `${Math.min(width, 100 - left)}%`,
                    backgroundColor: segment.color ?? "#FF9F00"
                  }}
                  title={`${segment.label}: ${formatDate(segment.startsOn, locale)} - ${
                    segment.endsOn ? formatDate(segment.endsOn, locale) : locale === "ro" ? "prezent" : "present"
                  }`}
                >
                  <div className="flex h-full items-center justify-center overflow-hidden px-2 text-xs font-semibold text-slate-950">
                    {segment.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={segment.logoUrl} alt="" className="mr-1 h-5 w-5 shrink-0 border border-white bg-white object-contain" />
                    ) : null}
                    <span className="truncate">{segment.label}</span>
                  </div>
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
                  className="absolute top-2 z-10 -translate-x-1/2 text-center"
                  style={{ left: `${left}%` }}
                  title={`${formatDate(event.date, locale)} · ${description}`}
                >
                  <span className="mx-auto block h-4 w-4 border-2 border-white bg-[#309898] shadow-sm" />
                  <span className="mt-1 block max-w-28 truncate bg-white px-1 text-[10px] font-semibold text-slate-700 shadow-sm">
                    {label}
                  </span>
                </a>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {sorted.map((segment) => (
              <div key={`${segment.id}-legend`} className="flex items-center gap-2 border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                <span className="h-2.5 w-2.5" style={{ backgroundColor: segment.color ?? "#FF9F00" }} />
                <span className="font-medium">{segment.label}</span>
                <span className="text-slate-500">
                  {formatDate(segment.startsOn, locale)} - {segment.endsOn ? formatDate(segment.endsOn, locale) : locale === "ro" ? "prezent" : "present"}
                </span>
                <span className="text-slate-500">{chamberLabels[locale][segment.chamber]}</span>
                {segment.governance?.slice(0, 2).map((context) => (
                  <span
                    key={`${segment.id}-${context.governmentId}-${context.startsOn}-${context.alignment}`}
                    className="border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600"
                    title={`${context.governmentName}: ${formatDate(context.startsOn, locale)} - ${
                      context.endsOn ? formatDate(context.endsOn, locale) : locale === "ro" ? "prezent" : "present"
                    }`}
                  >
                    {context.governmentName}: {alignmentLabel(context.alignment, locale)}
                  </span>
                ))}
                {(segment.governance?.length ?? 0) > 2 ? (
                  <span className="text-[10px] font-semibold text-slate-500">+{(segment.governance?.length ?? 0) - 2}</span>
                ) : null}
              </div>
            ))}
          </div>
          {events.length > 0 ? (
            <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
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
    breaks.set(segment.legislatureId, {
      id: segment.legislatureId,
      date: segment.startsOn,
      label
    });
  }
  return [...breaks.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function alignmentLabel(alignment: NonNullable<MemberCareerSegment["governance"]>[number]["alignment"], locale: Locale): string {
  const labels = {
    ro: {
      government: "guvern",
      governing_support: "susținere",
      opposition: "opoziție",
      mixed: "mixt",
      unaffiliated: "neafiliat",
      unknown: "necunoscut"
    },
    en: {
      government: "government",
      governing_support: "support",
      opposition: "opposition",
      mixed: "mixed",
      unaffiliated: "unaffiliated",
      unknown: "unknown"
    }
  } as const;
  return labels[locale][alignment];
}
