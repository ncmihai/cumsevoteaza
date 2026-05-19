export type Locale = "ro" | "en";

export type ChamberId = "senate" | "deputies";

export type VoteChoice =
  | "for"
  | "against"
  | "abstention"
  | "present_not_voting"
  | "absent"
  | "unknown";

export type SourceStatus = "parsed" | "partial" | "failed";

export type GovernanceAlignment =
  | "government"
  | "governing_support"
  | "opposition"
  | "mixed"
  | "unaffiliated"
  | "unknown";

export type AlignmentBasis =
  | "official_investiture"
  | "official_coalition"
  | "parliamentary_group_declaration"
  | "computed_vote_support"
  | "manual_curation"
  | "unknown";

export type CompositionEventType =
  | "legislature_start"
  | "legislature_end"
  | "government_designated"
  | "government_invested"
  | "government_ended"
  | "minister_appointed"
  | "minister_ended"
  | "reshuffle"
  | "no_confidence_motion"
  | "confidence_vote"
  | "coalition_change"
  | "group_change"
  | "member_mandate_start"
  | "member_mandate_end"
  | "committee_change"
  | "role_change"
  | "other";

export interface SourceSnapshot {
  id: string;
  sourceUrl: string;
  fetchedAt: string;
  contentHash: string;
  parser: string;
  parserVersion: string;
  status: SourceStatus;
  notes?: string;
}

export interface Legislature {
  id: string;
  label: string;
  startsOn: string;
  endsOn: string;
}

export interface Party {
  id: string;
  slug: string;
  shortName: string;
  name: string;
  color: string;
}

export interface ParliamentaryGroup {
  id: string;
  partyId?: string;
  chamber: ChamberId;
  shortName: string;
  name: string;
  color: string;
}

export interface Person {
  id: string;
  slug: string;
  displayName: string;
  normalizedName: string;
  birthDate?: string;
  sourceIds: Record<string, string>;
}

export interface Member {
  id: string;
  personId?: string;
  slug: string;
  firstName: string;
  lastName: string;
  displayName: string;
  sourceIds: Record<string, string>;
}

export interface Government {
  id: string;
  slug: string;
  name: string;
  legislatureId?: string;
  primeMinisterPersonId?: string;
  startsOn: string;
  endsOn?: string;
  basis: AlignmentBasis;
  investitureVoteId?: string;
  sourceSnapshotId?: string;
}

export interface GovernmentRole {
  id: string;
  governmentId: string;
  personId: string;
  title: string;
  ministry?: string;
  startsOn: string;
  endsOn?: string;
  sourceSnapshotId?: string;
}

export interface GovernmentPartyAlignment {
  id: string;
  governmentId: string;
  partyId: string;
  alignment: GovernanceAlignment;
  basis: AlignmentBasis;
  startsOn: string;
  endsOn?: string;
  sourceSnapshotId?: string;
}

export interface GovernmentGroupAlignment {
  id: string;
  governmentId: string;
  groupId: string;
  alignment: GovernanceAlignment;
  basis: AlignmentBasis;
  startsOn: string;
  endsOn?: string;
  sourceSnapshotId?: string;
}

export interface MemberGovernanceAlignment {
  id: string;
  memberId: string;
  governmentId?: string;
  alignment: GovernanceAlignment;
  basis: AlignmentBasis;
  startsOn: string;
  endsOn?: string;
  sourceSnapshotId?: string;
}

export interface CompositionEvent {
  id: string;
  eventType: CompositionEventType;
  title: string;
  description?: string;
  occurredOn: string;
  endsOn?: string;
  legislatureId?: string;
  governmentId?: string;
  chamber?: ChamberId;
  memberId?: string;
  personId?: string;
  partyId?: string;
  groupId?: string;
  sourceSnapshotId?: string;
}

export interface MemberMandate {
  id: string;
  memberId: string;
  legislatureId: string;
  chamber: ChamberId;
  startsOn: string;
  endsOn?: string;
  constituency?: string;
  status: "active" | "ended" | "unknown";
  sourceSnapshotId?: string;
}

export interface MemberGroupMembership {
  id: string;
  memberId: string;
  groupId: string;
  startsOn: string;
  endsOn?: string;
  logoUrl?: string;
  sourceSnapshotId?: string;
}

export interface MemberPartyAffiliation {
  id: string;
  memberId: string;
  partyId: string;
  startsOn: string;
  endsOn?: string;
  logoUrl?: string;
  sourceSnapshotId?: string;
}

export interface MemberMandateRelation {
  id: string;
  mandateId: string;
  relation: "replaces";
  relatedMemberId?: string;
  relatedName: string;
  relatedOfficialUrl?: string;
  sourceSnapshotId?: string;
}

export interface MemberCommitteeMembership {
  id: string;
  memberId: string;
  committeeName: string;
  chamber: ChamberId;
  startsOn: string;
  endsOn?: string;
  role?: string;
  sourceSnapshotId?: string;
}

export interface MemberRole {
  id: string;
  memberId: string;
  title: string;
  chamber: ChamberId;
  startsOn: string;
  endsOn?: string;
  sourceSnapshotId?: string;
}

export interface Bill {
  id: string;
  slug: string;
  title: string;
  identifiers: Record<string, string>;
  chamberOfOrigin: ChamberId | "unknown";
  status: string;
  sourceSnapshotIds: string[];
}

export interface BillEvent {
  id: string;
  billId: string;
  occurredOn: string;
  chamber: ChamberId | "joint" | "unknown";
  label: string;
  sourceUrl?: string;
}

export interface BillSponsor {
  id: string;
  billId: string;
  sponsorType: "member" | "government" | "group" | "unknown";
  memberId?: string;
  name: string;
}

export interface DocumentSource {
  id: string;
  billId: string;
  label: string;
  url: string;
}

export interface VoteTotals {
  present: number;
  for: number;
  against: number;
  abstention: number;
  presentNotVoting: number;
  absent?: number;
}

export interface Vote {
  id: string;
  billId?: string;
  chamber: ChamberId;
  title: string;
  heldOn: string;
  voteType: string;
  totals: VoteTotals;
  sourceSnapshotId: string;
}

export interface GroupVoteTotal {
  id: string;
  voteId: string;
  groupId: string;
  for: number;
  against: number;
  abstention: number;
  presentNotVoting: number;
}

export interface IndividualVote {
  id: string;
  voteId: string;
  memberId: string;
  groupId?: string;
  choice: VoteChoice;
  voteMethod?: string;
}

export interface MemberHistoryRow {
  id: string;
  startsOn: string;
  endsOn?: string;
  chamber: ChamberId;
  type: "mandate" | "group" | "party" | "committee" | "role" | "relation";
  label: string;
  details: string;
  logoUrl?: string;
  sourceUrl?: string;
  votesFor: number;
  votesAgainst: number;
  abstentions: number;
  proposals: number;
}

export interface NormalizedDataset {
  legislatures: Legislature[];
  parties: Party[];
  groups: ParliamentaryGroup[];
  people?: Person[];
  members: Member[];
  governments?: Government[];
  governmentRoles?: GovernmentRole[];
  governmentPartyAlignments?: GovernmentPartyAlignment[];
  governmentGroupAlignments?: GovernmentGroupAlignment[];
  memberGovernanceAlignments?: MemberGovernanceAlignment[];
  compositionEvents?: CompositionEvent[];
  mandates: MemberMandate[];
  groupMemberships: MemberGroupMembership[];
  partyAffiliations: MemberPartyAffiliation[];
  committeeMemberships: MemberCommitteeMembership[];
  roles: MemberRole[];
  bills: Bill[];
  billEvents: BillEvent[];
  billSponsors: BillSponsor[];
  documents: DocumentSource[];
  votes: Vote[];
  groupVoteTotals: GroupVoteTotal[];
  individualVotes: IndividualVote[];
  sourceSnapshots: SourceSnapshot[];
  memberHistory: Record<string, MemberHistoryRow[]>;
}
