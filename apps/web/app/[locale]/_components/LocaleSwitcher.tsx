"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { AppLocale } from "@/lib/i18n";

export function LocaleSwitcher({ locale }: { locale: AppLocale }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const otherLocale = locale === "ro" ? "en" : "ro";
  const nextPathname = pathname.replace(/^\/(?:ro|en)(?=\/|$)/, `/${otherLocale}`);
  const query = searchParams.toString();
  const flag = otherLocale === "ro" ? "🇷🇴" : "🇬🇧";
  const label = otherLocale === "ro" ? "Română" : "English";

  return (
    <Link
      className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md px-2 text-xl leading-none hover:bg-slate-100"
      href={`${nextPathname}${query ? `?${query}` : ""}`}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">{flag}</span>
    </Link>
  );
}
