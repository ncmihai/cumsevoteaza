import Link from "next/link";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { isLocale, messagesFor, type AppLocale } from "@/lib/i18n";

export function generateStaticParams() {
  return [{ locale: "ro" }, { locale: "en" }];
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as AppLocale;
  const messages = messagesFor(locale);
  const otherLocale = locale === "ro" ? "en" : "ro";

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="min-h-screen">
        <header className="border-b border-slate-300 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link href={`/${locale}`} className="font-semibold tracking-normal text-slate-950">
              cumsevoteaza
            </Link>
            <nav className="flex items-center gap-1 text-sm text-slate-700">
              <Link className="rounded-md px-3 py-2 hover:bg-slate-100" href={`/${locale}/votes`}>
                {messages.nav.votes}
              </Link>
              <Link className="rounded-md px-3 py-2 hover:bg-slate-100" href={`/${locale}/bills`}>
                {messages.nav.bills}
              </Link>
              <Link className="rounded-md px-3 py-2 hover:bg-slate-100" href={`/${locale}/members`}>
                {messages.nav.members}
              </Link>
              <Link className="rounded-md px-3 py-2 hover:bg-slate-100" href={`/${otherLocale}`}>
                {otherLocale.toUpperCase()}
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
