import type { Locale, MemberHistoryRow } from "@cumsevoteaza/parliament-model";
import { chamberLabels, formatDate } from "@cumsevoteaza/parliament-model";

export function MemberHistoryTable({
  rows,
  locale,
  labels
}: {
  rows: MemberHistoryRow[];
  locale: Locale;
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
  return (
    <div className="overflow-x-auto border border-slate-300 bg-white">
      <table className="min-w-[880px] w-full border-collapse text-sm">
        <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
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
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-3 py-3 font-medium">
                {formatDate(row.startsOn, locale)}
                {" - "}
                {row.endsOn ? formatDate(row.endsOn, locale) : locale === "ro" ? "prezent" : "present"}
              </td>
              <td className="px-3 py-3">{chamberLabels[locale][row.chamber]}</td>
              <td className="px-3 py-3 capitalize">{row.type}</td>
              <td className="px-3 py-3">
                <div className="font-medium text-slate-950">{row.label}</div>
                <div className="text-slate-600">{row.details}</div>
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
  );
}
