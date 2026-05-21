import type { CompositionEvent, Government, GovernmentPartyAlignment, GovernmentRole, Person } from "@cumsevoteaza/parliament-model";
import { partyAlignmentsForGovernment } from "./government-party-alignments";

const sourceUrl = "https://en.wikipedia.org/wiki/List_of_heads_of_government_of_Romania";

interface GovernmentSeed {
  slug: string;
  cabinet: string;
  primeMinister: string;
  startsOn: string;
  endsOn?: string;
  acting?: boolean;
  composition?: string;
  events?: Array<{
    id: string;
    eventType: CompositionEvent["eventType"];
    title: string;
    description: string;
    occurredOn: string;
  }>;
  partyAlignments?: Array<{
    partyId: string;
    alignment: GovernmentPartyAlignment["alignment"];
    basis: GovernmentPartyAlignment["basis"];
    startsOn?: string;
    endsOn?: string;
  }>;
}

const governments: GovernmentSeed[] = [
  { slug: "bolojan-acting-2026", cabinet: "Bolojan interimar", primeMinister: "Ilie Bolojan", startsOn: "2026-05-05", acting: true },
  {
    slug: "bolojan-2025-present",
    cabinet: "Bolojan",
    primeMinister: "Ilie Bolojan",
    startsOn: "2025-06-23",
    endsOn: "2026-05-05",
    composition: "PSD-PNL-USR-UDMR-minorități / PNL-USR-UDMR-minorități după retragerea PSD",
    events: [
      {
        id: "psd-withdraws-bolojan-2026",
        eventType: "coalition_change",
        title: "Bolojan: PSD se retrage din coaliție",
        description:
          "Schimbare de coaliție consemnată în rândul skeleton; PSD este tratat ca ieșit din coaliția guvernamentală începând cu această dată, până la verificare oficială completă.",
        occurredOn: "2026-04-24"
      },
      {
        id: "bolojan-no-confidence-2026",
        eventType: "no_confidence_motion",
        title: "Bolojan: moțiune de cenzură adoptată",
        description:
          "Guvernul Bolojan este marcat ca demis prin moțiune de cenzură; rând skeleton, de verificat și legat ulterior de votul oficial.",
        occurredOn: "2026-05-05"
      }
    ],
    partyAlignments: [
      { partyId: "party-psd", alignment: "government", basis: "manual_curation", startsOn: "2025-06-23", endsOn: "2026-04-24" },
      { partyId: "party-pnl", alignment: "government", basis: "manual_curation", startsOn: "2025-06-23", endsOn: "2026-05-05" },
      { partyId: "party-usr", alignment: "government", basis: "manual_curation", startsOn: "2025-06-23", endsOn: "2026-05-05" },
      { partyId: "party-udmr", alignment: "government", basis: "manual_curation", startsOn: "2025-06-23", endsOn: "2026-05-05" }
    ]
  },
  { slug: "predoiu-acting-2025", cabinet: "Predoiu interimar", primeMinister: "Cătălin Predoiu", startsOn: "2025-05-06", endsOn: "2025-06-23", acting: true },
  {
    slug: "ciolacu-ii-2024-2025",
    cabinet: "Ciolacu II",
    primeMinister: "Marcel Ciolacu",
    startsOn: "2024-12-23",
    endsOn: "2025-05-06",
    composition: "PSD-PNL-UDMR",
    partyAlignments: [
      { partyId: "party-psd", alignment: "government", basis: "manual_curation" },
      { partyId: "party-pnl", alignment: "government", basis: "manual_curation" },
      { partyId: "party-udmr", alignment: "government", basis: "manual_curation" }
    ]
  },
  {
    slug: "ciolacu-i-2023-2024",
    cabinet: "Ciolacu I",
    primeMinister: "Marcel Ciolacu",
    startsOn: "2023-06-15",
    endsOn: "2024-12-23",
    composition: "PSD-PNL",
    partyAlignments: [
      { partyId: "party-psd", alignment: "government", basis: "manual_curation" },
      { partyId: "party-pnl", alignment: "government", basis: "manual_curation" }
    ]
  },
  { slug: "predoiu-acting-2023", cabinet: "Predoiu interimar", primeMinister: "Cătălin Predoiu", startsOn: "2023-06-12", endsOn: "2023-06-15", acting: true },
  {
    slug: "ciuca-2021-2023",
    cabinet: "Ciucă",
    primeMinister: "Nicolae Ciucă",
    startsOn: "2021-11-25",
    endsOn: "2023-06-12",
    composition: "PSD-PNL-UDMR",
    partyAlignments: [
      { partyId: "party-psd", alignment: "government", basis: "manual_curation" },
      { partyId: "party-pnl", alignment: "government", basis: "manual_curation" },
      { partyId: "party-udmr", alignment: "government", basis: "manual_curation" }
    ]
  },
  {
    slug: "citu-2020-2021",
    cabinet: "Cîțu",
    primeMinister: "Florin Cîțu",
    startsOn: "2020-12-23",
    endsOn: "2021-11-25",
    composition: "PNL-USR PLUS-UDMR",
    partyAlignments: [
      { partyId: "party-pnl", alignment: "government", basis: "manual_curation" },
      { partyId: "party-usr", alignment: "government", basis: "manual_curation" },
      { partyId: "party-udmr", alignment: "government", basis: "manual_curation" }
    ]
  },
  { slug: "ciuca-acting-2020", cabinet: "Ciucă interimar", primeMinister: "Nicolae Ciucă", startsOn: "2020-12-07", endsOn: "2020-12-23", acting: true },
  { slug: "orban-2019-2020", cabinet: "Orban I-II", primeMinister: "Ludovic Orban", startsOn: "2019-11-04", endsOn: "2020-12-07", composition: "PNL" },
  {
    slug: "dancila-2018-2019",
    cabinet: "Dăncilă",
    primeMinister: "Viorica Dăncilă",
    startsOn: "2018-01-29",
    endsOn: "2019-11-04",
    composition: "PSD-ALDE",
    partyAlignments: [
      { partyId: "party-psd", alignment: "government", basis: "manual_curation" },
      { partyId: "party-alde", alignment: "government", basis: "manual_curation" }
    ]
  },
  { slug: "fifor-acting-2018", cabinet: "Fifor interimar", primeMinister: "Mihai Fifor", startsOn: "2018-01-16", endsOn: "2018-01-29", acting: true },
  {
    slug: "tudose-2017-2018",
    cabinet: "Tudose",
    primeMinister: "Mihai Tudose",
    startsOn: "2017-06-29",
    endsOn: "2018-01-16",
    composition: "PSD-ALDE",
    partyAlignments: [
      { partyId: "party-psd", alignment: "government", basis: "manual_curation" },
      { partyId: "party-alde", alignment: "government", basis: "manual_curation" }
    ]
  },
  {
    slug: "grindeanu-2017",
    cabinet: "Grindeanu",
    primeMinister: "Sorin Grindeanu",
    startsOn: "2017-01-04",
    endsOn: "2017-06-29",
    composition: "PSD-ALDE",
    partyAlignments: [
      { partyId: "party-psd", alignment: "government", basis: "manual_curation" },
      { partyId: "party-alde", alignment: "government", basis: "manual_curation" }
    ]
  },
  { slug: "ciolos-2015-2017", cabinet: "Cioloș", primeMinister: "Dacian Cioloș", startsOn: "2015-11-17", endsOn: "2017-01-04", composition: "tehnocrat" },
  { slug: "cimpeanu-acting-2015", cabinet: "Cîmpeanu interimar", primeMinister: "Sorin Cîmpeanu", startsOn: "2015-11-05", endsOn: "2015-11-17", acting: true },
  { slug: "ponta-iv-2014-2015", cabinet: "Ponta IV", primeMinister: "Victor Ponta", startsOn: "2014-12-17", endsOn: "2015-11-05", composition: "PSD-UNPR-ALDE" },
  { slug: "ponta-iii-2014", cabinet: "Ponta III", primeMinister: "Victor Ponta", startsOn: "2014-03-05", endsOn: "2014-12-17", composition: "PSD-UNPR-PC-PLR-UDMR" },
  { slug: "ponta-ii-2012-2014", cabinet: "Ponta II", primeMinister: "Victor Ponta", startsOn: "2012-12-21", endsOn: "2014-03-05", composition: "USL" },
  { slug: "ponta-i-2012", cabinet: "Ponta I", primeMinister: "Victor Ponta", startsOn: "2012-05-07", endsOn: "2012-12-21", composition: "USL" },
  { slug: "ungureanu-2012", cabinet: "Ungureanu", primeMinister: "Mihai Răzvan Ungureanu", startsOn: "2012-02-09", endsOn: "2012-05-07", composition: "PDL-PSD" },
  { slug: "predoiu-acting-2012", cabinet: "Predoiu interimar", primeMinister: "Cătălin Predoiu", startsOn: "2012-02-06", endsOn: "2012-02-09", acting: true },
  { slug: "boc-2008-2012", cabinet: "Boc I-II", primeMinister: "Emil Boc", startsOn: "2008-12-22", endsOn: "2012-02-06", composition: "PDL-PSD / PDL-UDMR-UNPR" },
  { slug: "tariceanu-2004-2008", cabinet: "Tăriceanu I-II", primeMinister: "Călin Popescu-Tăriceanu", startsOn: "2004-12-29", endsOn: "2008-12-22", composition: "PNL-PD-PUR/PC-UDMR / PNL-UDMR" },
  { slug: "bejinariu-acting-2004", cabinet: "Bejinariu interimar", primeMinister: "Eugen Bejinariu", startsOn: "2004-12-21", endsOn: "2004-12-28", acting: true },
  { slug: "nastase-2000-2004", cabinet: "Năstase", primeMinister: "Adrian Năstase", startsOn: "2000-12-28", endsOn: "2004-12-21", composition: "PDSR/PSD-PUR" },
  { slug: "isarescu-1999-2000", cabinet: "Isărescu", primeMinister: "Mugur Isărescu", startsOn: "1999-12-22", endsOn: "2000-12-28", composition: "CDR-USD-UDMR" },
  { slug: "athanasiu-acting-1999", cabinet: "Athanasiu interimar", primeMinister: "Alexandru Athanasiu", startsOn: "1999-12-13", endsOn: "1999-12-22", acting: true },
  { slug: "vasile-1998-1999", cabinet: "Vasile", primeMinister: "Radu Vasile", startsOn: "1998-04-17", endsOn: "1999-12-13", composition: "CDR-USD-UDMR" },
  { slug: "dejeu-acting-1998", cabinet: "Dejeu interimar", primeMinister: "Gavril Dejeu", startsOn: "1998-03-30", endsOn: "1998-04-17", acting: true },
  { slug: "ciorbea-1996-1998", cabinet: "Ciorbea", primeMinister: "Victor Ciorbea", startsOn: "1996-12-12", endsOn: "1998-03-30", composition: "CDR-USD-UDMR" },
  {
    slug: "vacaroiu-1992-1996",
    cabinet: "Văcăroiu",
    primeMinister: "Nicolae Văcăroiu",
    startsOn: "1992-11-19",
    endsOn: "1996-12-11",
    composition: "FDSN/PDSR cu sprijin parlamentar PRM-PUNR-PSM",
    partyAlignments: [
      { partyId: "party-pdsr", alignment: "government", basis: "manual_curation" },
      { partyId: "party-prm", alignment: "governing_support", basis: "manual_curation" },
      { partyId: "party-punr", alignment: "governing_support", basis: "manual_curation" },
      { partyId: "party-psm", alignment: "governing_support", basis: "manual_curation" }
    ]
  },
  { slug: "stolojan-1991-1992", cabinet: "Stolojan", primeMinister: "Theodor Stolojan", startsOn: "1991-10-16", endsOn: "1992-11-19", composition: "FSN-PNL-MER-PDAR" },
  { slug: "roman-ii-iii-1990-1991", cabinet: "Roman II-III", primeMinister: "Petre Roman", startsOn: "1990-06-28", endsOn: "1991-10-16", composition: "FSN" },
  { slug: "roman-i-1989-1990", cabinet: "Roman I", primeMinister: "Petre Roman", startsOn: "1989-12-26", endsOn: "1990-06-28", composition: "FSN" },
  { slug: "cfsn-provisional-1989", cabinet: "CFSN provizoriu", primeMinister: "Consiliul Frontului Salvării Naționale", startsOn: "1989-12-22", endsOn: "1989-12-26", acting: true, composition: "FSN" }
];

export function governmentSkeletonData(): {
  people: Person[];
  governments: Government[];
  roles: GovernmentRole[];
  events: CompositionEvent[];
  partyAlignments: GovernmentPartyAlignment[];
  obsoleteGovernmentIds: string[];
} {
  const people = uniqueBy(
    governments.map((item) => {
      const slug = slugify(item.primeMinister);
      return {
        id: `person-${slug}`,
        slug,
        displayName: item.primeMinister,
        normalizedName: slug,
        sourceIds: { governmentSkeleton: sourceUrl }
      };
    }),
    (person) => person.id
  );

  return {
    people,
    governments: governments.map((item) => {
      const personId = `person-${slugify(item.primeMinister)}`;
      return {
        id: `government-${item.slug}`,
        slug: item.slug,
        name: item.cabinet,
        primeMinisterPersonId: personId,
        startsOn: item.startsOn,
        endsOn: item.endsOn,
        basis: "manual_curation",
        sourceSnapshotId: undefined
      };
    }),
    roles: governments.map((item) => ({
      id: `government-role-pm-${item.slug}`,
      governmentId: `government-${item.slug}`,
      personId: `person-${slugify(item.primeMinister)}`,
      title: item.acting ? "Prim-ministru interimar" : "Prim-ministru",
      ministry: "Guvernul României",
      startsOn: item.startsOn,
      endsOn: item.endsOn
    })),
    events: governments.flatMap((item) => {
      const governmentId = `government-${item.slug}`;
      const personId = `person-${slugify(item.primeMinister)}`;
      const start: CompositionEvent = {
        id: `composition-event-${item.slug}-start`,
        eventType: item.acting ? "government_designated" : "government_invested",
        title: `${item.cabinet}: ${item.primeMinister}`,
        description: [
          item.acting ? "Mandat interimar început." : "Guvern început.",
          item.composition ? `Compoziție: ${item.composition}.` : undefined,
          "Rând skeleton, marcat pentru verificare ulterioară din surse oficiale."
        ]
          .filter(Boolean)
          .join(" "),
        occurredOn: item.startsOn,
        governmentId,
        personId
      };
      const end: CompositionEvent | undefined = item.endsOn
        ? {
            id: `composition-event-${item.slug}-end`,
            eventType: "government_ended",
            title: `${item.cabinet}: sfârșit mandat`,
            description: "Final de perioadă guvernamentală în skeleton-ul cronologic.",
            occurredOn: item.endsOn,
            governmentId,
            personId
          }
        : undefined;
      const extraEvents: CompositionEvent[] = (item.events ?? []).map((event) => ({
        id: `composition-event-${item.slug}-${event.id}`,
        eventType: event.eventType,
        title: event.title,
        description: event.description,
        occurredOn: event.occurredOn,
        governmentId,
        personId
      }));
      return [...(end ? [start, end] : [start]), ...extraEvents];
    }),
    partyAlignments: governments.flatMap((item) =>
      [...(item.partyAlignments ?? []), ...partyAlignmentsForGovernment(item.slug, item.startsOn, item.endsOn)].map((alignment) => ({
        id: `government-party-alignment-${item.slug}-${alignment.partyId}-${alignment.startsOn ?? item.startsOn}`,
        governmentId: `government-${item.slug}`,
        partyId: alignment.partyId,
        alignment: alignment.alignment,
        basis: alignment.basis,
        startsOn: alignment.startsOn ?? item.startsOn,
        endsOn: alignment.endsOn ?? item.endsOn
      }))
    ),
    obsoleteGovernmentIds: ["government-bolojan-2025-2026"]
  };
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = key(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
