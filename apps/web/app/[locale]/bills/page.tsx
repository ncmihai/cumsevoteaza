import Link from "next/link";
import { FileText } from "lucide-react";
import { formatDate } from "@cumsevoteaza/parliament-model";
import { getBillDirectoryData } from "@/lib/data";
import { isLocale, messagesFor, type AppLocale } from "@/lib/i18n";

export default async function BillsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : "ro";
  const messages = messagesFor(locale);
  const data = await getBillDirectoryData(30);
  const labels = pageLabels[locale];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase text-blue-800">{messages.nav.bills}</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">{labels.title}</h1>
          <p className="mt-2 max-w-3xl text-slate-600">{labels.subtitle}</p>
        </div>
        <span className="rounded bg-slate-200 px-2 py-1 text-xs uppercase text-slate-700">{data.sourceKind}</span>
      </div>

      <section className="mt-6 border border-slate-300 bg-white">
        <div className="divide-y divide-slate-200">
          {data.items.map(({ bill, submittedOn, latestEventOn, voteCount }) => (
            <Link key={bill.id} href={`/${locale}/bills/${bill.slug}`} className="grid gap-4 px-4 py-4 hover:bg-slate-50 md:grid-cols-[1fr_280px]">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase text-blue-800">
                  <FileText size={16} aria-hidden="true" />
                  {bill.identifiers.senate ?? bill.identifiers.deputies ?? bill.id}
                </div>
                <h2 className="mt-2 line-clamp-2 text-lg font-semibold text-slate-950">{bill.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{bill.status}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm md:text-right">
                <div>
                  <dt className="text-xs uppercase text-slate-500">{labels.submitted}</dt>
                  <dd className="mt-1 font-semibold text-slate-950">{submittedOn ? formatDate(submittedOn, locale) : "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">{labels.latestEvent}</dt>
                  <dd className="mt-1 font-semibold text-slate-950">{latestEventOn ? formatDate(latestEventOn, locale) : "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">{messages.nav.votes}</dt>
                  <dd className="mt-1 font-semibold text-slate-950">{voteCount}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">{labels.origin}</dt>
                  <dd className="mt-1 font-semibold text-slate-950">{bill.chamberOfOrigin}</dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

const pageLabels = {
  ro: {
    title: "Ultimele 30 de proiecte depuse",
    subtitle: "Proiecte legislative importate din surse oficiale, ordonate după prima dată cunoscută din traseul parlamentar.",
    submitted: "Depus",
    latestEvent: "Ultim eveniment",
    origin: "Origine"
  },
  en: {
    title: "Latest 30 submitted projects",
    subtitle: "Legislative projects imported from official sources, ordered by the first known date in the parliamentary timeline.",
    submitted: "Submitted",
    latestEvent: "Latest event",
    origin: "Origin"
  }
} satisfies Record<AppLocale, Record<string, string>>;
