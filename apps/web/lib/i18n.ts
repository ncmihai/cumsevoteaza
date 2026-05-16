import en from "../messages/en.json";
import ro from "../messages/ro.json";
import type { Locale } from "@cumsevoteaza/parliament-model";

export const locales = ["ro", "en"] as const;
export type AppLocale = Locale;

export function isLocale(value: string): value is AppLocale {
  return locales.includes(value as AppLocale);
}

export function messagesFor(locale: AppLocale) {
  return locale === "en" ? en : ro;
}
