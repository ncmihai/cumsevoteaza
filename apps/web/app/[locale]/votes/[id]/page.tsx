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
  const {
    vote,
    bill,
    billProcedureSteps,
    billDocuments,
    billSponsorContexts,
    source,
    governmentContext,
    groupContexts,
    groups,
    members,
    groupTotals,
    individualVotes,
    seatVotes
  } = data;
  const hotCount = await getHotCount("vote", vote.id);
  const billIdentifiers = bill ? [bill.identifiers.senate, bill.identifiers.deputies].filter(Boolean).join(" / ") : "";
  const previewSteps = billProcedureSteps
    .filter((step) => step.occurredOn <= vote.heldOn)
    .slice(-3)
    .reverse();
  const sponsorNames = uniqueDisplayNames(
    billSponsorContexts.map((item) => item.member?.displayName ?? item.sponsor.name ?? "").filter(Boolean)
  ).slice(0, 4);
  const documentKinds = uniqueDisplayNames(
    billDocuments.flatMap((document) => document.documentKind ? [document.documentKind] : [])
  ).slice(0, 4);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <EngagementTracker entityType="vote" entityId={vote.id} locale={locale} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase text-blue-800">{formatDate(vote.heldOn, locale)}</div>
          <h1 className="mt-2 max-w-4xl text-3xl font-semibold text-slate-950">{vote.title}</h1>
          {bill ? (
            <div className="mt-3 max-w-4xl border border-slate-300 bg-white p-4 text-sm">
              <div className="text-xs font-semibold uppercase text-teal-700">{labels.billDossier}</div>
              <Link href={`/${locale}/bills/${bill.slug}`} className="font-medium text-slate-900 underline">
                {billIdentifiers ? `${billIdentifiers} · ` : null}{bill.title}
              </Link>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                {bill.status ? <span>{bill.status}</span> : null}
                {bill.decisionChamber ? <span>{labels.decisionChamber}: {labels.chambers[bill.decisionChamber]}</span> : null}
                {billDocuments.length > 0 ? <span>{labels.documents}: {billDocuments.length}</span> : null}
                {documentKinds.length > 0 ? (
                  <span>{documentKinds.map((kind) => (labels.documentKinds as Record<string, string>)[kind] ?? kind).join(", ")}</span>
                ) : null}
              </div>
              {sponsorNames.length > 0 ? (
                <div className="mt-3 text-xs text-slate-700">
                  <span className="font-semibold uppercase text-slate-500">{labels.initiators}</span>{" "}
                  {sponsorNames.join(", ")}
                  {billSponsorContexts.length > sponsorNames.length ? ` +${billSponsorContexts.length - sponsorNames.length}` : null}
                </div>
              ) : null}
              {previewSteps.length > 0 ? (
                <ol className="mt-3 grid gap-2 border-t border-slate-200 pt-3 text-xs text-slate-700">
                  {previewSteps.map((step) => (
                    <li key={step.id} className="grid gap-1 md:grid-cols-[7rem_1fr]">
                      <span className="font-semibold text-slate-500">{formatDate(step.occurredOn, locale)}</span>
                      <span>
                        <span className="font-medium text-slate-900">{step.title}</span>
                        {step.committeeName ? <span className="text-slate-500"> · {step.committeeName}</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
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
    publicInterest: "Marchează interes",
    billDossier: "Dosar proiect",
    decisionChamber: "Cameră decizională",
    documents: "Documente",
    initiators: "Inițiatori",
    chambers: {
      deputies: "Camera Deputaților",
      senate: "Senat"
    },
    documentKinds: {
      proposal: "propunere",
      senate_adopted_form: "formă adoptată Senat",
      committee_report: "raport comisie",
      committee_opinion: "aviz comisie",
      adopted_form: "formă adoptată",
      promulgation_form: "formă promulgare",
      other: "alte documente"
    }
  },
  en: {
    publicInterest: "Mark interest",
    billDossier: "Bill dossier",
    decisionChamber: "Decision chamber",
    documents: "Documents",
    initiators: "Initiators",
    chambers: {
      deputies: "Chamber of Deputies",
      senate: "Senate"
    },
    documentKinds: {
      proposal: "proposal",
      senate_adopted_form: "Senate adopted form",
      committee_report: "committee report",
      committee_opinion: "committee opinion",
      adopted_form: "adopted form",
      promulgation_form: "promulgation form",
      other: "other documents"
    }
  }
} satisfies Record<AppLocale, {
  publicInterest: string;
  billDossier: string;
  decisionChamber: string;
  documents: string;
  initiators: string;
  chambers: Record<"deputies" | "senate", string>;
  documentKinds: Record<string, string>;
}>;

function uniqueDisplayNames(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value);
  }
  return result;
}
