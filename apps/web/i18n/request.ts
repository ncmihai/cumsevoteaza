import { getRequestConfig } from "next-intl/server";
import { isLocale, messagesFor } from "../lib/i18n";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : "ro";

  return {
    locale,
    messages: messagesFor(locale)
  };
});
