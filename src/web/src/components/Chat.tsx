"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { FaCommentAlt, FaTimes, FaPaperPlane, FaRobot } from "react-icons/fa";

const uuid = () =>
  typeof globalThis !== "undefined" &&
  typeof globalThis.crypto !== "undefined" &&
  typeof globalThis.crypto.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// Basic message shape
export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "error";
  content: string;
  createdAt: number;
};

interface ChatProps {
  systemPrompt?: string;
  defaultOpen?: boolean;
}

const defaultSystem =
  "You are a helpful AI travel assistant for Contoso Air. Provide concise, friendly answers and suggest follow‑up travel tips. Do not reply in markdown. Reply in unformatted plain text.";

const Chat: React.FC<ChatProps> = ({
  systemPrompt = defaultSystem,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: uuid(),
      role: "system",
      content: systemPrompt,
      createdAt: Date.now(),
    },
    {
      id: uuid(),
      role: "assistant",
      content:
        "Hi! I'm your travel assistant. Ask me about destinations, best times to fly, or current deals.",
      createdAt: Date.now() + 1,
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [thinkingId, setThinkingId] = useState<string | null>(null);
  const thinkingRef = useRef<string | null>(null);
  useEffect(() => {
    thinkingRef.current = thinkingId;
  }, [thinkingId]);

  // Animate placeholder "Thinking" with cycling dots until first token arrives or cleared.
  useEffect(() => {
    if (!thinkingId) return;
    let dotCount = 0;
    const interval = setInterval(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId && m.content.startsWith("Thinking")
            ? { ...m, content: "Thinking" + ".".repeat(dotCount) }
            : m
        )
      );
      dotCount = (dotCount + 1) % 4; // 0,1,2,3 dots cycling (3 -> resets to none)
    }, 450);
    return () => clearInterval(interval);
  }, [thinkingId, setMessages]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Stream chat response from server. Provider selection is handled server-side via CHAT_PROVIDER env.
  async function streamChat(
    history: ChatMessage[],
    onDelta: (t: string) => void
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    };
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      let detail = "";
      try {
        const txt = await resp.text();
        try {
          const parsed = JSON.parse(txt);
          detail = parsed.error || txt;
        } catch {
          detail = txt || `HTTP ${resp.status}`;
        }
      } catch {
        /* ignore */
      }
      throw new Error(detail ? `stream failed: ${detail}` : "stream failed");
    }
    if (!resp.body) throw new Error("no response body");
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let full = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split(/\r?\n\r?\n/);
      buf = parts.pop() || "";
      for (const evt of parts) {
        const payload = evt
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => {
            let data = line.slice(5); // remove 'data:' prefix
            if (data.startsWith(" ")) data = data.slice(1);
            return data;
          })
          .join("\n");
        if (!payload) continue;
        const parsed = JSON.parse(payload) as {
          type?: "token" | "done" | "error";
          value?: string;
          message?: string;
        };
        if (parsed.type === "done") return full;
        if (parsed.type === "error") {
          throw new Error(parsed.message || "remote error");
        }
        if (parsed.type === "token" && parsed.value) {
          full += parsed.value;
          onDelta(parsed.value);
        }
      }
    }
    return full;
  }

  const cleanupAssistantText = (text: string) =>
    text
      .replace(/([a-z0-9,])([A-Z])/g, "$1 $2")
      .replace(/\n{2,}(?=\s*(?:[-*•]|\d+[.)])\s)/g, "\n")
      .replace(
        /(\n\s*(?:[-*•]|\d+[.)])\s[^\n]+)\n\n(?=\s*(?:[-*•]|\d+[.)])\s)/g,
        "$1\n"
      )
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || pending) return;
    setInput("");
    setPending(true);

    const userMsg: ChatMessage = {
      id: uuid(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);

    try {
      // Create a placeholder assistant bubble that will show the thinking state
      const assistantId = uuid();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "Thinking", // animation hook will append dots
          createdAt: Date.now(),
        },
      ]);
      setThinkingId(assistantId);

      try {
        let firstToken = true;
        const finalText = await streamChat(newHistory, (delta) => {
          if (firstToken) {
            firstToken = false;
            // stop animation before showing first token
            setThinkingId(null);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: delta } : m
              )
            );
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + delta } : m
              )
            );
          }
          // incremental scroll during streaming
          if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
          }
        });
        const cleaned = cleanupAssistantText(finalText);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: cleaned || m.content } : m
          )
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Streaming failed";
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== assistantId),
          {
            id: uuid(),
            role: "error",
            content: msg
              ? `Sorry, streaming failed: ${msg}`
              : "Sorry, streaming failed.",
            createdAt: Date.now(),
          },
        ]);
        setThinkingId(null);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uuid(),
          role: "error",
          content: "Sorry, something went wrong.",
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setPending(false);
      setThinkingId(null);
      inputRef.current?.focus();
    }
  }, [input, pending, messages]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Listen for external open requests
  useEffect(() => {
    const handleExternalOpen = () => setOpen(true);
    window.addEventListener(
      "contoso-chat-open",
      handleExternalOpen as EventListener
    );
    return () => {
      window.removeEventListener(
        "contoso-chat-open",
        handleExternalOpen as EventListener
      );
    };
  }, []);

  // Focus input when panel becomes open
  useEffect(() => {
    if (open) {
      // slight delay to allow panel animation / mount
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [open]);

  const resetMessages = useCallback(() => {
    setMessages([
      {
        id: uuid(),
        role: "system",
        content: systemPrompt,
        createdAt: Date.now(),
      },
      {
        id: uuid(),
        role: "assistant",
        content:
          "Hi! I'm your travel assistant. Ask me about destinations, best times to fly, or current deals.",
        createdAt: Date.now() + 1,
      },
    ]);
    setPending(false);
    setInput("");
  }, [systemPrompt]);

  return (
    <div className="fixed z-50 bottom-4 right-4 flex flex-col items-end gap-2">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="contoso-chat-panel"
          className="group relative inline-flex items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-indigo-600 p-[2px] shadow-lg focus:outline-none focus:ring-2 focus:ring-cyan-400"
        >
          <span className="absolute inset-0 rounded-full bg-black/30 opacity-0 transition-opacity group-hover:opacity-30" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#0d1d35] text-cyan-100">
            <FaCommentAlt
              className="h-7 w-7 text-cyan-300 drop-shadow-sm"
              aria-hidden="true"
            />
          </span>
          <span className="sr-only">Open chat</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          id="contoso-chat-panel"
          className="w-[min(380px,90vw)] h-[72vh] sm:h-[78vh] max-h-[840px] min-h-[600px] rounded-xl border border-white/10 bg-[#091324]/95 backdrop-blur-xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2"
          role="dialog"
          aria-label="Travel assistant chat"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-white/5">
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide text-white">
                Travel Assistant
              </span>
              <span className="text-[11px] text-white/60">
                AI beta · Experimental
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                resetMessages();
                setOpen(false);
              }}
              className="rounded p-1.5 text-white/60 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              aria-label="Close chat"
            >
              <FaTimes className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {/* Messages */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-sm text-white/90"
            aria-live="polite"
            aria-busy={pending}
          >
            {messages
              .filter((m) => m.role !== "system")
              .map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
          </div>
          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="border-t border-white/10 bg-[#0b172c]/90 backdrop-blur px-3 pt-2 pb-3 flex flex-col gap-2"
          >
            <div className="relative">
              {/* Unified input + send button container for cohesive alignment */}
              <div className="flex items-stretch w-full rounded-md bg-white/5 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-cyan-500 overflow-hidden shadow-sm">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask e.g. Cheapest month for Paris?"
                  rows={1}
                  className="flex-1 max-h-40 resize-none bg-transparent px-3 py-2 text-sm leading-relaxed text-white placeholder:text-white/40 outline-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || pending}
                  className="flex items-center justify-center px-3 md:px-4 bg-gradient-to-br from-cyan-500 to-indigo-600 text-white text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  aria-label="Send message"
                >
                  <FaPaperPlane className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-0.5">
              <p className="text-[10px] text-white/40">
                Shift+Enter = new line · Experimental answers may be inaccurate
              </p>
              {pending && (
                <span className="text-[10px] text-cyan-400 animate-pulse">
                  Generating…
                </span>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const base =
    "max-w-[85%] rounded-lg px-3 py-2 whitespace-pre-wrap break-words";
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className={`${base} bg-cyan-600/90 text-white shadow-sm`}>
          {message.content}
        </div>
      </div>
    );
  }
  if (message.role === "assistant") {
    return (
      <div className="flex items-start gap-2">
        <Avatar />
        <div
          className={`${base} bg-white/5 text-white/90 ring-1 ring-white/10`}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
            components={{
              code(nodeProps) {
                const { children, className } = nodeProps as unknown as {
                  children: React.ReactNode;
                  className?: string;
                };
                const isInline =
                  !/\n/.test(String(children)) &&
                  !/language-/.test(className || "");
                if (isInline) {
                  return (
                    <code className="px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-200 text-[0.75rem]">
                      {children}
                    </code>
                  );
                }
                return (
                  <pre className="my-2 overflow-x-auto rounded bg-[#0f233d] p-2 text-[11px] leading-relaxed">
                    <code className={className}>{children}</code>
                  </pre>
                );
              },
              p(nodeProps) {
                const { children, node } = nodeProps as unknown as {
                  children: React.ReactNode;
                  node?: { parent?: { tagName?: string } };
                };
                const inListItem = node?.parent?.tagName === "li";
                return (
                  <p
                    className={
                      inListItem
                        ? "m-0 leading-snug"
                        : "mb-2 last:mb-0 leading-relaxed"
                    }
                  >
                    {children}
                  </p>
                );
              },
              ul({ children }) {
                return (
                  <ul className="list-disc pl-5 mb-1 mt-0 space-y-0 marker:text-cyan-300">
                    {children}
                  </ul>
                );
              },
              ol({ children }) {
                return (
                  <ol className="list-decimal pl-5 mb-1 mt-0 space-y-0 marker:text-cyan-300">
                    {children}
                  </ol>
                );
              },
              li({ children }) {
                return <li className="m-0 leading-snug [&>p]:m-0">{children}</li>;
              },
              a({ children, href }) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-300 underline decoration-dotted underline-offset-2 hover:text-cyan-200"
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    );
  }
  if (message.role === "error") {
    return (
      <div className="flex items-start gap-2">
        <Avatar variant="error" />
        <div
          className={`${base} bg-rose-600/15 text-rose-200 ring-1 ring-rose-500/40`}
        >
          {message.content}
        </div>
      </div>
    );
  }
  // System messages hidden earlier; fallback
  return null;
};

const Avatar: React.FC<{ variant?: "default" | "error" }> = ({
  variant = "default",
}) => {
  const styles =
    variant === "error"
      ? "bg-rose-600/30 text-rose-200 ring-1 ring-rose-500/50"
      : "bg-gradient-to-br from-cyan-500 to-indigo-600 text-white";
  return (
    <div
      className={`h-8 w-8 aspect-square grid place-items-center rounded-full shrink-0 pointer-events-none ${styles}`}
    >
      <FaRobot className="h-5 w-5" aria-hidden="true" />
      <span className="sr-only">AI Assistant</span>
    </div>
  );
};

export default Chat;
