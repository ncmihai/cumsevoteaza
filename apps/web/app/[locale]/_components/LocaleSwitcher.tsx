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

  return (
    <Link className="rounded-md px-3 py-2 hover:bg-slate-100" href={`${nextPathname}${query ? `?${query}` : ""}`}>
      {otherLocale.toUpperCase()}
    </Link>
  );
}
