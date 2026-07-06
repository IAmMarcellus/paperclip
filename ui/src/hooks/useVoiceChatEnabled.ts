import { useContext } from "react";
import { QueryClient, QueryClientContext, useQuery } from "@tanstack/react-query";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Fallback client for hosts that render gated components without a QueryClientProvider (isolated unit
 * mounts). The query is disabled there, so this client never fetches — it only keeps `useQuery` from
 * throwing. Created lazily so app code never pays for it. Mirrors useConferenceRoomChatEnabled.
 */
let detachedClient: QueryClient | null = null;
function getDetachedClient(): QueryClient {
  detachedClient ??= new QueryClient();
  return detachedClient;
}

/**
 * Mergatroid voice (ElevenLabs) experimental flag — gates the <REDACTED_ORG> HQ "Call" tab. The HQ
 * surface itself is additionally gated by enableConferenceRoomChat (ConferenceRoomChatGate), so voice
 * layers on top of that. Shares the experimental-settings query with the conference-room hook.
 */
export function useVoiceChatEnabled(): { enabled: boolean; loaded: boolean } {
  const contextClient = useContext(QueryClientContext);
  const { data, isFetched } = useQuery(
    {
      queryKey: queryKeys.instance.experimentalSettings,
      queryFn: () => instanceSettingsApi.getExperimental(),
      enabled: contextClient != null,
    },
    contextClient ?? getDetachedClient(),
  );
  if (!contextClient) {
    return { enabled: false, loaded: true };
  }
  return { enabled: data?.enableVoiceChat === true, loaded: isFetched };
}
