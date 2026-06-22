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

  async function handleStatusChange(newStatus: string) {
    setUpdating(true);
    setStatus(newStatus);

    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      setStatus(lead.status);
    }

    setUpdating(false);
  }

  return (
    <div className="grid gap-3 p-5 md:grid-cols-[1.2fr_0.8fr_0.8fr_1fr_auto]">
      <div>
        <p className="font-medium">{lead.name || "Unknown lead"}</p>
        <p className="text-sm text-slate-400">
          {lead.email || lead.phone || "No contact info"}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {lead.service_needed || "No service specified"}
        </p>
      </div>

      <div>
        <p className="text-sm text-slate-400">Budget</p>
        <p className="font-medium">{lead.budget || "Not added"}</p>
      </div>

      <div>
        <p className="text-sm text-slate-400">Project Timeline</p>
        <p className="font-medium">{lead.timeline || "Not added"}</p>
      </div>

      <div>
        <p className="text-sm text-slate-400">Free to call</p>
        <p
          className={
            lead.preferred_call_time
              ? "font-medium text-emerald-300"
              : "font-medium text-slate-500"
          }
        >
          {lead.preferred_call_time || "Not confirmed yet"}
        </p>
      </div>

      {readOnly ? (
        <span
          className={`h-fit rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLORS[status] || STATUS_COLORS.New}`}
        >
          {status}
        </span>
      ) : (
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={updating}
          className={`h-fit rounded-full border-0 px-3 py-1 text-sm font-medium outline-none disabled:opacity-50 ${STATUS_COLORS[status] || STATUS_COLORS.New}`}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option} className="bg-slate-900 text-white">
              {option}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
