/**
 * Single source for the backend base URL
 * (already present in .env.local as NEXT_PUBLIC_API_BASE_URL)
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

/**
 * Helper: GET with cookie credentials and graceful null-on-fail.
 */
export async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

