/**
 * API view-models.
 *
 * Re-exports the canonical entity types from @paperclipai/shared and adds a few
 * lightweight shapes for endpoints whose responses are projections/lean trees.
 * (Note: over the wire, Date fields arrive as ISO strings — we treat them as
 * display strings.)
 */
export type {
  Agent,
  AgentDetail,
  AgentWakeupResponse,
  HeartbeatRun,
  HeartbeatRunEvent,
  Issue,
  IssueComment,
  IssueLabel,
  CostSummary,
  Project,
  Goal,
  Routine,
  RoutineDetail,
  RoutineRun,
  SidebarBadges,
  ExecutionWorkspace,
  CurrentUserProfile,
} from "@paperclipai/shared";

export interface Company {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface AuthSession {
  session: { id: string; userId: string };
  user: {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
  };
}

/** Projection returned by /companies/:id/live-runs. */
export interface LiveRun {
  id: string;
  status: string;
  agentId: string;
  agentName: string | null;
  adapterType: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string | null;
  logBytes: number | null;
}

/** Lean org node from /companies/:id/org (recursive). */
export interface OrgNode {
  id: string;
  name: string;
  role?: string | null;
  title?: string | null;
  status?: string | null;
  children?: OrgNode[];
  [key: string]: unknown;
}

/** Activity row — fields vary; we read defensively in the UI. */
export interface ActivityEntry {
  id: string;
  createdAt?: string;
  agentId?: string | null;
  agentName?: string | null;
  type?: string | null;
  kind?: string | null;
  action?: string | null;
  message?: string | null;
  summary?: string | null;
  title?: string | null;
  [key: string]: unknown;
}

/** Approval row — fields vary; read defensively. */
export interface Approval {
  id: string;
  status: string;
  agentId?: string | null;
  agentName?: string | null;
  title?: string | null;
  summary?: string | null;
  priority?: string | null;
  createdAt?: string;
  [key: string]: unknown;
}

export interface RunLog {
  text: string;
  offset: number;
  totalBytes: number;
}

/** Comment on an approval or similar thread — read defensively. */
export interface ThreadComment {
  id: string;
  body: string;
  authorType?: string | null;
  authorAgentId?: string | null;
  authorUserId?: string | null;
  authorName?: string | null;
  createdAt?: string;
  [key: string]: unknown;
}

/** Artifact row from /companies/:id/artifacts — fields vary. */
export interface Artifact {
  id: string;
  kind?: string | null;
  title?: string | null;
  name?: string | null;
  url?: string | null;
  thumbnailUrl?: string | null;
  createdAt?: string;
  issueId?: string | null;
  [key: string]: unknown;
}

/** Adapter descriptor from GET /adapters. */
export interface AdapterInfo {
  type: string;
  label: string;
  source?: string;
  disabled?: boolean;
  loaded?: boolean;
  [key: string]: unknown;
}

/** A single global-search hit — fields vary by entity type. */
export interface SearchHit {
  id: string;
  type?: string | null;
  kind?: string | null;
  title?: string | null;
  snippet?: string | null;
  [key: string]: unknown;
}

/** Which stack serves the HQ voice call — mirrors the server's VOICE_PROVIDER env. */
export type VoiceProvider = "elevenlabs" | "pipecat";

/** Self-hosted pipecat call setup: SDP signaling path the SmallWebRTC transport POSTs offers to. */
export interface PipecatVoiceToken {
  provider: "pipecat";
  offerPath: string;
}

/** Legacy ElevenLabs setup (this build can't use it — surfaced only to explain the mismatch). */
export interface ElevenLabsVoiceToken {
  provider: "elevenlabs";
  conversationToken: string;
  agentId: string;
}

export type OversightVoiceToken = PipecatVoiceToken | ElevenLabsVoiceToken;
