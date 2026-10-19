"use client";

import { useCallback, useEffect, useState } from "react";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** JSON fetch against our own /api. Throws ApiError with the server's message. */
export async function api<T = unknown>(
  url: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers: opts.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, "You're offline");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

const cacheKey = (url: string) => `khaapa:cache:${url}`;

function readCache<T>(url: string): T | undefined {
  try {
    const raw = localStorage.getItem(cacheKey(url));
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Load JSON from a GET endpoint. The last good response is kept in
 * localStorage, so pages still show data (marked `stale`) while offline.
 * Pass `null` as the url to skip loading.
 */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [stale, setStale] = useState(false);

  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try {
      const fresh = await api<T>(url);
      setData(fresh);
      setError(null);
      setStale(false);
      try {
        localStorage.setItem(cacheKey(url), JSON.stringify(fresh));
      } catch {}
    } catch (e) {
      const cached = readCache<T>(url);
      if (cached !== undefined) {
        setData(cached);
        setStale(true);
      }
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (!url) return;
    const cached = readCache<T>(url);
    // Show the cached copy instantly, then refresh it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cached !== undefined) setData(cached);
    reload();
  }, [url, reload]);

  return { data, error, loading, stale, reload, setData };
}
