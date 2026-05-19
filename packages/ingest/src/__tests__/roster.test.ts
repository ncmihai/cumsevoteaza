import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseDeputiesMemberProfile, parseDeputiesRosterGroup, parseDeputiesRosterIndex } from "../parsers/deputies-roster";
import { legislature2020, legislature2024 } from "../parsers/roster";
import { parseSenateMemberProfile, parseSenateRosterGroup, parseSenateRosterIndex } from "../parsers/senate-roster";

const fixtures = path.join(__dirname, "../fixtures");

describe("roster parsers", () => {
  it("parses Senate groups, members, mandates, and committees", () => {
    const index = parseSenateRosterIndex(read("senate-roster-index.html"), "https://www.senat.ro/EnumGrupuri.aspx");
    expect(index.groups).toHaveLength(1);
    expect(index.groups[0]?.group.id).toBe("group-senate-psd");

    const group = parseSenateRosterGroup(read("senate-roster-group.html"), index.groups[0]!.url, index.groups[0]!.group);
    expect(group.members).toHaveLength(1);
    expect(group.members[0]?.member.id).toBe("member-senate-b9c904e7-969f-4126-b0e1-0ebd3a003cc5");

    const profile = parseSenateMemberProfile(read("senate-member-profile.html"), group.members[0]!.profileUrl);
    expect(profile.member.slug).toBe("andra-bica");
    expect(profile.mandate?.startsOn).toBe("2024-12-21");
    expect(profile.committeeMemberships[0]?.committeeName).toContain("Comisia pentru buget");
  });

  it("parses Deputies groups, members, roles, party movements, and committees", () => {
    const index = parseDeputiesRosterIndex(read("deputies-roster-index.html"), "https://cdep.ro/ords/pls/dic/site2015.home?idl=1");
    expect(index.groups).toHaveLength(1);
    expect(index.groups[0]?.expectedCount).toBe(93);

    const group = parseDeputiesRosterGroup(read("deputies-roster-group.html"), index.groups[0]!.url, index.groups[0]!.group);
    expect(group.members).toHaveLength(2);
    expect(group.members[0]?.role?.title).toBe("Lider grup parlamentar");

    const profile = parseDeputiesMemberProfile(read("deputies-member-profile.html"), group.members[0]!.profileUrl);
    expect(profile.member.id).toBe("member-deputies-254");
    expect(profile.mandate?.startsOn).toBe("2024-12-21");
    expect(profile.mandate?.constituency).toBe("TIMIŞ");
    expect(profile.partyAffiliations[0]?.partyId).toBe("party-psd");
    expect(profile.groupMemberships[0]?.groupId).toBe("group-deputies-psd");
    expect(profile.committeeMemberships[0]?.committeeName).toContain("Comisia pentru cultură");
  });

  it("parses Deputies month-level party and group movements without swallowing the whole profile", () => {
    const profile = parseDeputiesMemberProfile(read("deputies-member-profile-movements.html"), "https://www.cdep.ro/ords/pls/parlam/structura2015.mp?idm=113&leg=2024", {
      legislature: legislature2024
    });

    expect(profile.mandate?.constituency).toBe("HUNEDOARA");
    expect(profile.partyAffiliations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ partyId: "party-pot", startsOn: "2024-12-21", endsOn: "2026-04-30" }),
        expect.objectContaining({ partyId: "party-upr", startsOn: "2026-05-01" })
      ])
    );
    expect(profile.groupMemberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ groupId: "group-deputies-pot", startsOn: "2024-12-21", endsOn: "2026-04-30" }),
        expect.objectContaining({ groupId: "group-deputies-upr", startsOn: "2026-05-01" })
      ])
    );
  });

  it("keeps historical roster mandates in their own legislature", () => {
    const profile = parseDeputiesMemberProfile("<html><body><h1>Deputat Istoric</h1></body></html>", "https://www.cdep.ro/ords/pls/parlam/structura2015.mp?idm=294&leg=2020", {
      legislature: legislature2020
    });

    expect(profile.member.id).toBe("member-deputies-2020-294");
    expect(profile.mandate?.id).toBe("mandate-member-deputies-2020-294-2020-2024-deputies");
    expect(profile.mandate?.legislatureId).toBe("leg-2020-2024");
    expect(profile.mandate?.startsOn).toBe("2020-12-21");
  });
});

function read(file: string): string {
  return readFileSync(path.join(fixtures, file), "utf8");
}
