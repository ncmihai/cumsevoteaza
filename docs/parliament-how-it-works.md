# How The Romanian Parliament Works

Working product notes for `cumsevoteaza`. This file is factual reference material
for UI explanations, glossary entries, parser naming, and future onboarding copy.

## Source Priority

1. Official source pages and legal texts are the source of truth for app behavior.
2. Wikipedia is useful for a public overview and historical context, but not for
   parser rules or contested/current values.
3. If official sources disagree or omit data, the app should show the conflict or
   `unknown` rather than infer.

Reference URLs:

- https://ro.wikipedia.org/wiki/Parlamentul_Rom%C3%A2niei
- https://www.senat.ro/pagini/proceduri/proceduri.htm
- https://www.senat.ro/pagini/comisii/comisiile_permanente_ale_senatului.htm
- https://www.senat.ro/pagini/grupuri/grupuri.htm
- https://www.cdep.ro/pls/parlam/structura.gp
- https://www.constitutia.ro/art-61-rolul-si-structura.htm
- https://www.constitutia.ro/art-75-sesizarea-camerelor.htm

## Core Structure

Parliament is bicameral: the Senate and the Chamber of Deputies. A bill normally
passes through both chambers before it can become law. The chambers are not just
duplicates: after the 2003 constitutional changes, one chamber is usually the
first chamber notified and the other is the decision chamber, depending on the
subject matter.

The app should therefore model:

- chamber: Senate or Chamber of Deputies
- first chamber notified: where the bill is first debated
- decision chamber: where the final parliamentary decision is made for that bill
- stage/event: registration, committee referral, report, plenary debate, vote,
  transmission, promulgation-related steps

## Legislative Flow

Typical simplified path:

1. A project or proposal is submitted.
2. It is registered in the first chamber notified.
3. It is sent to committees for reports and opinions.
4. The chamber debates and votes.
5. It is transmitted to the other chamber.
6. The decision chamber debates and votes.
7. If adopted, the law goes to promulgation and publication steps outside the
   ordinary vote page surface.

The first chamber normally has a constitutional deadline to pronounce itself.
Official source pages and the Constitution should determine the exact deadline
or procedure category shown in the UI.

## Committees

Committees are internal working bodies. Product description:

> Committees examine bills in detail, prepare reports or opinions, and support
> plenary debate. A committee row on a member profile means the member is or was
> assigned to that working body during the shown period.

Committee roles:

- President/chair: leads the committee's work and meetings.
- Vice president/vice chair: substitutes or supports the chair according to the
  committee rules.
- Secretary: handles attendance, documents, votes, minutes, and procedural
  records where the chamber rules assign those duties.
- Member: participates in committee work without one of the listed bureau roles.

Parser rule: store committee names and roles exactly as visible. Do not collapse
similar committee names unless we have an explicit official identifier.

## Parliamentary Groups

Parliamentary groups are political working groups inside each chamber. Product
description:

> A parliamentary group organizes members from the same political formation or
> parliamentary alignment inside a chamber. Groups influence representation in
> chamber bodies, committee allocation, procedural positions, and the political
> position taken toward bills.

Group roles:

- Leader: represents the group in procedural discussions; can participate in
  leadership coordination and may request procedural actions where the chamber
  rules allow.
- Vice leader: replaces or supports the leader according to the group mandate.
- Secretary: handles group documents and administrative records where visible in
  official sources.

Parser rule: group membership is temporal. A member moving between groups creates
a new row; never overwrite earlier affiliation.

## Plenary And Vote Pages

The plenary is the full chamber meeting. The app should keep two layers:

- Visual layer: chamber-style map by group and vote choice.
- Audit layer: nominal table with member, group, vote, method, and source link.

Vote choices remain factual:

- `for`
- `against`
- `abstention`
- `present_not_voting`
- `absent`
- `unknown`

`absent` should be used when a roster member is in the chamber but no nominal
vote row exists and official totals or context support absence. `unknown` should
be used when the source is incomplete or inconsistent.

## Member Profile Meaning

The profile is a parliamentary-career history, not a full political biography.
Rows should explain what happened during a period:

- mandate: elected/validated service in a chamber
- group: parliamentary group membership
- party: political formation where official source exposes it
- committee: committee assignment and role
- role: official chamber/group/committee role
- vote activity: imported nominal vote counts only
- proposals: imported sponsor counts only

## Product Copy Rules

- Be factual, not evaluative.
- Link to official source snapshots wherever possible.
- Prefer `unknown` or `not imported yet` over inference.
- Do not label ideology or score members in V1.
- Do not claim the chamber map is an exact physical seating chart unless an
  official seating source is imported.
