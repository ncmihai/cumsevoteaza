import Link from "next/link";
import { notFound } from "next/navigation";
import { demoDataset } from "@cumsevoteaza/parliament-model";
import { isLocale, messagesFor, type AppLocale } from "@/lib/i18n";

export default async function PartyPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: rawLocale, slug } = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : "ro";
  const messages = messagesFor(locale);
  const party = demoDataset.parties.find((item) => item.slug === slug);
  if (!party) notFound();

  const groups = demoDataset.groups.filter((group) => group.partyId === party.id);
  const groupIds = new Set(groups.map((group) => group.id));
  const members = demoDataset.members.filter((member) =>
    demoDataset.groupMemberships.some((membership) => membership.memberId === member.id && groupIds.has(membership.groupId))
  );
  const groupTotals = demoDataset.groupVoteTotals.filter((total) => groupIds.has(total.groupId));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: party.color }} />
        <div className="text-sm font-semibold uppercase text-blue-800">{party.shortName}</div>
      </div>
      <h1 className="mt-2 text-4xl font-semibold text-slate-950">{party.name}</h1>

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
              const vote = demoDataset.votes.find((item) => item.id === total.voteId);
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
