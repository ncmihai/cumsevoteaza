export function canonicalizeOfficialUrl(url: string): string {
  if (/^https?:\/\/(?:www\.)?cdep\.ro\/pls\/steno\/evot2015\./i.test(url)) {
    return url
      .replace(/^http:\/\/(?:www\.)?cdep\.ro\/pls\/steno\//i, "https://www.cdep.ro/ords/pls/steno/")
      .replace(/^https:\/\/(?:www\.)?cdep\.ro\/pls\/steno\//i, "https://www.cdep.ro/ords/pls/steno/");
  }
  return url;
}

export function fetchCandidateUrls(url: string): string[] {
  const canonical = canonicalizeOfficialUrl(url);
  return canonical === url ? [url] : [canonical, url];
}
