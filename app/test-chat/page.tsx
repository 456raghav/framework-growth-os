"use client";

import { useState } from "react";

export default function TestChatPage() {
  const [clientId, setClientId] = useState("");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!clientId || !message) return;

    setLoading(true);
    setChat((old) => [...old, `You: ${message}`]);

    const response = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ clientId, message }),
    });

    const data = await response.json();

    setChat((old) => [...old, `AI: ${data.reply || data.error}`]);
    setMessage("");
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <section className="mx-auto max-w-2xl">
        <h1 className="text-4xl font-semibold">Test AI Chat</h1>
        <p className="mt-2 text-slate-400">
          Paste a client ID and test the AI assistant.
        </p>

        <input
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          placeholder="Paste client ID from Supabase"
          className="mt-6 w-full rounded-md border border-white/10 bg-slate-900 p-3 outline-none"
        />

        <div className="mt-6 min-h-80 rounded-lg border border-white/10 bg-white/5 p-4">
          {chat.map((item, index) => (
            <p key={index} className="mb-3 text-sm">
              {item}
            </p>
          ))}
        </div>

        <div className="mt-4 flex gap-3">
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask something..."
            className="flex-1 rounded-md border border-white/10 bg-slate-900 p-3 outline-none"
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            className="rounded-md bg-cyan-300 px-5 font-semibold text-slate-950"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </section>
    </main>
  );
}