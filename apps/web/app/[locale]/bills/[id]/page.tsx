import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@cumsevoteaza/parliament-model";
import { getBillPageData } from "@/lib/data";
import { getHotCount } from "@/lib/explorer-data";
import { isLocale, messagesFor, type AppLocale } from "@/lib/i18n";
import { EngagementTracker } from "../../_components/EngagementTracker";
import { GovernmentContextPanel } from "../../_components/GovernmentContextPanel";
import { HotButton } from "../../_components/HotButton";
import { SourceBadge } from "../../_components/SourceBadge";

export default async function BillPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: rawLocale, id } = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : "ro";
  const messages = messagesFor(locale);
  const labels = billPageLabels[locale];
  const data = await getBillPageData(id);
  if (!data) notFound();
  const { bill, events, documents, votes, source, governmentContext, sponsorContexts } = data;
  const hotCount = await getHotCount("bill", bill.id);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <EngagementTracker entityType="bill" entityId={bill.id} locale={locale} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase text-blue-800">{bill.identifiers.senate}</div>
          <h1 className="mt-2 max-w-5xl text-3xl font-semibold text-slate-950">{bill.title}</h1>
          <p className="mt-3 text-slate-600">{bill.status}</p>
        </div>
        <div className="flex flex-col items-start gap-2">
          <HotButton entityType="bill" entityId={bill.id} initialCount={hotCount} label={labels.publicInterest} />
          {source ? <SourceBadge source={source} label={messages.common.source} /> : null}
        </div>
      </div>

      <GovernmentContextPanel context={governmentContext} billSponsors={sponsorContexts} locale={locale} />

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="border border-slate-300 bg-white">
          <div className="border-b border-slate-300 px-4 py-3 font-semibold">Timeline</div>
          <div className="divide-y divide-slate-200">
            {events.map((event) => (
              <div key={event.id} className="grid gap-2 px-4 py-4 md:grid-cols-[140px_1fr]">
                <div className="text-sm font-medium text-slate-700">{formatDate(event.occurredOn, locale)}</div>
                <div>
                  <div className="font-medium text-slate-950">{event.label}</div>
                  <div className="text-sm text-slate-600">{event.chamber}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="border border-slate-300 bg-white">
            <div className="border-b border-slate-300 px-4 py-3 font-semibold">{messages.nav.votes}</div>
            <div className="divide-y divide-slate-200">
              {votes.map((vote) => (
                <Link key={vote.id} className="block px-4 py-3 hover:bg-slate-50" href={`/${locale}/votes/${vote.id}`}>
                  <div className="font-medium">{vote.title}</div>
                  <div className="text-sm text-slate-600">{formatDate(vote.heldOn, locale)}</div>
                </Link>
              ))}
            </div>
          </div>

          <div className="border border-slate-300 bg-white">
            <div className="border-b border-slate-300 px-4 py-3 font-semibold">Documente</div>
            <div className="divide-y divide-slate-200">
              {documents.map((document) => (
                <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="block px-4 py-3 text-sm underline">
                  {document.label}
                </a>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

const billPageLabels = {
  ro: {
    publicInterest: "Marchează interes"
  },
  en: {
    publicInterest: "Mark interest"
  }
} satisfies Record<AppLocale, Record<string, string>>;
