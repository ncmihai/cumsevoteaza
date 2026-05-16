import Link from "next/link";
import { chamberLabels } from "@cumsevoteaza/parliament-model";
import { getMemberDirectoryData } from "@/lib/data";
import { isLocale, messagesFor, type AppLocale } from "@/lib/i18n";
import { SearchEngagementTracker } from "../_components/EngagementTracker";

export default async function MembersPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ chamber?: string; group?: string; q?: string; legislature?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const filters = await searchParams;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : "ro";
  const messages = messagesFor(locale);
  const data = await getMemberDirectoryData(filters);
  const activeGroupFilter = filters.group && data.groups.some((group) => group.id === filters.group) ? filters.group : undefined;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <SearchEngagementTracker entityType="member" query={filters.q} locale={locale} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase text-blue-800">{messages.home.eyebrow}</div>
          <h1 className="mt-2 text-4xl font-semibold text-slate-950">{messages.nav.members}</h1>
        </div>
        <span className="rounded bg-slate-200 px-2 py-1 text-xs uppercase text-slate-700">{data.sourceKind}</span>
      </div>

      <form action={`/${locale}/members`} className="mt-6 grid gap-3 border border-slate-300 bg-white p-4 md:grid-cols-[minmax(220px,1fr)_220px_auto]">
        {filters.chamber ? <input type="hidden" name="chamber" value={filters.chamber} /> : null}
        {activeGroupFilter ? <input type="hidden" name="group" value={activeGroupFilter} /> : null}
        <label className="flex items-center gap-2 border border-slate-300 px-3 py-2">
          <input
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-900 outline-none"
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder={messages.home.searchPlaceholder}
            aria-label={messages.home.searchPlaceholder}
          />
        </label>
        <label className="grid gap-1 text-xs uppercase text-slate-500">
          {locale === "ro" ? "Legislatură" : "Legislature"}
          <select name="legislature" defaultValue={filters.legislature ?? ""} className="min-w-0 border border-slate-300 bg-white px-2 py-2 text-sm normal-case text-slate-900">
            <option value="">-</option>
            {data.legislatures.map((legislature) => (
              <option key={legislature.id} value={legislature.id}>
                {legislature.label}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-md bg-slate-950 px-3 py-2 text-sm text-white" type="submit">
          {locale === "ro" ? "Caută" : "Search"}
        </button>
      </form>

      <section className="mt-6 flex flex-wrap gap-2">
        <FilterLink href={memberDirectoryHref(locale, { q: filters.q, legislature: filters.legislature })} active={!filters.chamber && !activeGroupFilter}>
          Toți
        </FilterLink>
        <FilterLink href={memberDirectoryHref(locale, { chamber: "senate", q: filters.q, legislature: filters.legislature })} active={filters.chamber === "senate"}>
          {chamberLabels[locale].senate}
        </FilterLink>
        <FilterLink href={memberDirectoryHref(locale, { chamber: "deputies", q: filters.q, legislature: filters.legislature })} active={filters.chamber === "deputies"}>
          {chamberLabels[locale].deputies}
        </FilterLink>
      </section>

      <section className="mt-3 flex flex-wrap gap-2">
        {data.groups.map((group) => (
          <FilterLink key={group.id} href={memberDirectoryHref(locale, { group: group.id, q: filters.q, legislature: filters.legislature })} active={activeGroupFilter === group.id}>
            {group.shortName} · {chamberLabels[locale][group.chamber]}
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

function memberDirectoryHref(locale: AppLocale, filters: { chamber?: string; group?: string; q?: string; legislature?: string }): string {
  const params = new URLSearchParams();
  if (filters.chamber) params.set("chamber", filters.chamber);
  if (filters.group) params.set("group", filters.group);
  if (filters.q) params.set("q", filters.q);
  if (filters.legislature) params.set("legislature", filters.legislature);
  const query = params.toString();
  return `/${locale}/members${query ? `?${query}` : ""}`;
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
