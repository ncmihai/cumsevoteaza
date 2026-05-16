import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { formatDate, voteChoiceLabels } from "@cumsevoteaza/parliament-model";
import { getVoteDirectoryData } from "@/lib/data";
import { isLocale, messagesFor, type AppLocale } from "@/lib/i18n";

export default async function VotesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : "ro";
  const messages = messagesFor(locale);
  const data = await getVoteDirectoryData(30);
  const labels = pageLabels[locale];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase text-blue-800">{messages.nav.votes}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">{labels.title}</h1>
          <p className="mt-2 max-w-3xl text-slate-600">{labels.subtitle}</p>
        </div>
        <span className="rounded bg-slate-200 px-2 py-1 text-xs uppercase text-slate-700">{data.sourceKind}</span>
      </div>

      <section className="mt-6 border border-slate-300 bg-white">
        <div className="divide-y divide-slate-200">
          {data.items.map(({ vote, bill }) => (
            <Link key={vote.id} href={`/${locale}/votes/${vote.id}`} className="grid gap-4 px-4 py-4 hover:bg-slate-50 md:grid-cols-[1fr_420px]">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase text-blue-800">
                  <BarChart3 size={16} aria-hidden="true" />
                  {formatDate(vote.heldOn, locale)} · {vote.chamber}
                </div>
                <h2 className="mt-2 text-lg font-semibold text-slate-950">{vote.title}</h2>
                {bill ? <p className="mt-1 line-clamp-2 text-sm text-slate-600">{bill.title}</p> : null}
              </div>
              <div className="grid grid-cols-4 gap-2 text-sm md:text-right">
                <StatLine label={voteChoiceLabels[locale].for} value={vote.totals.for} tone="text-emerald-700" />
                <StatLine label={voteChoiceLabels[locale].against} value={vote.totals.against} tone="text-red-700" />
                <StatLine label={voteChoiceLabels[locale].abstention} value={vote.totals.abstention} tone="text-amber-700" />
                <StatLine label={labels.present} value={vote.totals.present} tone="text-slate-700" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function StatLine({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

const pageLabels = {
  ro: {
    title: "Ultimele 30 de proiecte votate",
    subtitle: "Voturi finale și nominale importate din surse oficiale, ordonate de la cel mai recent.",
    present: "Prezenți"
  },
  en: {
    title: "Latest 30 voted projects",
    subtitle: "Final and nominal votes imported from official sources, ordered by most recent date.",
    present: "Present"
  }
} satisfies Record<AppLocale, Record<string, string>>;
