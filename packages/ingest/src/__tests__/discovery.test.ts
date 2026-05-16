import { describe, expect, it } from "vitest";
import { discoverOfficialLinks } from "../sync";

describe("official source discovery", () => {
  it("detects Senate bill and vote links from official-style pages", () => {
    const html = `
      <table>
        <tr>
          <td>03.02.2025</td>
          <td><a href="/Legis/Lista.aspx?cod=27035">L316/2025 Proiect de lege</a></td>
          <td><a href="/VoturiPlenDetaliu.aspx?AppID=abc&Cod=27035&Data=2025-10-27">Vot final</a></td>
        </tr>
      </table>
    `;

    const discoveries = discoverOfficialLinks(html, "https://www.senat.ro/Legis/Lista.aspx", "senate", "source-test");

    expect(discoveries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ chamber: "senate", kind: "bill", officialId: "L316/2025" }),
        expect.objectContaining({ chamber: "senate", kind: "vote" })
      ])
    );
  });

  it("classifies Senate number-search URLs as bill sources", () => {
    const html = `<a href="/legis/lista.aspx?an_cls=2025&nr_cls=L316">L316/2025</a>`;

    const discoveries = discoverOfficialLinks(html, "https://www.senat.ro/Legis/Lista.aspx", "senate");

    expect(discoveries).toEqual([
      expect.objectContaining({
        chamber: "senate",
        kind: "bill",
        officialId: "L316/2025"
      })
    ]);
  });

  it("detects Chamber bill and nominal vote links from official-style pages", () => {
    const html = `
      <table>
        <tr>
          <td>12.03.2025</td>
          <td><a href="/pls/proiecte/upl_pck2015.proiect?idp=22513">PL-x 42/2025 Proiect de lege</a></td>
          <td><a href="/pls/steno/evot2015.Nominal?idv=35953">Vot nominal</a></td>
        </tr>
      </table>
    `;

    const discoveries = discoverOfficialLinks(html, "https://www.cdep.ro/pls/proiecte/upl_pck2015.lista?anp=2025", "deputies");

    expect(discoveries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ chamber: "deputies", kind: "bill", officialId: "PL-x 42/2025" }),
        expect.objectContaining({ chamber: "deputies", kind: "vote" })
      ])
    );
  });
});
