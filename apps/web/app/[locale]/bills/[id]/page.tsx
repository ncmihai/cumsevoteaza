import Link from "next/link";
import { notFound } from "next/navigation";
import { demoDataset, formatDate } from "@cumsevoteaza/parliament-model";
import { isLocale, messagesFor, type AppLocale } from "@/lib/i18n";
import { SourceBadge } from "../../_components/SourceBadge";

export default async function BillPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: rawLocale, id } = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : "ro";
  const messages = messagesFor(locale);
  const bill = demoDataset.bills.find((item) => item.slug === id || item.id === id);
  if (!bill) notFound();

  const events = demoDataset.billEvents.filter((event) => event.billId === bill.id);
  const documents = demoDataset.documents.filter((document) => document.billId === bill.id);
  const votes = demoDataset.votes.filter((vote) => vote.billId === bill.id);
  const source = demoDataset.sourceSnapshots.find((item) => bill.sourceSnapshotIds.includes(item.id));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase text-blue-800">{bill.identifiers.senate}</div>
          <h1 className="mt-2 max-w-5xl text-3xl font-semibold text-slate-950">{bill.title}</h1>
          <p className="mt-3 text-slate-600">{bill.status}</p>
        </div>
        {source ? <SourceBadge source={source} label={messages.common.source} /> : null}
      </div>

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
