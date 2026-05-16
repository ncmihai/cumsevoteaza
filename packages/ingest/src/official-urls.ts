export function canonicalizeOfficialUrl(url: string): string {
  let canonical = /^https?:\/\/(?:www\.)?cdep\.ro\/pls\/steno\/evot2015\./i.test(url)
    ? url
      .replace(/^http:\/\/(?:www\.)?cdep\.ro\/pls\/steno\//i, "https://www.cdep.ro/ords/pls/steno/")
      .replace(/^https:\/\/(?:www\.)?cdep\.ro\/pls\/steno\//i, "https://www.cdep.ro/ords/pls/steno/")
    : url;

  canonical = canonical.replace(
    /^https:\/\/(?:www\.)?cdep\.ro\/ords\/pls\/steno\/evot2015\.nominal/i,
    "https://www.cdep.ro/ords/pls/steno/evot2015.Nominal"
  );

  return stripHashAndSortParams(canonical);
}

export function fetchCandidateUrls(url: string): string[] {
  const canonical = canonicalizeOfficialUrl(url);
  return canonical === url ? [url] : [canonical, url];
}

function stripHashAndSortParams(value: string): string {
  const parsed = new URL(value);
  parsed.hash = "";
  if (/cdep\.ro$/i.test(parsed.hostname) && /\/ords\/pls\/steno\/evot2015\.Nominal$/i.test(parsed.pathname)) {
    parsed.searchParams.delete("idl");
  }
  const sortedParams = [...parsed.searchParams.entries()].sort(([keyA, valueA], [keyB, valueB]) => {
    const keyOrder = keyA.localeCompare(keyB);
    return keyOrder === 0 ? valueA.localeCompare(valueB) : keyOrder;
  });
  parsed.search = "";
  for (const [key, paramValue] of sortedParams) {
    parsed.searchParams.append(key, paramValue);
  }
  return parsed.toString();
}
