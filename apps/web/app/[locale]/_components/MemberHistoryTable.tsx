import type { Legislature, Locale, MemberHistoryRow } from "@cumsevoteaza/parliament-model";
import { chamberLabels, formatDate } from "@cumsevoteaza/parliament-model";

export function MemberHistoryTable({
  rows,
  locale,
  legislatures,
  labels
}: {
  rows: MemberHistoryRow[];
  locale: Locale;
  legislatures: Legislature[];
  labels: {
    period: string;
    chamber: string;
    type: string;
    details: string;
    votesFor: string;
    votesAgainst: string;
    abstentions: string;
    proposals: string;
  };
}) {
  const sections = groupRowsByLegislature(rows, legislatures);

  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const chambers = unique(section.rows.map((row) => chamberLabels[locale][row.chamber]));
        const logos = unique(section.rows.map((row) => row.logoUrl).filter((logoUrl): logoUrl is string => Boolean(logoUrl))).slice(0, 6);
        const firstDate = section.rows.map((row) => row.startsOn).sort()[0];
        const lastDate = section.rows
          .map((row) => row.endsOn ?? "")
          .filter(Boolean)
          .sort()
          .at(-1);

        return (
          <section key={section.id} className="border border-slate-300 bg-white">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-300 px-4 py-3">
              <div>
                <div className="text-xs font-semibold uppercase text-blue-800">
                  {locale === "ro" ? "Legislatura" : "Legislature"}
                </div>
                <h3 className="mt-1 text-2xl font-semibold text-slate-950">{section.label}</h3>
                <div className="mt-1 text-sm text-slate-600">
                  {firstDate ? formatDate(firstDate, locale) : "-"}
                  {" - "}
                  {lastDate ? formatDate(lastDate, locale) : locale === "ro" ? "prezent" : "present"}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {logos.map((logoUrl) => (
                  <span key={logoUrl} className="flex h-9 w-9 items-center justify-center border border-slate-200 bg-white p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                  </span>
                ))}
                <span className="border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700">
                  {section.rows.length} {locale === "ro" ? "rânduri" : "rows"}
                </span>
                {chambers.map((chamber) => (
                  <span key={chamber} className="border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700">
                    {chamber}
                  </span>
                ))}
              </div>
            </div>
            <div className="max-h-[560px] overflow-auto">
              <table className="min-w-[900px] w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 text-left text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2">{labels.period}</th>
                    <th className="px-3 py-2">{labels.chamber}</th>
                    <th className="px-3 py-2">{labels.type}</th>
                    <th className="px-3 py-2">{labels.details}</th>
                    <th className="px-3 py-2 text-right">{labels.votesFor}</th>
                    <th className="px-3 py-2 text-right">{labels.votesAgainst}</th>
                    <th className="px-3 py-2 text-right">{labels.abstentions}</th>
                    <th className="px-3 py-2 text-right">{labels.proposals}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {section.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3 font-medium">
                        {formatDate(row.startsOn, locale)}
                        {" - "}
                        {row.endsOn ? formatDate(row.endsOn, locale) : locale === "ro" ? "prezent" : "present"}
                      </td>
                      <td className="px-3 py-3">{chamberLabels[locale][row.chamber]}</td>
                      <td className="px-3 py-3">{historyTypeLabels[locale][row.type]}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-start gap-2">
                          {row.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={row.logoUrl} alt="" className="mt-0.5 h-7 w-7 shrink-0 border border-slate-200 bg-white object-contain" />
                          ) : null}
                          <div>
                            <div className="font-medium text-slate-950">{row.label}</div>
                            <div className="text-slate-600">
                              {row.sourceUrl ? (
                                <a className="underline underline-offset-2" href={row.sourceUrl} target="_blank" rel="noreferrer">
                                  {row.details}
                                </a>
                              ) : (
                                row.details
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">{row.votesFor}</td>
                      <td className="px-3 py-3 text-right">{row.votesAgainst}</td>
                      <td className="px-3 py-3 text-right">{row.abstentions}</td>
                      <td className="px-3 py-3 text-right">{row.proposals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

const historyTypeLabels: Record<Locale, Record<MemberHistoryRow["type"], string>> = {
  ro: {
    mandate: "Mandat",
    group: "Grup",
    party: "Partid/Formațiune",
    committee: "Comisie",
    role: "Rol",
    relation: "Înlocuire"
  },
  en: {
    mandate: "Mandate",
    group: "Group",
    party: "Party/formation",
    committee: "Committee",
    role: "Role",
    relation: "Replacement"
  }
};

function groupRowsByLegislature(rows: MemberHistoryRow[], legislatures: Legislature[]) {
  const legislatureById = new Map(legislatures.map((legislature) => [legislature.id, legislature]));
  const groups = new Map<string, MemberHistoryRow[]>();
  for (const row of rows) {
    const key = row.legislatureId ?? "unknown";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return Array.from(groups.entries())
    .map(([id, sectionRows]) => {
      const legislature = legislatureById.get(id);
      return {
        id,
        label: legislature?.label ?? "unknown",
        startsOn: legislature?.startsOn ?? sectionRows.map((row) => row.startsOn).sort()[0] ?? "",
        rows: sectionRows.sort((a, b) => b.startsOn.localeCompare(a.startsOn) || a.type.localeCompare(b.type))
      };
    })
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn));
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
