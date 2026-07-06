import { api } from "./client";

export interface OversightChatMessage {
  id: string;
  role: "user" | "assistant" | string;
  body: string;
  actorId: string | null;
  createdAt: string;
}

export const oversightChatApi = {
  // The durable <REDACTED_ORG> oversight thread (Mergatroid), oldest-first.
  list: () => api.get<{ messages: OversightChatMessage[] }>("/board/oversight/messages"),
};
