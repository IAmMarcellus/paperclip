/**
 * Typed fetch client for the Paperclip REST API.
 *
 * Reads baseUrl/token from the module-level apiConfig (lib/config.ts). All paths
 * are relative to `${baseUrl}/api`. Throws ApiError on non-2xx.
 */
import { apiConfig } from "@/lib/config";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** Query params (undefined/null values are dropped). */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Override base URL (used by the Connect screen to test a server). */
  baseUrl?: string;
  /** Override token (Connect screen). */
  token?: string | null;
  /** Request timeout in ms. Default 15000. */
  timeoutMs?: number;
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const base = opts.baseUrl ?? apiConfig.baseUrl;
  const token = opts.token !== undefined ? opts.token : apiConfig.token;
  const url = buildUrl(base, path, opts.query);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: {
        accept: "application/json",
        ...(opts.body ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (controller.signal.aborted) throw new ApiError(0, "Request timed out");
    throw new ApiError(0, `Network error: ${(err as Error).message}`);
  }
  clearTimeout(timeout);

  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : null) || `Request failed (${res.status})`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

function buildUrl(
  base: string,
  path: string,
  query?: RequestOptions["query"],
): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  let url = `${base}/api${p}`;
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    if (qs) url += `?${qs}`;
  }
  return url;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
