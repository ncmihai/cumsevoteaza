import { formatDate, type GovernanceAlignment } from "@cumsevoteaza/parliament-model";
import type { GovernmentContextData } from "@/lib/data";
import type { AppLocale } from "@/lib/i18n";

interface GovernmentContextPanelProps {
  context?: GovernmentContextData;
  locale: AppLocale;
}

export function GovernmentContextPanel({ context, locale }: GovernmentContextPanelProps) {
  if (!context) return null;

  const labels = governmentContextLabels[locale];
  const visibleAlignments = context.alignments.filter((item) => item.alignment !== "opposition" && item.alignment !== "unknown");

  return (
    <section className="mt-6 border border-slate-300 bg-white">
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_2fr]">
        <div>
          <div className="text-xs font-semibold uppercase text-teal-700">{labels.title}</div>
          <div className="mt-2 text-xl font-semibold text-slate-950">{context.government.name}</div>
          <div className="mt-1 text-sm text-slate-600">
            {formatDate(context.government.startsOn, locale)}
            {" - "}
            {context.government.endsOn ? formatDate(context.government.endsOn, locale) : labels.present}
          </div>
          <div className="mt-2 text-sm text-slate-600">
            {labels.asOf} {formatDate(context.asOf, locale)}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">{labels.alignment}</div>
          {visibleAlignments.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {visibleAlignments.map((item) => (
                <span
                  key={`${item.party.id}-${item.alignment}-${item.startsOn}`}
                  className="inline-flex items-center gap-2 border border-slate-300 px-2 py-1 text-sm text-slate-800"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.party.color }} />
                  <span className="font-medium">{item.party.shortName}</span>
                  <span className="text-slate-500">{alignmentLabel(item.alignment, locale)}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">{labels.noAlignment}</p>
          )}
          {context.hasCuratedCoalitionData ? (
            <p className="mt-3 text-xs text-slate-500">{labels.oppositionNote}</p>
          ) : (
            <p className="mt-3 text-xs text-slate-500">{labels.unknownNote}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function alignmentLabel(alignment: GovernanceAlignment, locale: AppLocale): string {
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
  } satisfies Record<AppLocale, Record<GovernanceAlignment, string>>;
  return labels[locale][alignment];
}

const governmentContextLabels = {
  ro: {
    title: "Context guvernamental",
    alignment: "Coaliție și susținere cunoscută",
    asOf: "La data:",
    present: "prezent",
    noAlignment: "Nu avem încă partide sau grupuri verificate pentru acest guvern.",
    oppositionNote: "Partidele neafișate aici sunt tratate ca opoziție doar în perioadele unde coaliția este curată explicit.",
    unknownNote: "Pentru această perioadă nu există încă o mapare curată a coaliției."
  },
  en: {
    title: "Government context",
    alignment: "Known coalition and support",
    asOf: "As of:",
    present: "present",
    noAlignment: "No verified party or group alignment is available for this government yet.",
    oppositionNote: "Parties not shown here are treated as opposition only where the coalition has been explicitly curated.",
    unknownNote: "This period does not yet have a curated coalition map."
  }
} satisfies Record<AppLocale, Record<string, string>>;
