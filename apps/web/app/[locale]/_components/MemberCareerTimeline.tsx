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
          <div className="relative h-20 border-y-4 border-slate-950 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:28px_28px]">
            {sorted.map((segment) => {
              const left = ((dateMs(segment.startsOn) - start) / span) * 100;
              const width = Math.max(3, (((dateMs(segment.endsOn) || end) - dateMs(segment.startsOn)) / span) * 100);
              return (
                <div
                  key={segment.id}
                  className="absolute top-5 h-8 border-x border-white"
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
              </div>
            ))}
          </div>
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
