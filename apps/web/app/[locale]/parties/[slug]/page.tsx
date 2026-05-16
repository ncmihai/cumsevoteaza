import Link from "next/link";
import { notFound } from "next/navigation";
import { getPartyPageData } from "@/lib/data";
import { isLocale, messagesFor, type AppLocale } from "@/lib/i18n";
import { EngagementTracker } from "../../_components/EngagementTracker";

export default async function PartyPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: rawLocale, slug } = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : "ro";
  const messages = messagesFor(locale);
  const data = await getPartyPageData(slug);
  if (!data) notFound();
  const { party, members, groupTotals, votes, sourceKind } = data;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <EngagementTracker entityType="party" entityId={party.id} locale={locale} />
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: party.color }} />
        <div className="text-sm font-semibold uppercase text-blue-800">{party.shortName}</div>
      </div>
      <h1 className="mt-2 text-4xl font-semibold text-slate-950">{party.name}</h1>
      <span className="mt-3 inline-block rounded bg-slate-200 px-2 py-1 text-xs uppercase text-slate-700">{sourceKind}</span>

      <section className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="border border-slate-300 bg-white">
          <div className="border-b border-slate-300 px-4 py-3 font-semibold">{messages.nav.members}</div>
          <div className="divide-y divide-slate-200">
            {members.map((member) => (
              <Link key={member.id} href={`/${locale}/members/${member.slug}`} className="block px-4 py-3 hover:bg-slate-50">
                {member.displayName}
              </Link>
            ))}
          </div>
        </div>

        <div className="border border-slate-300 bg-white">
          <div className="border-b border-slate-300 px-4 py-3 font-semibold">{messages.nav.votes}</div>
          <div className="divide-y divide-slate-200">
            {groupTotals.map((total) => {
              const vote = votes.find((item) => item.id === total.voteId);
              return (
                <Link key={total.id} href={`/${locale}/votes/${total.voteId}`} className="block px-4 py-3 hover:bg-slate-50">
                  <div className="font-medium">{vote?.title ?? total.voteId}</div>
                  <div className="text-sm text-slate-600">
                    Pentru {total.for} · Contra {total.against} · Abțineri {total.abstention}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
