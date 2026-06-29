"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Conversation } from "@elevenlabs/client";

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
type Mode = "chat" | "voice";
type VoiceStatus = "idle" | "connecting" | "connected" | "error";

const memoryStore: Record<string, string> = {};

function storageGet(key: string): string | null {
  try { return localStorage.getItem(key); }
  catch { try { return sessionStorage.getItem(key); } catch { return memoryStore[key] || null; } }
}

function storageSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); }
  catch { try { sessionStorage.setItem(key, value); } catch { memoryStore[key] = value; } }
}

export default function WidgetPage({ params }: Props) {
  const [clientId, setClientId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [message, setMessage] = useState("");
  const [parentOrigin, setParentOrigin] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi there 👋 How can I help you today?" },
  ]);
  const [loading, setLoading] = useState(false);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [mode, setMode] = useState<Mode>("chat");
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const conversationRef = useRef<Awaited<ReturnType<typeof Conversation.startSession>> | null>(null);

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
      let storedId = storageGet(storageKey);
      if (!storedId) {
        storedId = crypto.randomUUID();
        storageSet(storageKey, storedId);
      }
      setConversationId(storedId);
    });
  }, [params]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Clean up voice session on unmount
  useEffect(() => {
    return () => {
      if (conversationRef.current) {
        conversationRef.current.endSession();
      }
    };
  }, []);

  async function sendMessage() {
    if (!clientId || !conversationId || !message.trim() || loading) return;

    const userMessage = message.trim();
    setMessage("");
    setLoading(true);
    setTimeout(() => inputRef.current?.focus(), 100);
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, conversationId, message: userMessage, parentOrigin }),
      });
      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "Something went wrong." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection issue. Please try again." }]);
    }

    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const startVoiceSession = useCallback(async () => {
    const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
    if (!agentId) {
      setVoiceStatus("error");
      return;
    }

    setVoiceStatus("connecting");

    try {
      const conversation = await Conversation.startSession({
        agentId,
        onConnect: () => setVoiceStatus("connected"),
        onDisconnect: () => {
          setVoiceStatus("idle");
          setIsSpeaking(false);
          conversationRef.current = null;
        },
        onError: () => setVoiceStatus("error"),
        onModeChange: (mode) => setIsSpeaking(mode.mode === "speaking"),
      });

      conversationRef.current = conversation;
    } catch {
      setVoiceStatus("error");
    }
  }, []);

  async function endVoiceSession() {
    if (conversationRef.current) {
      await conversationRef.current.endSession();
      conversationRef.current = null;
    }
    setVoiceStatus("idle");
    setIsSpeaking(false);
  }

  function switchMode(newMode: Mode) {
    if (newMode === "chat" && voiceStatus !== "idle") {
      endVoiceSession();
    }
    setMode(newMode);
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
        <p className="text-sm font-medium text-slate-900">This chat assistant isn&apos;t available here.</p>
        <p className="text-xs text-slate-400">It hasn&apos;t been authorized for this website.</p>
      </div>
    );
  }

  return (
    <div className="flex w-screen flex-col overflow-hidden bg-white" style={{ height: "100dvh" }}>

      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 bg-slate-950 px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950">
          AI
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">AI Assistant</p>
          <p className="text-xs text-slate-400">Usually replies instantly</p>
        </div>
        <div className="ml-auto flex h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
      </div>

      {/* Mode toggle */}
      <div className="flex shrink-0 border-b border-slate-100 bg-white">
        <button
          onClick={() => switchMode("chat")}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
            mode === "chat"
              ? "border-b-2 border-slate-950 text-slate-950"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          💬 Chat
        </button>
        <button
          onClick={() => switchMode("voice")}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
            mode === "voice"
              ? "border-b-2 border-slate-950 text-slate-950"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          🎙️ Voice
        </button>
      </div>

      {/* Chat mode */}
      {mode === "chat" && (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 pb-2">
            {messages.map((msg, i) => (
              <div key={i} className={msg.role === "user" ? "ml-auto max-w-[85%]" : "mr-auto max-w-[85%]"}>
                <div className={
                  msg.role === "user"
                    ? "rounded-2xl rounded-tr-sm bg-slate-950 px-4 py-2.5 text-sm text-white"
                    : "rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-2.5 text-sm text-slate-900"
                }>
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

          <div className="shrink-0 flex gap-2 border-t border-slate-200 bg-white p-3">
            <input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={loading}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 disabled:opacity-50"
              style={{ fontSize: "16px" }}
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
        </>
      )}

      {/* Voice mode */}
      {mode === "voice" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">

          {voiceStatus === "idle" && (
            <>
              <p className="text-center text-sm text-slate-500">
                Tap the button to start a voice conversation with our AI assistant.
              </p>
              <button
                onClick={startVoiceSession}
                className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-950 text-4xl shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                🎙️
              </button>
              <p className="text-xs text-slate-400">Tap to speak</p>
            </>
          )}

          {voiceStatus === "connecting" && (
            <>
              <div className="h-24 w-24 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />
              <p className="text-sm text-slate-500">Connecting...</p>
            </>
          )}

          {voiceStatus === "connected" && (
            <>
              <div className={`flex h-24 w-24 items-center justify-center rounded-full text-4xl shadow-lg transition-all ${
                isSpeaking
                  ? "bg-cyan-400 scale-110 animate-pulse"
                  : "bg-slate-950"
              }`}>
                {isSpeaking ? "🔊" : "🎙️"}
              </div>
              <p className="text-sm font-medium text-slate-700">
                {isSpeaking ? "AI is speaking..." : "Listening..."}
              </p>
              <button
                onClick={endVoiceSession}
                className="rounded-full bg-red-500 px-6 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-105 active:scale-95"
              >
                End call
              </button>
            </>
          )}

          {voiceStatus === "error" && (
            <>
              <p className="text-center text-sm text-red-500">
                Could not connect. Please check your microphone permissions and try again.
              </p>
              <button
                onClick={() => setVoiceStatus("idle")}
                className="rounded-xl bg-slate-950 px-6 py-2.5 text-sm font-semibold text-white"
              >
                Try again
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}