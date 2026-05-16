import Link from "next/link";
import { BarChart3, FileText, Search, UserRound } from "lucide-react";
import { demoDataset, formatDate, voteChoiceLabels } from "@cumsevoteaza/parliament-model";
import { isLocale, messagesFor, type AppLocale } from "@/lib/i18n";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : "ro";
  const messages = messagesFor(locale);
  const vote = demoDataset.votes[0];
  const bill = demoDataset.bills[0];
  const member = demoDataset.members.find((item) => item.slug === "andra-bica") ?? demoDataset.members[0];
  const source = demoDataset.sourceSnapshots.find((item) => item.id === vote?.sourceSnapshotId);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="text-sm font-semibold uppercase text-blue-800">{messages.home.eyebrow}</div>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-normal text-slate-950 md:text-5xl">
            {messages.home.title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-7 text-slate-600">{messages.home.subtitle}</p>
          <div className="mt-6 flex max-w-2xl items-center gap-3 border border-slate-300 bg-white px-4 py-3">
            <Search size={20} className="text-slate-500" aria-hidden="true" />
            <input
              className="w-full border-0 bg-transparent text-slate-900 outline-none"
              placeholder={messages.home.searchPlaceholder}
              aria-label={messages.home.searchPlaceholder}
            />
          </div>
        </div>

        <aside className="border border-slate-300 bg-white p-4">
          <div className="text-sm font-semibold text-slate-950">{messages.home.sourceProof}</div>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Parser</dt>
              <dd className="font-medium">{source?.parser}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium">{source?.status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Hash</dt>
              <dd className="break-all font-mono text-xs">{source?.contentHash}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <Link
          href={`/${locale}/votes/${vote?.id}`}
          className="border border-slate-300 bg-white p-5 hover:border-slate-950"
        >
          <BarChart3 className="mb-4 text-blue-800" size={24} aria-hidden="true" />
          <div className="text-sm font-semibold uppercase text-slate-500">{messages.home.latestVote}</div>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">{vote?.title}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {vote ? formatDate(vote.heldOn, locale) : ""} · {voteChoiceLabels[locale].for}: {vote?.totals.for}
          </p>
        </Link>

        <Link
          href={`/${locale}/bills/${bill?.slug}`}
          className="border border-slate-300 bg-white p-5 hover:border-slate-950"
        >
          <FileText className="mb-4 text-blue-800" size={24} aria-hidden="true" />
          <div className="text-sm font-semibold uppercase text-slate-500">{messages.nav.bills}</div>
          <h2 className="mt-2 line-clamp-3 text-xl font-semibold text-slate-950">{bill?.identifiers.senate}</h2>
          <p className="mt-2 text-sm text-slate-600">{bill?.status}</p>
        </Link>

        <Link
          href={`/${locale}/members/${member?.slug}`}
          className="border border-slate-300 bg-white p-5 hover:border-slate-950"
        >
          <UserRound className="mb-4 text-blue-800" size={24} aria-hidden="true" />
          <div className="text-sm font-semibold uppercase text-slate-500">{messages.home.memberHistory}</div>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">{member?.displayName}</h2>
          <p className="mt-2 text-sm text-slate-600">Transfermarkt-style parliamentary career table</p>
        </Link>
      </section>
    </main>
  );
}
