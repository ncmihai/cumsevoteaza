import Link from "next/link";
import { chamberLabels } from "@cumsevoteaza/parliament-model";
import { getMemberDirectoryData } from "@/lib/data";
import { isLocale, messagesFor, type AppLocale } from "@/lib/i18n";

export default async function MembersPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ chamber?: string; group?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const filters = await searchParams;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : "ro";
  const messages = messagesFor(locale);
  const data = await getMemberDirectoryData(filters);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase text-blue-800">{messages.home.eyebrow}</div>
          <h1 className="mt-2 text-4xl font-semibold text-slate-950">{messages.nav.members}</h1>
        </div>
        <span className="rounded bg-slate-200 px-2 py-1 text-xs uppercase text-slate-700">{data.sourceKind}</span>
      </div>

      <section className="mt-6 flex flex-wrap gap-2">
        <FilterLink href={`/${locale}/members`} active={!filters.chamber && !filters.group}>
          Toți
        </FilterLink>
        <FilterLink href={`/${locale}/members?chamber=senate`} active={filters.chamber === "senate"}>
          {chamberLabels[locale].senate}
        </FilterLink>
        <FilterLink href={`/${locale}/members?chamber=deputies`} active={filters.chamber === "deputies"}>
          {chamberLabels[locale].deputies}
        </FilterLink>
      </section>

      <section className="mt-3 flex flex-wrap gap-2">
        {data.groups.map((group) => (
          <FilterLink key={group.id} href={`/${locale}/members?group=${group.id}`} active={filters.group === group.id}>
            {group.shortName}
          </FilterLink>
        ))}
      </section>

      <section className="mt-6 overflow-x-auto border border-slate-300 bg-white">
        <table className="min-w-[760px] w-full border-collapse text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">{messages.nav.members}</th>
              <th className="px-3 py-2">{messages.common.chamber}</th>
              <th className="px-3 py-2">Grup</th>
              <th className="px-3 py-2">{messages.nav.parties}</th>
              <th className="px-3 py-2">Circumscripție</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.members.map(({ member, mandate, group, party }) => (
              <tr key={member.id} className="hover:bg-slate-50">
                <td className="px-3 py-3">
                  <Link className="font-medium underline" href={`/${locale}/members/${member.slug}`}>
                    {member.displayName}
                  </Link>
                </td>
                <td className="px-3 py-3">{mandate ? chamberLabels[locale][mandate.chamber] : "-"}</td>
                <td className="px-3 py-3">{group?.shortName ?? "-"}</td>
                <td className="px-3 py-3">
                  {party ? (
                    <Link className="underline" href={`/${locale}/parties/${party.slug}`}>
                      {party.shortName}
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-3 text-slate-600">{mandate?.constituency ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-md border px-3 py-2 text-sm ${
        active ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
      }`}
    >
      {children}
    </Link>
  );
}
