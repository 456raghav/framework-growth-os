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
        // Revert and show error if the API call failed
        setStatus(previousStatus);
        setErrorMsg("Failed to update status. Try again.");
      }
    } catch {
      setStatus(previousStatus);
      setErrorMsg("Network error. Try again.");
    }

    setUpdating(false);
  }

  return (
    <div className="p-4 md:p-5">
      {/* Mobile: stacked layout. Desktop: grid layout */}
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

        {/* Mobile: show budget + timeline side by side to save space */}
        <div className="flex gap-4 md:contents">
          <div className="flex-1 md:flex-none">
            <p className="text-xs text-slate-400 md:text-sm">Budget</p>
            <p className="text-sm font-medium md:font-medium">
              {lead.budget || "Not added"}
            </p>
          </div>

          <div className="flex-1 md:flex-none">
            <p className="text-xs text-slate-400 md:text-sm">Project Timeline</p>
            <p className="text-sm font-medium md:font-medium">
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
                <option key={option} value={option} className="bg-slate-900 text-white">
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
    </div>
  );
}