/**
 * ConnectionProvider — owns the connection state (baseUrl, token, companyId,
 * user) and keeps lib/config.ts's apiConfig holder + secure store in sync.
 *
 * On mount it hydrates from secure store. `connect()` validates a server by
 * listing companies, then persists. The app gates on `isConfigured`.
 */
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api } from "@/lib/api";
import type { AuthSession, Company } from "@/lib/api/types";
import {
  clearStoredConfig,
  DEFAULT_BASE_URL,
  loadStoredConfig,
  normalizeBaseUrl,
  persistConfig,
} from "@/lib/config";

interface ConnectionState {
  hydrated: boolean;
  isConfigured: boolean;
  baseUrl: string;
  token: string | null;
  companyId: string | null;
  user: AuthSession["user"] | null;
}

interface ConnectionContextValue extends ConnectionState {
  /** Validate + persist a server connection. Returns the resolved companies. */
  connect: (input: { baseUrl: string; token?: string | null }) => Promise<Company[]>;
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
    token: null,
    companyId: null,
    user: null,
  });

  useEffect(() => {
    loadStoredConfig().then((cfg) => {
      setState((s) => ({
        ...s,
        hydrated: true,
        isConfigured: !!cfg.companyId,
        baseUrl: cfg.baseUrl,
        token: cfg.token,
        companyId: cfg.companyId,
      }));
    });
  }, []);

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
    }));
    qc.clear();
    return companies;
  }, [qc]);

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
    () => ({ ...state, connect, setCompanyId, disconnect }),
    [state, connect, setCompanyId, disconnect],
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
