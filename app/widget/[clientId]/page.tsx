"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Props = {
  params: Promise<{
    clientId: string;
  }>;
};

type AuthState = "checking" | "allowed" | "denied";

export default function WidgetPage({ params }: Props) {
  const [clientId, setClientId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [message, setMessage] = useState("");
  const [parentOrigin, setParentOrigin] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi there 👋 How can I help you today?",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    params.then(async (value) => {
      const cId = value.clientId;
      setClientId(cId);

      // Read the parent page's true origin, passed explicitly by embed.js
      // via query param. This is more reliable than Referer headers, which
      // only report the immediate caller — see embed.js for the full
      // explanation of why this approach replaced the header-based check.
      const urlParams = new URLSearchParams(window.location.search);
      const origin = urlParams.get("parentOrigin") || "";
      setParentOrigin(origin);

      try {
        const res = await fetch(
          `/api/embed-config/${cId}?parentOrigin=${encodeURIComponent(origin)}`
        );
        const data = await res.json();
        setAuthState(data.allowed ? "allowed" : "denied");
      } catch {
        // If the check itself fails (network issue), fail open for
        // localhost dev but this should be monitored in production.
        setAuthState("allowed");
      }

      const storageKey = `fgos_conv_${cId}`;
      let storedConversationId = localStorage.getItem(storageKey);

      if (!storedConversationId) {
        storedConversationId = crypto.randomUUID();
        localStorage.setItem(storageKey, storedConversationId);
      }

      setConversationId(storedConversationId);
    });
  }, [params]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    if (!clientId || !conversationId || !message.trim() || loading) return;

    const userMessage = message.trim();
    setMessage("");
    setLoading(true);

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          conversationId,
          message: userMessage,
          parentOrigin,
        }),
      });

      const data = await response.json();

      const reply = data.reply || "Something went wrong. Please try again.";

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Connection issue. Please check your internet and try again.",
        },
      ]);
    }

    setLoading(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  if (authState === "checking") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950" />
      </div>
    );
  }

  if (authState === "denied") {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-2 bg-white p-6 text-center">
        <p className="text-sm font-medium text-slate-900">
          This chat assistant isn&apos;t available here.
        </p>
        <p className="text-xs text-slate-400">
          It hasn&apos;t been authorized for this website.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 bg-slate-950 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950">
          AI
        </div>
        <div>
          <p className="text-sm font-semibold text-white">AI Assistant</p>
          <p className="text-xs text-slate-400">Usually replies instantly</p>
        </div>
        <div className="ml-auto flex h-2 w-2 rounded-full bg-emerald-400" />
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={
              msg.role === "user" ? "ml-auto max-w-[80%]" : "mr-auto max-w-[80%]"
            }
          >
            <div
              className={
                msg.role === "user"
                  ? "rounded-2xl rounded-tr-sm bg-slate-950 px-4 py-2.5 text-sm text-white"
                  : "rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-2.5 text-sm text-slate-900"
              }
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="mr-auto max-w-[80%]">
            <div className="inline-flex items-center gap-1 rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 border-t border-slate-200 p-3">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          disabled={loading}
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !message.trim()}
          className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}