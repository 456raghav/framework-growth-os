"use client";

import { useState } from "react";

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  service_needed: string | null;
  budget: string | null;
  timeline: string | null;
  preferred_call_time: string | null;
  status: string;
  qualification_score: number | null;
  is_emergency: boolean | null;
  emergency_description: string | null;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type Props = {
  lead: Lead;
  readOnly?: boolean;
};

const STATUS_OPTIONS = [
  "New",
  "Qualified",
  "Hot",
  "Callback Requested",
  "Booked",
  "Lost",
];

const STATUS_COLORS: Record<string, string> = {
  New: "bg-slate-500/10 text-slate-300",
  Qualified: "bg-cyan-400/10 text-cyan-300",
  Hot: "bg-orange-400/10 text-orange-300",
  "Callback Requested": "bg-amber-400/10 text-amber-300",
  Booked: "bg-emerald-400/10 text-emerald-300",
  Lost: "bg-red-400/10 text-red-300",
};

export default function LeadCard({ lead, readOnly = false }: Props) {
  const [status, setStatus] = useState(lead.status);
  const [updating, setUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState("");

  async function handleStatusChange(newStatus: string) {
    setUpdating(true);
    setErrorMsg("");
    const previousStatus = status;
    setStatus(newStatus);

    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        setStatus(previousStatus);
        setErrorMsg("Failed to update status. Try again.");
      }
    } catch {
      setStatus(previousStatus);
      setErrorMsg("Network error. Try again.");
    }

    setUpdating(false);
  }

  async function handleTranscriptToggle() {
    if (transcriptOpen) {
      setTranscriptOpen(false);
      return;
    }

    if (messages.length === 0) {
      setTranscriptLoading(true);
      setTranscriptError("");

      try {
        const res = await fetch(`/api/leads/${lead.id}/messages`);
        const data = await res.json();

        if (!res.ok) {
          setTranscriptError("Failed to load conversation.");
        } else {
          setMessages(data.messages || []);
        }
      } catch {
        setTranscriptError("Network error. Try again.");
      }

      setTranscriptLoading(false);
    }

    setTranscriptOpen(true);
  }

  function formatTime(isoString: string) {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="p-4 md:p-5">

      {/* Emergency banner — shown at top if this is an emergency lead */}
      {lead.is_emergency && (
        <div className="mb-3 flex items-start gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
          <span className="text-sm">🚨</span>
          <div>
            <p className="text-xs font-semibold text-red-400">Emergency lead</p>
            {lead.emergency_description && (
              <p className="text-xs text-red-300/80 mt-0.5">
                {lead.emergency_description}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Lead info grid — stacked on mobile, columns on desktop */}
      <div className="flex flex-col gap-3 md:grid md:grid-cols-[1.2fr_0.8fr_0.8fr_1fr_auto] md:gap-4 md:items-start">

        {/* Name + contact + service */}
        <div>
          <p className="font-medium">{lead.name || "Unknown lead"}</p>
          <p className="text-sm text-slate-400">
            {lead.email || lead.phone || "No contact info"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {lead.service_needed || "No service specified"}
          </p>
        </div>

        {/* Budget + timeline — side by side on mobile */}
        <div className="flex gap-4 md:contents">
          <div className="flex-1 md:flex-none">
            <p className="text-xs text-slate-400 md:text-sm">Budget</p>
            <p className="text-sm font-medium">
              {lead.budget || "Not added"}
            </p>
          </div>
          <div className="flex-1 md:flex-none">
            <p className="text-xs text-slate-400 md:text-sm">Project Timeline</p>
            <p className="text-sm font-medium">
              {lead.timeline || "Not added"}
            </p>
          </div>
        </div>

        {/* Call time */}
        <div>
          <p className="text-xs text-slate-400 md:text-sm">Free to call</p>
          <p
            className={
              lead.preferred_call_time
                ? "text-sm font-medium text-emerald-300"
                : "text-sm font-medium text-slate-500"
            }
          >
            {lead.preferred_call_time || "Not confirmed yet"}
          </p>
        </div>

        {/* Status */}
        <div>
          {readOnly ? (
            <span
              className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
                STATUS_COLORS[status] || STATUS_COLORS.New
              }`}
            >
              {status}
            </span>
          ) : (
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={updating}
              className={`rounded-full border-0 px-3 py-1 text-sm font-medium outline-none disabled:opacity-50 ${
                STATUS_COLORS[status] || STATUS_COLORS.New
              }`}
            >
              {STATUS_OPTIONS.map((option) => (
                <option
                  key={option}
                  value={option}
                  className="bg-slate-900 text-white"
                >
                  {option}
                </option>
              ))}
            </select>
          )}
          {errorMsg && (
            <p className="mt-1 text-xs text-red-400">{errorMsg}</p>
          )}
        </div>
      </div>

      {/* Transcript toggle */}
      <div className="mt-3">
        <button
          onClick={handleTranscriptToggle}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {transcriptOpen ? "▲ Hide conversation" : "▼ View conversation"}
        </button>
      </div>

      {/* Transcript panel */}
      {transcriptOpen && (
        <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/60 p-4">
          {transcriptLoading && (
            <p className="text-xs text-slate-400">Loading conversation...</p>
          )}
          {transcriptError && (
            <p className="text-xs text-red-400">{transcriptError}</p>
          )}
          {!transcriptLoading && !transcriptError && messages.length === 0 && (
            <p className="text-xs text-slate-400">No messages found for this lead.</p>
          )}
          {!transcriptLoading && messages.length > 0 && (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={
                    msg.role === "user"
                      ? "ml-auto max-w-[80%] text-right"
                      : "mr-auto max-w-[80%]"
                  }
                >
                  <div
                    className={
                      msg.role === "user"
                        ? "inline-block rounded-2xl rounded-tr-sm bg-slate-700 px-3 py-2 text-xs text-white"
                        : "inline-block rounded-2xl rounded-tl-sm bg-slate-800 px-3 py-2 text-xs text-slate-200"
                    }
                  >
                    {msg.content}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {msg.role === "user" ? "Visitor" : "AI"} ·{" "}
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}