import Link from "next/link";
import { notFound } from "next/navigation";
import { demoDataset, formatDate, voteChoiceLabels } from "@cumsevoteaza/parliament-model";
import { isLocale, messagesFor, type AppLocale } from "@/lib/i18n";
import { SourceBadge } from "../../_components/SourceBadge";
import { Stat } from "../../_components/Stat";
import { VoteExplorer } from "../../_components/VoteExplorer";

export default async function VotePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: rawLocale, id } = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : "ro";
  const messages = messagesFor(locale);
  const vote = demoDataset.votes.find((item) => item.id === id);
  if (!vote) notFound();

  const bill = demoDataset.bills.find((item) => item.id === vote.billId);
  const source = demoDataset.sourceSnapshots.find((item) => item.id === vote.sourceSnapshotId);
  const groupTotals = demoDataset.groupVoteTotals.filter((item) => item.voteId === vote.id);
  const individualVotes = demoDataset.individualVotes.filter((item) => item.voteId === vote.id);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase text-blue-800">{formatDate(vote.heldOn, locale)}</div>
          <h1 className="mt-2 max-w-4xl text-3xl font-semibold text-slate-950">{vote.title}</h1>
          {bill ? (
            <Link href={`/${locale}/bills/${bill.slug}`} className="mt-2 block text-sm text-slate-600 underline">
              {bill.identifiers.senate} · {bill.title}
            </Link>
          ) : null}
        </div>
        {source ? <SourceBadge source={source} label={messages.common.source} /> : null}
      </div>

      <section className="mt-6 grid grid-cols-2 gap-y-4 border border-slate-300 bg-white py-4 md:grid-cols-5">
        <Stat label="Prezenți" value={vote.totals.present} />
        <Stat label={voteChoiceLabels[locale].for} value={vote.totals.for} />
        <Stat label={voteChoiceLabels[locale].against} value={vote.totals.against} />
        <Stat label={voteChoiceLabels[locale].abstention} value={vote.totals.abstention} />
        <Stat label={voteChoiceLabels[locale].present_not_voting} value={vote.totals.presentNotVoting} />
      </section>

      <div className="mt-6">
        <VoteExplorer
          locale={locale}
          groups={demoDataset.groups}
          members={demoDataset.members}
          individualVotes={individualVotes}
          groupTotals={groupTotals}
        />
      </div>

      <section className="mt-6 overflow-x-auto border border-slate-300 bg-white">
        <table className="min-w-[760px] w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Nume</th>
              <th className="px-3 py-2">Grup</th>
              <th className="px-3 py-2">Vot</th>
              <th className="px-3 py-2">Metodă</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {individualVotes.map((individualVote) => {
              const member = demoDataset.members.find((item) => item.id === individualVote.memberId);
              const group = demoDataset.groups.find((item) => item.id === individualVote.groupId);
              return (
                <tr key={individualVote.id}>
                  <td className="px-3 py-3">
                    {member ? (
                      <Link className="font-medium underline" href={`/${locale}/members/${member.slug}`}>
                        {member.displayName}
                      </Link>
                    ) : (
                      individualVote.memberId
                    )}
                  </td>
                  <td className="px-3 py-3">{group?.shortName ?? "-"}</td>
                  <td className="px-3 py-3">{voteChoiceLabels[locale][individualVote.choice]}</td>
                  <td className="px-3 py-3 text-slate-600">{individualVote.voteMethod ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
