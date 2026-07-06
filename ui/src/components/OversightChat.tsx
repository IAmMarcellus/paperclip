import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { oversightChatApi } from "../api/oversightChat";
import { MarkdownBody } from "./MarkdownBody";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatComposer, type ChatComposerHandle } from "./ChatComposer";
import { cn } from "../lib/utils";

/**
 * <REDACTED_ORG> oversight chat — the instance-wide sibling of the per-company Conference Room
 * (BoardChat). Talks to the agent "Mergatroid" via `/api/board/oversight/stream` (no companyId) and
 * loads its durable thread from `/api/board/oversight/messages`. Self-contained: no company context,
 * no split pane, no activity feed.
 */

const OVERSIGHT_QUERY_KEY = ["oversightChat", "messages"] as const;
const DRAFT_KEY = "paperclip.oversightChat.draft";

const MARKDOWN_CLASS =
  "max-w-full overflow-visible [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto";
const bubbleShell =
  "min-w-0 max-w-[85%] break-words px-3 py-2 text-sm overflow-x-auto overflow-y-visible";

const SUGGESTIONS: Array<{ label: string; prompt: string }> = [
  { label: "Portfolio status", prompt: "Give me a portfolio status across all companies — what needs attention first?" },
  { label: "Which companies need attention?", prompt: "Which companies have blocked tasks, pending approvals, or paused agents right now?" },
  { label: "Compare spend", prompt: "Compare this month's spend vs budget across all companies." },
];

function MergatroidHeader() {
  return (
    <div className="mb-1 flex items-center gap-1.5 pl-1">
      <Avatar size="sm" className="shrink-0">
        <AvatarFallback>
          <Building2 className="h-3.5 w-3.5" />
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium text-foreground">Mergatroid</span>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div
        className={cn(
          bubbleShell,
          "bg-card border border-border text-foreground [border-radius:14px_14px_14px_4px]",
        )}
      >
        <span className="typing-dots" aria-label="typing">
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  );
}

export function OversightChat() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: OVERSIGHT_QUERY_KEY,
    queryFn: () => oversightChatApi.list(),
  });
  const messages = data?.messages ?? [];

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [optimisticMessage, setOptimisticMessage] = useState<string | null>(null);
  const composerRef = useRef<ChatComposerHandle>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const draftLoadedRef = useRef(false);

  // Load / persist the composer draft under a single fixed (company-less) key.
  useEffect(() => {
    try {
      setInput(sessionStorage.getItem(DRAFT_KEY) ?? "");
    } catch {
      /* sessionStorage unavailable */
    }
    draftLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!draftLoadedRef.current) return;
    try {
      if (input) sessionStorage.setItem(DRAFT_KEY, input);
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* sessionStorage unavailable */
    }
  }, [input]);

  // Keep the latest turn in view as content arrives.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, streamingText, statusText, optimisticMessage]);

  // Once the server-persisted thread includes the just-sent message, drop the optimistic copy.
  useEffect(() => {
    if (!optimisticMessage) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser?.body === optimisticMessage) setOptimisticMessage(null);
  }, [messages, optimisticMessage]);

  const sendMessage = useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!trimmed || sending) return;

      setOptimisticMessage(trimmed);
      setSending(true);
      setInput("");
      setStreamingText("");
      setErrorText("");
      setStatusText("Connecting...");

      try {
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 130000);
        const res = await fetch("/api/board/oversight/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
          signal: controller.signal,
        });
        clearTimeout(fetchTimeout);

        if (!res.ok || !res.body) {
          throw new Error("Oversight chat stream not available");
        }

        setStatusText("Thinking...");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "chunk" && event.text) {
                accumulated += event.text;
                setStreamingText(accumulated);
                setStatusText("");
              } else if (event.type === "status" && event.text) {
                setStatusText(event.text);
              } else if (event.type === "error") {
                setErrorText(event.message || "Mergatroid couldn't respond. Please try again.");
                setStatusText("");
              } else if (event.type === "done") {
                queryClient.invalidateQueries({ queryKey: OVERSIGHT_QUERY_KEY });
              }
            } catch {
              /* malformed SSE line */
            }
          }
        }

        setStreamingText("");
        setStatusText("");
        queryClient.invalidateQueries({ queryKey: OVERSIGHT_QUERY_KEY });
      } catch (err) {
        console.error("Oversight chat error:", err);
        setStatusText("");
        setErrorText("Mergatroid is unavailable right now. Please try again in a moment.");
      } finally {
        setSending(false);
        composerRef.current?.focus();
      }
    },
    [sending, queryClient],
  );

  const handleSend = useCallback(() => sendMessage(input), [input, sendMessage]);

  const showWelcome = messages.length === 0 && !optimisticMessage && !sending && !streamingText;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="scrollbar-auto-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col gap-4 px-6 pt-3 pb-32">
          {showWelcome && (
            <div className="flex flex-col items-start">
              <MergatroidHeader />
              <div
                className={cn(
                  bubbleShell,
                  "bg-card border border-border text-foreground [border-radius:14px_14px_14px_4px]",
                )}
              >
                <MarkdownBody className={MARKDOWN_CLASS}>
                  {"I'm **Mergatroid**, the oversight assistant for **<REDACTED_ORG>** — I can see across every company. Ask me about the portfolio, or pick one below."}
                </MarkdownBody>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 pl-1">
                {SUGGESTIONS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => {
                      setInput(chip.prompt);
                      composerRef.current?.focus();
                    }}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className={cn(bubbleShell, "bg-blue-600 text-white [border-radius:14px_14px_4px_14px]")}>
                  {m.body}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex flex-col items-start">
                <MergatroidHeader />
                <div
                  className={cn(
                    bubbleShell,
                    "bg-card border border-border text-foreground [border-radius:14px_14px_14px_4px]",
                  )}
                >
                  <MarkdownBody className={MARKDOWN_CLASS}>{m.body}</MarkdownBody>
                </div>
              </div>
            ),
          )}

          {optimisticMessage && (
            <div className="flex justify-end">
              <div className={cn(bubbleShell, "bg-blue-600 text-white [border-radius:14px_14px_4px_14px]")}>
                {optimisticMessage}
              </div>
            </div>
          )}

          {streamingText && (
            <div className="flex flex-col items-start">
              <MergatroidHeader />
              <div
                className={cn(
                  bubbleShell,
                  "bg-card border border-border text-foreground [border-radius:14px_14px_14px_4px]",
                )}
              >
                <MarkdownBody className={MARKDOWN_CLASS}>{streamingText}</MarkdownBody>
              </div>
            </div>
          )}

          {sending && !streamingText && <TypingBubble />}

          {sending && (
            <div className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
              <img src="/paperclip-thinking.svg" alt="" className="inline-block shrink-0" style={{ width: 14, height: 14 }} />
              <span>{statusText || "Thinking..."}</span>
            </div>
          )}

          {errorText && !sending && (
            <div role="alert" className="flex justify-start">
              <div
                className={cn(
                  bubbleShell,
                  "bg-destructive/10 border border-destructive/30 text-destructive [border-radius:14px_14px_14px_4px]",
                )}
              >
                {errorText}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background via-background/95 to-background/0 px-6 pt-6 pb-5">
        <ChatComposer
          ref={composerRef}
          value={input}
          onChange={setInput}
          onSubmit={handleSend}
          placeholder="Ask Mergatroid about any company..."
          submitKey="enter"
          surface="translucent"
          submitting={sending}
          disabled={sending}
          sendLabel="Send message"
          className="pointer-events-auto"
        />
      </div>
    </div>
  );
}
