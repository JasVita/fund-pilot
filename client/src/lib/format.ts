export const fmt = (v: unknown) =>
  v == null || v === "" ? "—" : Number(v).toLocaleString(undefined, {
    minimumFractionDigits : 2,
    maximumFractionDigits : 2,
  });

export const fetchJson = async <T = any>(url: string, init?: RequestInit): Promise<T> => {
  const r = await fetch(url, { credentials: "include", ...init });
  try {
    return (await r.json()) as T;
  } catch {
    // non-JSON response ⇒ return empty object so the caller gets []
    console.error(`[fetchJson] ${url} returned non-JSON`, r.status);
    return {} as T;
  }
};