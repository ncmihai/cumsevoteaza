type DigiAuthState = {
  token: string;
  mountId: string;
};

let cachedAuth: Promise<DigiAuthState> | undefined;

export async function getDigiStorageDownloadLink(storagePath: string): Promise<string> {
  const { apiUrl } = digiConfig();
  const { token, mountId } = await getDigiAuth();
  const response = await digiFetch(
    apiUrl,
    token,
    `/mounts/${encodeURIComponent(mountId)}/files/download?path=${encodeURIComponent(storagePath)}`
  );
  const json = await readJsonResponse<{ link?: string }>(response, `Digi Storage download-link lookup failed for ${storagePath}`);
  if (!json.link) throw new Error(`Digi Storage did not return a download link for ${storagePath}.`);
  return json.link;
}

async function getDigiAuth(): Promise<DigiAuthState> {
  cachedAuth ??= resolveDigiAuth();
  return cachedAuth;
}

async function resolveDigiAuth(): Promise<DigiAuthState> {
  const { email, password, baseUrl, apiUrl, mountId: configuredMountId } = digiConfig();
  const authResponse = await fetch(`${baseUrl}/token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });
  const authJson = await readJsonResponse<{ token?: string }>(authResponse, "Digi Storage auth failed");
  if (!authJson.token) throw new Error("Digi Storage auth did not return a token.");
  const token = authJson.token;
  const mountId = configuredMountId || await getPrimaryMountId(apiUrl, token);
  return { token, mountId };
}

async function getPrimaryMountId(apiUrl: string, token: string): Promise<string> {
  const response = await digiFetch(apiUrl, token, "/mounts?type=device");
  const json = await readJsonResponse<{ mounts?: Array<{ id?: string }> }>(response, "Digi Storage mount lookup failed");
  const mountId = json.mounts?.find((mount) => Boolean(mount.id))?.id;
  if (!mountId) throw new Error("Digi Storage account has no device mount. Set DIGI_STORAGE_MOUNT_ID explicitly.");
  return mountId;
}

function digiConfig() {
  const baseUrl = (process.env.DIGI_STORAGE_BASE_URL || "https://storage.rcs-rds.ro").replace(/\/+$/, "");
  return {
    email: firstEnv(["DIGI_STORAGE_EMAIL", "DIGI_EMAIL", "ASSET_FTP_USERNAME"]),
    password: firstEnv(["DIGI_STORAGE_PASSWORD", "DIGI_PASSWORD", "ASSET_FTP_PASSWORD"]),
    baseUrl,
    apiUrl: (process.env.DIGI_STORAGE_API_URL || `${baseUrl}/api/v2.1`).replace(/\/+$/, ""),
    mountId: process.env.DIGI_STORAGE_MOUNT_ID?.trim()
  };
}

function firstEnv(names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`${names.join(" or ")} is required for Digi Storage assets.`);
}

function digiFetch(apiUrl: string, token: string, pathAndQuery: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("accept", "application/json");
  headers.set("authorization", `Token token="${token}"`);
  return fetch(`${apiUrl}${pathAndQuery}`, {
    ...init,
    headers
  });
}

async function readJsonResponse<T>(response: Response, message: string): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${message} with HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}
