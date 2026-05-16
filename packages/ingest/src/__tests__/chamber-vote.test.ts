import { describe, expect, it } from "vitest";
import { parseChamberNominalVote } from "../parsers/chamber-vote";

describe("parseChamberNominalVote", () => {
  it("parses only nominal member rows and uses official member ids", () => {
    const html = `
      <html>
        <head><title>VOT ELECTRONIC</title></head>
        <body>
          <table>
            <tr><td>Data:</td><td>03.12.2025</td></tr>
            <tr><td>Subiect vot:</td><td><b>Vot final - PL-x 429/2025</b><br>Adoptare <a href="/ords/pls/proiecte/upl_pck2015.proiect?idp=22702">PL 429/2025</a> privind implementarea unor aspecte vizând punctul unic de acces european<br>- lege ordinara</td></tr>
            <tr><td>- Pentru (DA):</td><td>1</td></tr>
            <tr><td>- Contra (NU):</td><td>1</td></tr>
            <tr><td>- Abtineri (AB):</td><td>1</td></tr>
            <tr><td>- Nu au votat (-):</td><td>1</td></tr>
          </table>
          <table>
            <tr><td>#</td><td>Nume si prenume</td><td>Grup</td><td>Vot</td></tr>
            <tr>
              <td>1.</td>
              <td><a href="/ords/pls/parlam/structura2015.mp?idm=3&cam=2&leg=2024">Albu Dumitriţa</a></td>
              <td>Neafiliati</td>
              <td>DA</td>
            </tr>
            <tr>
              <td>2.</td>
              <td><a href="/ords/pls/parlam/structura2015.mp?idm=4&cam=2&leg=2024">Alecsandru Marius-Nicolae</a></td>
              <td>USR</td>
              <td>NU</td>
            </tr>
            <tr>
              <td>3.</td>
              <td><a href="/ords/pls/parlam/structura2015.mp?idm=5&cam=2&leg=2024">Alecu Robert</a></td>
              <td>PSD(afiliat)</td>
              <td>AB</td>
            </tr>
            <tr>
              <td>4.</td>
              <td><a href="/ords/pls/parlam/structura2015.mp?idm=6&cam=2&leg=2024">Amet Varol</a></td>
              <td>Minoritati</td>
              <td>-</td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const parsed = parseChamberNominalVote(html, "https://www.cdep.ro/ords/pls/steno/evot2015.Nominal?idv=35953");

    expect(parsed.sourceSnapshot.status).toBe("parsed");
    expect(parsed.vote.heldOn).toBe("2025-12-03");
    expect(parsed.vote.title).toBe("Vot final - PL-x 429/2025 - Adoptare");
    expect(parsed.vote.billId).toBe("bill-pl-x-429-2025");
    expect(parsed.bill).toMatchObject({
      id: "bill-pl-x-429-2025",
      title: "privind implementarea unor aspecte vizând punctul unic de acces european",
      identifiers: { deputies: "PL-x 429/2025" }
    });
    expect(parsed.vote.totals).toEqual({
      present: 4,
      for: 1,
      against: 1,
      abstention: 1,
      presentNotVoting: 1
    });
    expect(parsed.members.map((member) => member.id)).toEqual([
      "member-deputies-3",
      "member-deputies-4",
      "member-deputies-5",
      "member-deputies-6"
    ]);
    expect(parsed.individualVotes.map((vote) => vote.choice)).toEqual(["for", "against", "abstention", "present_not_voting"]);
    expect(parsed.individualVotes.map((vote) => vote.groupId)).toEqual([
      "group-deputies-unaffiliated",
      "group-deputies-usr",
      "group-deputies-psd",
      "group-deputies-minoritati"
    ]);
  });
});
