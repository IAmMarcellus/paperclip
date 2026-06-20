/**
 * Connection config persisted in expo-secure-store, plus a module-level holder
 * the API client reads on every request (so we don't thread baseUrl/token
 * through every call). The ConnectionProvider (lib/connection.tsx) owns the
 * React state and keeps this holder + secure store in sync.
 */
import * as SecureStore from "expo-secure-store";

const KEYS = {
  baseUrl: "paperclip.baseUrl",
  token: "paperclip.token",
  companyId: "paperclip.companyId",
} as const;

export const DEFAULT_BASE_URL = "http://localhost:3100";

export interface ApiConfig {
  baseUrl: string;
  token: string | null;
  companyId: string | null;
}

/** Live config the API client reads. Mutated by ConnectionProvider. */
export const apiConfig: ApiConfig = {
  baseUrl: DEFAULT_BASE_URL,
  token: null,
  companyId: null,
};

export async function loadStoredConfig(): Promise<ApiConfig> {
  const [baseUrl, token, companyId] = await Promise.all([
    SecureStore.getItemAsync(KEYS.baseUrl),
    SecureStore.getItemAsync(KEYS.token),
    SecureStore.getItemAsync(KEYS.companyId),
  ]);
  const cfg: ApiConfig = {
    baseUrl: baseUrl || DEFAULT_BASE_URL,
    token: token || null,
    companyId: companyId || null,
  };
  Object.assign(apiConfig, cfg);
  return cfg;
}

export async function persistConfig(partial: Partial<ApiConfig>): Promise<void> {
  Object.assign(apiConfig, partial);
  const ops: Promise<unknown>[] = [];
  if (partial.baseUrl !== undefined)
    ops.push(SecureStore.setItemAsync(KEYS.baseUrl, partial.baseUrl));
  if (partial.token !== undefined)
    ops.push(
      partial.token
        ? SecureStore.setItemAsync(KEYS.token, partial.token)
        : SecureStore.deleteItemAsync(KEYS.token),
    );
  if (partial.companyId !== undefined)
    ops.push(
      partial.companyId
        ? SecureStore.setItemAsync(KEYS.companyId, partial.companyId)
        : SecureStore.deleteItemAsync(KEYS.companyId),
    );
  await Promise.all(ops);
}

export async function clearStoredConfig(): Promise<void> {
  apiConfig.token = null;
  apiConfig.companyId = null;
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.token),
    SecureStore.deleteItemAsync(KEYS.companyId),
  ]);
}

/** Normalize a user-entered URL (trim, strip trailing slash, default scheme). */
export function normalizeBaseUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
}
