/**
 * ConnectionProvider — owns the connection state (baseUrl, token, companyId,
 * user) and keeps lib/config.ts's apiConfig holder + secure store in sync.
 *
 * On mount it hydrates from secure store, then auto-connects to the
 * env-configured backend (DEFAULT_BASE_URL/DEFAULT_TOKEN) — there is no in-app
 * Connect screen. `connect()` validates a server by listing companies, then
 * persists. The app gates on `isConfigured`; `connectError` + `retry` surface a
 * failed auto-connect.
 */
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { api, ApiError } from "@/lib/api";
import type { AuthSession, Company } from "@/lib/api/types";
import {
  apiConfig,
  clearStoredConfig,
  DEFAULT_BASE_URL,
  DEFAULT_TOKEN,
  loadStoredConfig,
  normalizeBaseUrl,
  persistConfig,
} from "@/lib/config";

/** Turn a connect() failure into a message for the entry gate. */
function describeConnectError(err: unknown, baseUrl: string): string {
  if (err instanceof ApiError) {
    return err.status === 0
      ? `Could not reach ${baseUrl}. Check the address and that Paperclip is running.`
      : `Server responded ${err.status}: ${err.message}`;
  }
  return (err as Error).message;
}

interface ConnectionState {
  hydrated: boolean;
  isConfigured: boolean;
  baseUrl: string;
  token: string | null;
  companyId: string | null;
  user: AuthSession["user"] | null;
  /** Set when the launch auto-connect fails; cleared on a successful connect. */
  connectError: string | null;
}

interface ConnectionContextValue extends ConnectionState {
  /** Validate + persist a server connection. Returns the resolved companies. */
  connect: (input: { baseUrl: string; token?: string | null }) => Promise<Company[]>;
  /** Re-run the auto-connect to the env-configured backend (clears connectError). */
  retry: () => Promise<void>;
  setCompanyId: (companyId: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<ConnectionState>({
    hydrated: false,
    isConfigured: false,
    baseUrl: DEFAULT_BASE_URL,
    token: DEFAULT_TOKEN,
    companyId: null,
    user: null,
    connectError: null,
  });

  const connect = useCallback<ConnectionContextValue["connect"]>(async (input) => {
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    const token = input.token?.trim() || null;
    // Probe the server with the candidate creds before persisting.
    const companies = await api.listCompanies({ baseUrl, token });
    let user: AuthSession["user"] | null = null;
    try {
      user = (await api.getSession({ baseUrl, token })).user;
    } catch {
      // get-session requires board auth; ignore in local_trusted mode.
    }
    const companyId = companies[0]?.id ?? null;
    await persistConfig({ baseUrl, token, companyId });
    setState((s) => ({
      ...s,
      isConfigured: !!companyId,
      baseUrl,
      token,
      companyId,
      user,
      connectError: companyId ? null : s.connectError,
    }));
    qc.clear();
    return companies;
  }, [qc]);

  // One auto-connect attempt to `baseUrl`, recording a friendly error on failure
  // (unreachable server, or reachable but no companies).
  const attempt = useCallback(async (baseUrl: string, token: string | null) => {
    try {
      const companies = await connect({ baseUrl, token });
      if (companies.length === 0) {
        setState((s) => ({
          ...s,
          connectError: `Connected to ${baseUrl}, but no companies were found on this server.`,
        }));
      }
    } catch (err) {
      setState((s) => ({ ...s, connectError: describeConnectError(err, baseUrl) }));
    }
  }, [connect]);

  // First launch: hydrate, then auto-connect to the env-configured backend. A stored companyId
  // from a prior launch short-circuits straight to the app. Ref-guarded against StrictMode's
  // double mount so we never fire two concurrent connects.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      const cfg = await loadStoredConfig();
      setState((s) => ({
        ...s,
        hydrated: true,
        isConfigured: !!cfg.companyId,
        baseUrl: cfg.baseUrl,
        token: cfg.token,
        companyId: cfg.companyId,
      }));
      if (!cfg.companyId) await attempt(cfg.baseUrl, cfg.token);
    })();
  }, [attempt]);

  const retry = useCallback<ConnectionContextValue["retry"]>(async () => {
    setState((s) => ({ ...s, connectError: null }));
    await attempt(apiConfig.baseUrl, apiConfig.token);
  }, [attempt]);

  const setCompanyId = useCallback<ConnectionContextValue["setCompanyId"]>(async (companyId) => {
    await persistConfig({ companyId });
    setState((s) => ({ ...s, companyId, isConfigured: true }));
    qc.clear();
  }, [qc]);

  const disconnect = useCallback<ConnectionContextValue["disconnect"]>(async () => {
    await clearStoredConfig();
    setState((s) => ({ ...s, isConfigured: false, token: null, companyId: null, user: null }));
    qc.clear();
  }, [qc]);

  const value = useMemo<ConnectionContextValue>(
    () => ({ ...state, connect, retry, setCompanyId, disconnect }),
    [state, connect, retry, setCompanyId, disconnect],
  );

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error("useConnection must be used within ConnectionProvider");
  return ctx;
}

/** Convenience: the active companyId (throws if not connected). */
export function useCompanyId(): string {
  const { companyId } = useConnection();
  if (!companyId) throw new Error("No company selected");
  return companyId;
}
