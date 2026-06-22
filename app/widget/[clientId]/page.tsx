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

// Safe storage: tries localStorage first, falls back to sessionStorage,
// then falls back to in-memory. Covers Safari private mode and any
// browser that blocks storage APIs entirely.
const memoryStore: Record<string, string> = {};

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return memoryStore[key] || null;
    }
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      memoryStore[key] = value;
    }
  }
}

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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    params.then(async (value) => {
      const cId = value.clientId;
      setClientId(cId);

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
        setAuthState("allowed");
      }

      const storageKey = `fgos_conv_${cId}`;
      let storedConversationId = storageGet(storageKey);

      if (!storedConversationId) {
        storedConversationId = crypto.randomUUID();
        storageSet(storageKey, storedConversationId);
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

    // Re-focus input after sending — important on mobile so keyboard
    // stays up and user doesn't have to tap the input again
    setTimeout(() => inputRef.current?.focus(), 100);

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
    // Use dvh (dynamic viewport height) instead of h-screen —
    // on mobile, h-screen doesn't account for the browser chrome
    // (address bar, bottom nav). dvh updates dynamically so the
    // widget never gets cut off or hidden behind the keyboard.
    <div className="flex w-screen flex-col overflow-hidden bg-white" 
         style={{ height: '100dvh' }}>
      
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 bg-slate-950 px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950">
          AI
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">AI Assistant</p>
          <p className="text-xs text-slate-400">Usually replies instantly</p>
        </div>
        <div className="ml-auto flex h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
      </div>

      {/* Messages — flex-1 takes remaining height, overflow scrolls */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4 pb-2">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={
              msg.role === "user" ? "ml-auto max-w-[85%]" : "mr-auto max-w-[85%]"
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
          <div className="mr-auto max-w-[85%]">
            <div className="inline-flex items-center gap-1 rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input — shrink-0 keeps it pinned at bottom, never pushed off screen */}
      <div className="shrink-0 flex gap-2 border-t border-slate-200 bg-white p-3">
        <input
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          disabled={loading}
          // font-size 16px prevents iOS Safari from auto-zooming on focus
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 disabled:opacity-50"
          style={{ fontSize: '16px' }}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !message.trim()}
          className="shrink-0 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}