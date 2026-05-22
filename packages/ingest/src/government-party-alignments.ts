import type { GovernmentPartyAlignment } from "@cumsevoteaza/parliament-model";

type AlignmentSeed = Omit<GovernmentPartyAlignment, "id" | "governmentId"> & {
  governmentSlug: string;
};

const reviewedAlignments: AlignmentSeed[] = [
  ...government("orban-2019-2020", "government", ["party-pnl"]),
  ...government("ciolos-2015-2017", "governing_support", ["party-psd", "party-pnl", "party-unpr", "party-udmr", "party-minoritati"]),
  ...government("ponta-iv-2014-2015", "government", ["party-psd", "party-unpr"]),
  ...government("ponta-iv-2014-2015", "government", ["party-alde"], { startsOn: "2015-06-19" }),
  ...government("ponta-iii-2014", "government", ["party-psd", "party-unpr", "party-pc", "party-udmr"]),
  ...government("ponta-ii-2012-2014", "government", ["party-psd", "party-pc", "party-unpr"]),
  ...government("ponta-ii-2012-2014", "government", ["party-pnl"], { endsOn: "2014-02-25" }),
  ...government("ponta-i-2012", "government", ["party-psd", "party-pnl", "party-pc"]),
  ...government("ungureanu-2012", "government", ["party-pdl", "party-udmr", "party-unpr"]),
  ...government("boc-2008-2012", "government", ["party-pdl", "party-psd"], { startsOn: "2008-12-22", endsOn: "2009-10-01" }),
  ...government("boc-2008-2012", "government", ["party-pdl", "party-udmr", "party-unpr"], { startsOn: "2009-12-23" }),
  ...government("tariceanu-2004-2008", "government", ["party-pnl", "party-pd", "party-pur", "party-pc", "party-udmr"], {
    startsOn: "2004-12-29",
    endsOn: "2007-04-05"
  }),
  ...government("tariceanu-2004-2008", "government", ["party-pnl", "party-udmr"], { startsOn: "2007-04-05" }),
  ...government("nastase-2000-2004", "government", ["party-pdsr", "party-pur"], { endsOn: "2001-06-16" }),
  ...government("nastase-2000-2004", "government", ["party-psd", "party-pur"], { startsOn: "2001-06-16" }),
  ...government("isarescu-1999-2000", "government", ["party-pntcd", "party-pnl", "party-pd", "party-psdr", "party-udmr"]),
  ...government("vasile-1998-1999", "government", ["party-pntcd", "party-pnl", "party-pd", "party-psdr", "party-udmr"]),
  ...government("ciorbea-1996-1998", "government", ["party-pntcd", "party-pnl", "party-pd", "party-psdr", "party-udmr"]),
  ...government("stolojan-1991-1992", "government", ["party-fsn", "party-pnl", "party-mer", "party-pdar"]),
  ...government("roman-ii-iii-1990-1991", "government", ["party-fsn"]),
  ...government("roman-i-1989-1990", "government", ["party-fsn"])
];

export function partyAlignmentsForGovernment(governmentSlug: string, defaultStartsOn: string, defaultEndsOn?: string): GovernmentPartyAlignment[] {
  return reviewedAlignments
    .filter((alignment) => alignment.governmentSlug === governmentSlug)
    .map((alignment) => ({
      id: `government-party-alignment-${alignment.governmentSlug}-${alignment.partyId}-${alignment.startsOn === "__government_start__" ? defaultStartsOn : alignment.startsOn}`,
      governmentId: `government-${alignment.governmentSlug}`,
      partyId: alignment.partyId,
      alignment: alignment.alignment,
      basis: alignment.basis,
      startsOn: alignment.startsOn === "__government_start__" ? defaultStartsOn : alignment.startsOn,
      endsOn: alignment.endsOn ?? defaultEndsOn
    }));
}

function government(
  governmentSlug: string,
  alignment: GovernmentPartyAlignment["alignment"],
  partyIds: string[],
  options: { startsOn?: string; endsOn?: string; basis?: GovernmentPartyAlignment["basis"] } = {}
): AlignmentSeed[] {
  const startsOn = options.startsOn ?? "__government_start__";
  return partyIds.map((partyId) => ({
    governmentSlug,
    partyId,
    alignment,
    basis: options.basis ?? "manual_curation",
    startsOn,
    endsOn: options.endsOn
  }));
}
