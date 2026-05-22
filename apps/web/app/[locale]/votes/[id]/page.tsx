import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, voteChoiceLabels } from "@cumsevoteaza/parliament-model";
import { getVotePageData } from "@/lib/data";
import { getHotCount } from "@/lib/explorer-data";
import { isLocale, messagesFor, type AppLocale } from "@/lib/i18n";
import { EngagementTracker } from "../../_components/EngagementTracker";
import { GovernmentContextPanel } from "../../_components/GovernmentContextPanel";
import { HotButton } from "../../_components/HotButton";
import { SourceBadge } from "../../_components/SourceBadge";
import { Stat } from "../../_components/Stat";
import { VoteExplorer } from "../../_components/VoteExplorer";

export default async function VotePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: rawLocale, id } = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : "ro";
  const messages = messagesFor(locale);
  const labels = votePageLabels[locale];
  const data = await getVotePageData(id);
  if (!data) notFound();
  const { vote, bill, source, governmentContext, groupContexts, groups, members, groupTotals, individualVotes, seatVotes } = data;
  const hotCount = await getHotCount("vote", vote.id);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <EngagementTracker entityType="vote" entityId={vote.id} locale={locale} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase text-blue-800">{formatDate(vote.heldOn, locale)}</div>
          <h1 className="mt-2 max-w-4xl text-3xl font-semibold text-slate-950">{vote.title}</h1>
          {bill ? (
            <Link href={`/${locale}/bills/${bill.slug}`} className="mt-2 block text-sm text-slate-600 underline">
              {[bill.identifiers.senate, bill.identifiers.deputies].filter(Boolean).join(" / ")} · {bill.title}
            </Link>
          ) : null}
        </div>
        <div className="flex flex-col items-start gap-2">
          <HotButton entityType="vote" entityId={vote.id} initialCount={hotCount} label={labels.publicInterest} />
          {source ? <SourceBadge source={source} label={messages.common.source} /> : null}
        </div>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-y-4 border border-slate-300 bg-white py-4 md:grid-cols-5">
        <Stat label="Prezenți" value={vote.totals.present} />
        <Stat label={voteChoiceLabels[locale].for} value={vote.totals.for} />
        <Stat label={voteChoiceLabels[locale].against} value={vote.totals.against} />
        <Stat label={voteChoiceLabels[locale].abstention} value={vote.totals.abstention} />
        <Stat label={voteChoiceLabels[locale].present_not_voting} value={vote.totals.presentNotVoting} />
      </section>

      <GovernmentContextPanel context={governmentContext} voteGroups={groupContexts} locale={locale} />

      <div className="mt-6">
        <VoteExplorer
          locale={locale}
          chamber={vote.chamber}
          groups={groups}
          members={members}
          seatVotes={seatVotes}
          nominalVotes={individualVotes}
          groupTotals={groupTotals}
        />
      </div>
    </main>
  );
}

const votePageLabels = {
  ro: {
    publicInterest: "Marchează interes"
  },
  en: {
    publicInterest: "Mark interest"
  }
} satisfies Record<AppLocale, Record<string, string>>;
