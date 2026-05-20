"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { chamberLabels, type CompositionEvent, type Locale } from "@cumsevoteaza/parliament-model";
import type { ChamberComposition, CompositionMode, CompositionTimelineStop } from "@/lib/composition-data";
import { CompositionSeatMap } from "./CompositionSeatMap";

interface CompositionTimelineProps {
  locale: Locale;
  mode: CompositionMode;
  stops: CompositionTimelineStop[];
}

export function CompositionTimeline({ locale, mode, stops }: CompositionTimelineProps) {
  const labels = timelineLabels[locale];
  const [activeId, setActiveId] = useState(stops[0]?.id ?? "");
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const activeStop = useMemo(() => stops.find((stop) => stop.id === activeId) ?? stops[0], [activeId, stops]);

  useEffect(() => {
    let frame = 0;
    const updateActiveStop = () => {
      frame = 0;
      const markerY = window.innerHeight * 0.38;
      const entries = [...itemRefs.current.entries()]
        .map(([id, node]) => ({ id, rect: node.getBoundingClientRect() }))
        .filter(({ rect }) => rect.height > 0);
      const containingMarker = entries.find(({ rect }) => rect.top <= markerY && rect.bottom >= markerY);
      const closest = containingMarker ?? entries.sort((a, b) => Math.abs(a.rect.top - markerY) - Math.abs(b.rect.top - markerY))[0];
      if (closest) setActiveId(closest.id);
    };
    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateActiveStop);
    };
    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [stops]);

  if (stops.length === 0) {
    return (
      <section className="border border-slate-300 bg-white p-6 text-sm text-slate-600">
        {labels.emptyTimeline}
      </section>
    );
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(260px,360px)_minmax(280px,0.8fr)_minmax(360px,1.2fr)]">
      <div className="grid gap-4 lg:hidden">
        {stops.map((stop) => (
          <MobileStop key={stop.id} locale={locale} mode={mode} stop={stop} />
        ))}
      </div>

      <ol className="hidden gap-4 lg:grid">
        {stops.map((stop) => (
          <li
            key={stop.id}
            data-stop-id={stop.id}
            ref={(node) => {
              if (node) itemRefs.current.set(stop.id, node);
              else itemRefs.current.delete(stop.id);
            }}
            className="min-h-[52vh]"
          >
            <TimelineCard locale={locale} stop={stop} active={stop.id === activeStop?.id} compact={false} />
          </li>
        ))}
      </ol>

      <div className="hidden min-w-0 lg:block">
        <div className="sticky top-4">
          {activeStop ? <GovernmentStage locale={locale} mode={mode} stop={activeStop} /> : null}
        </div>
      </div>

      <div className="hidden min-w-0 lg:block">
        <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain pr-2">
          {activeStop ? <ChamberStage locale={locale} stop={activeStop} /> : null}
        </div>
      </div>
    </section>
  );
}

function GovernmentStage({ locale, mode, stop }: { locale: Locale; mode: CompositionMode; stop: CompositionTimelineStop }) {
  const labels = timelineLabels[locale];
  const pmSummary = primeMinisterSummary(stop);
  return (
    <div className="grid gap-4">
      <section className="border border-slate-300 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">{labels.stage}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">{stop.legislature.label}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {pmSummary || stop.activeGovernment?.name || labels.noGovernment}
            </p>
          </div>
          <SourceBadge locale={locale} status={stop.sourceStatus} />
        </div>
        <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <Metric label={labels.period} value={periodLabel(stop.legislature.startsOn, stop.legislature.endsOn, labels.present)} />
          <Metric label={labels.compositionDate} value={stop.compositionDate} />
          <Metric label={labels.pm} value={pmSummary || stop.primeMinister?.displayName || labels.unknown} />
          <Metric label={labels.mode} value={mode === "computed" ? labels.computedMode : labels.officialMode} />
          <Metric label={labels.role} value={stop.primeMinisterRole?.title ?? labels.unknown} />
        </div>
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-950">{labels.governments}</h3>
          <div className="mt-2 grid gap-2">
            {stop.governments.length === 0 ? <p className="text-sm text-slate-600">{labels.noGovernment}</p> : null}
            {stop.governments.map((government) => (
              <div key={government.id} className="border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <div className="font-medium text-slate-950">{government.name}</div>
                <div className="mt-1 text-slate-600">{periodLabel(government.startsOn, government.endsOn, labels.present)}</div>
              </div>
            ))}
          </div>
        </div>
        {mode === "computed" ? <p className="mt-4 border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{labels.computedEmpty}</p> : null}
      </section>
    </div>
  );
}

function ChamberStage({ locale, stop }: { locale: Locale; stop: CompositionTimelineStop }) {
  const labels = timelineLabels[locale];
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {stop.chambers.length > 0 ? (
        <>
          {stop.chambers.map((chamber) => (
            <CompositionSeatMap key={chamber.chamber} locale={locale} chamber={chamber.chamber} seats={chamber.seats} />
          ))}
        </>
      ) : (
        <section className="border border-slate-300 bg-white p-5 text-sm text-slate-600 xl:col-span-2">
          <h3 className="font-semibold text-slate-950">{labels.noCompositionTitle}</h3>
          <p className="mt-2">{labels.noCompositionBody}</p>
        </section>
      )}
    </div>
  );
}

function MobileStop({ locale, mode, stop }: { locale: Locale; mode: CompositionMode; stop: CompositionTimelineStop }) {
  const labels = timelineLabels[locale];
  return (
    <article className="border border-slate-300 bg-white p-4">
      <TimelineCard locale={locale} stop={stop} active compact />
      {mode === "computed" ? <p className="mt-3 border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{labels.computedEmpty}</p> : null}
      {stop.chambers.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {stop.chambers.map((chamber) => (
            <MobileChamberSummary key={chamber.chamber} locale={locale} chamber={chamber} />
          ))}
        </div>
      ) : (
        <p className="mt-4 border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{labels.noCompositionBody}</p>
      )}
    </article>
  );
}

function MobileChamberSummary({ locale, chamber }: { locale: Locale; chamber: ChamberComposition }) {
  const labels = timelineLabels[locale];
  return (
    <div className="border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
      <div className="font-medium text-slate-950">{chamberLabels[locale][chamber.chamber]}</div>
      <div className="mt-1">
        {chamber.seats.length} {labels.seats} · {chamber.groups.length} {labels.groups}
      </div>
    </div>
  );
}

function TimelineCard({ locale, stop, active, compact }: { locale: Locale; stop: CompositionTimelineStop; active: boolean; compact: boolean }) {
  const labels = timelineLabels[locale];
  return (
    <article className={["border bg-white p-4 transition", active ? "border-slate-950 shadow-sm" : "border-slate-300", compact ? "" : "sticky top-6"].join(" ")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">{labels.legislature}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-normal text-slate-950">{stop.legislature.label}</h3>
        </div>
        <SourceBadge locale={locale} status={stop.sourceStatus} />
      </div>
      <p className="mt-2 text-sm text-slate-700">
        {labels.pm}: {primeMinisterSummary(stop) || stop.primeMinister?.displayName || labels.unknown}
      </p>
      <p className="mt-1 text-sm text-slate-600">{periodLabel(stop.legislature.startsOn, stop.legislature.endsOn, labels.present)}</p>
      <div className="mt-3 grid gap-2">
        {stop.events.length === 0 ? <p className="text-sm text-slate-600">{labels.noEvents}</p> : null}
        {stop.events.map((event) => (
          <div key={event.id} className="border-l-2 border-slate-300 pl-3">
            <div className="text-xs font-semibold uppercase text-slate-500">{event.occurredOn} · {eventTypeLabel(locale, event.eventType)}</div>
            <div className="mt-1 text-sm font-medium text-slate-950">{event.title}</div>
            {event.description ? <p className="mt-1 text-sm leading-6 text-slate-700">{event.description}</p> : null}
          </div>
        ))}
      </div>
      {stop.activeGovernment ? (
        <Link className="mt-4 inline-flex text-sm font-medium underline" href={`/${locale}/compozitii#${stop.activeGovernment.slug}`}>
          {labels.futureDetails}
        </Link>
      ) : null}
    </article>
  );
}

function SourceBadge({ locale, status }: { locale: Locale; status: CompositionTimelineStop["sourceStatus"] }) {
  const labels = timelineLabels[locale];
  return (
    <span className={["shrink-0 border px-2 py-1 text-xs", status === "verified" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900"].join(" ")}>
      {status === "verified" ? labels.verified : labels.manual}
    </span>
  );
}

function primeMinisterSummary(stop: CompositionTimelineStop): string {
  if (stop.activeGovernment && !stop.activeGovernment.endsOn && stop.primeMinister?.displayName) {
    return stop.primeMinister.displayName;
  }
  const names = stop.primeMinisters.map((item) => item.person.displayName);
  if (names.length === 0) return "";
  return names.slice(0, 4).join(", ");
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-slate-950">{value}</div>
    </div>
  );
}

function periodLabel(startsOn: string, endsOn: string | undefined, present: string): string {
  return `${startsOn} - ${endsOn ?? present}`;
}

function eventTypeLabel(locale: Locale, eventType: CompositionEvent["eventType"]): string {
  return timelineLabels[locale].events[eventType] ?? eventType;
}

type TimelineLabels = {
  stage: string;
  legislature: string;
  pm: string;
  period: string;
  compositionDate: string;
  event: string;
  mode: string;
  role: string;
  present: string;
  unknown: string;
  officialMode: string;
  computedMode: string;
  verified: string;
  manual: string;
  futureDetails: string;
  governments: string;
  noGovernment: string;
  noEvents: string;
  noCompositionTitle: string;
  noCompositionBody: string;
  computedEmpty: string;
  emptyTimeline: string;
  seats: string;
  groups: string;
  events: Record<CompositionEvent["eventType"], string>;
};

const timelineLabels = {
  ro: {
    stage: "Perioada activă",
    legislature: "Legislatură",
    pm: "Prim-ministru",
    period: "Perioadă",
    compositionDate: "Compoziție la data",
    event: "Eveniment",
    mode: "Mod",
    role: "Rol",
    present: "prezent",
    unknown: "necunoscut",
    officialMode: "Investitură oficială",
    computedMode: "Susținere la vot",
    verified: "verificat oficial",
    manual: "skeleton manual",
    futureDetails: "Detalii guvern",
    governments: "Guverne în legislatură",
    noGovernment: "Guvern neimportat",
    noEvents: "Nu există încă evenimente importate pentru această legislatură.",
    noCompositionTitle: "Compoziție parlamentară neimportată",
    noCompositionBody: "Pentru această perioadă avem skeleton-ul guvernamental, dar nu avem încă rosters parlamentare importate.",
    computedEmpty: "Modul de susținere la vot va deveni disponibil după ce importăm suficiente voturi nominale pentru această perioadă.",
    emptyTimeline: "Nu există încă evenimente de compoziție importate.",
    seats: "mandate",
    groups: "grupuri",
    events: {
      legislature_start: "Început legislatură",
      legislature_end: "Sfârșit legislatură",
      government_designated: "Desemnare/interimat",
      government_invested: "Investitură guvern",
      government_ended: "Sfârșit guvern",
      minister_appointed: "Numire ministru",
      minister_ended: "Sfârșit mandat ministru",
      reshuffle: "Remaniere",
      no_confidence_motion: "Moțiune de cenzură",
      confidence_vote: "Vot de încredere",
      coalition_change: "Schimbare coaliție",
      group_change: "Schimbare grup",
      member_mandate_start: "Început mandat",
      member_mandate_end: "Sfârșit mandat",
      committee_change: "Schimbare comisie",
      role_change: "Schimbare rol",
      other: "Alt eveniment"
    }
  },
  en: {
    stage: "Active period",
    legislature: "Legislature",
    pm: "Prime minister",
    period: "Period",
    compositionDate: "Composition date",
    event: "Event",
    mode: "Mode",
    role: "Role",
    present: "present",
    unknown: "unknown",
    officialMode: "Official investiture",
    computedMode: "Voting support",
    verified: "officially verified",
    manual: "manual skeleton",
    futureDetails: "Government details",
    governments: "Governments in legislature",
    noGovernment: "Government not imported",
    noEvents: "No events are imported for this legislature yet.",
    noCompositionTitle: "Parliament composition not imported",
    noCompositionBody: "This period has a government skeleton, but parliamentary rosters are not imported yet.",
    computedEmpty: "Voting-support mode will become available after enough nominal votes are imported for this period.",
    emptyTimeline: "No composition events are imported yet.",
    seats: "seats",
    groups: "groups",
    events: {
      legislature_start: "Legislature start",
      legislature_end: "Legislature end",
      government_designated: "Designation/interim",
      government_invested: "Government investiture",
      government_ended: "Government ended",
      minister_appointed: "Minister appointed",
      minister_ended: "Minister ended",
      reshuffle: "Reshuffle",
      no_confidence_motion: "No-confidence motion",
      confidence_vote: "Confidence vote",
      coalition_change: "Coalition change",
      group_change: "Group change",
      member_mandate_start: "Mandate start",
      member_mandate_end: "Mandate end",
      committee_change: "Committee change",
      role_change: "Role change",
      other: "Other event"
    }
  }
} satisfies Record<Locale, TimelineLabels>;
