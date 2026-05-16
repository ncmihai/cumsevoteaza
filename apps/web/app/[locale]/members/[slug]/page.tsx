import Link from "next/link";
import { notFound } from "next/navigation";
import { demoDataset } from "@cumsevoteaza/parliament-model";
import { isLocale, messagesFor, type AppLocale } from "@/lib/i18n";
import { MemberHistoryTable } from "../../_components/MemberHistoryTable";
import { SourceBadge } from "../../_components/SourceBadge";

export default async function MemberPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: rawLocale, slug } = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : "ro";
  const messages = messagesFor(locale);
  const member = demoDataset.members.find((item) => item.slug === slug);
  if (!member) notFound();

  const history = demoDataset.memberHistory[member.id] ?? [];
  const groupMembership = demoDataset.groupMemberships.find((item) => item.memberId === member.id && !item.endsOn);
  const group = demoDataset.groups.find((item) => item.id === groupMembership?.groupId);
  const mandate = demoDataset.mandates.find((item) => item.memberId === member.id);
  const source = demoDataset.sourceSnapshots.find((item) => item.id === groupMembership?.sourceSnapshotId);
  const votes = demoDataset.individualVotes.filter((vote) => vote.memberId === member.id);
  const sponsoredBills = demoDataset.billSponsors.filter((sponsor) => sponsor.memberId === member.id);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase text-blue-800">{group?.shortName ?? "unknown"}</div>
          <h1 className="mt-2 text-4xl font-semibold text-slate-950">{member.displayName}</h1>
          <p className="mt-3 text-slate-600">
            {mandate?.chamber ?? "unknown"} · {mandate?.status ?? "unknown"}
          </p>
        </div>
        {source ? <SourceBadge source={source} label={messages.common.source} /> : null}
      </div>

      <section className="mt-6 grid grid-cols-2 gap-y-4 border border-slate-300 bg-white py-4 md:grid-cols-4">
        <div className="border-l border-slate-300 px-4 first:border-l-0">
          <div className="text-xs uppercase text-slate-500">Grup curent</div>
          <div className="mt-1 text-2xl font-semibold text-slate-950">{group?.shortName ?? "-"}</div>
        </div>
        <div className="border-l border-slate-300 px-4">
          <div className="text-xs uppercase text-slate-500">{messages.nav.votes}</div>
          <div className="mt-1 text-2xl font-semibold text-slate-950">{votes.length}</div>
        </div>
        <div className="border-l border-slate-300 px-4">
          <div className="text-xs uppercase text-slate-500">{messages.common.proposals}</div>
          <div className="mt-1 text-2xl font-semibold text-slate-950">{sponsoredBills.length}</div>
        </div>
        <div className="border-l border-slate-300 px-4">
          <div className="text-xs uppercase text-slate-500">Surse</div>
          <div className="mt-1 text-2xl font-semibold text-slate-950">{source ? 1 : 0}</div>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap gap-2">
          {["Votes", "Proposals", "Committees", "Sources"].map((tab) => (
            <button key={tab} type="button" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              {tab}
            </button>
          ))}
        </div>
        <h2 className="mb-3 text-2xl font-semibold text-slate-950">{messages.home.memberHistory}</h2>
        <MemberHistoryTable
          rows={history}
          locale={locale}
          labels={{
            period: messages.common.period,
            chamber: messages.common.chamber,
            type: messages.common.type,
            details: messages.common.details,
            votesFor: messages.common.votesFor,
            votesAgainst: messages.common.votesAgainst,
            abstentions: messages.common.abstentions,
            proposals: messages.common.proposals
          }}
        />
      </section>

      <section className="mt-6 border border-slate-300 bg-white">
        <div className="border-b border-slate-300 px-4 py-3 font-semibold">{messages.nav.votes}</div>
        <div className="divide-y divide-slate-200">
          {votes.map((individualVote) => {
            const vote = demoDataset.votes.find((item) => item.id === individualVote.voteId);
            return vote ? (
              <Link key={individualVote.id} className="block px-4 py-3 hover:bg-slate-50" href={`/${locale}/votes/${vote.id}`}>
                <div className="font-medium">{vote.title}</div>
                <div className="text-sm text-slate-600">{individualVote.choice}</div>
              </Link>
            ) : null;
          })}
        </div>
      </section>
    </main>
  );
}
