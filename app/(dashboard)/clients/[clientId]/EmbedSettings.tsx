"use client";

import { useEffect, useState } from "react";

type Props = {
  clientId: string;
  initialAllowedDomains: string | null;
  initialCustomKnowledge: string | null;
  initialOwnerAlertEmail: string | null;
  initialFollowupChannel: string | null;
  initialOwnerPhone: string | null;
};

export default function EmbedSettings({
  clientId,
  initialAllowedDomains,
  initialCustomKnowledge,
  initialOwnerAlertEmail,
  initialFollowupChannel,
  initialOwnerPhone,
}: Props) {
  const [allowedDomains, setAllowedDomains] = useState(initialAllowedDomains || "");
  const [customKnowledge, setCustomKnowledge] = useState(initialCustomKnowledge || "");
  const [ownerAlertEmail, setOwnerAlertEmail] = useState(initialOwnerAlertEmail || "");
  const [followupChannel, setFollowupChannel] = useState(initialFollowupChannel || "email");
  const [ownerPhone, setOwnerPhone] = useState(initialOwnerPhone || "");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [hostUrl, setHostUrl] = useState("");

  useEffect(() => {
    setHostUrl(window.location.origin);
  }, []);

  const snippet = `<script src="${hostUrl}/embed.js" data-client-id="${clientId}" data-host="${hostUrl}"></script>`;

  async function handleSave() {
    setSaving(true);
    setSaveStatus("idle");

    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowedDomains,
          customKnowledge,
          ownerAlertEmail,
          followupChannel,
          ownerPhone,
        }),
      });

      if (!res.ok) {
        setSaveStatus("error");
      } else {
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    } catch {
      setSaveStatus("error");
    }

    setSaving(false);
  }

  function handleCopy() {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isUnrestricted = !allowedDomains || allowedDomains.trim() === "";

  return (
    <section className="rounded-lg border border-white/10 bg-white/5 p-4 md:p-5">
      <h2 className="text-lg font-semibold">Embed on website</h2>
      <p className="mt-1 text-sm text-slate-400">
        Paste this snippet into the client&apos;s website, right before{" "}
        <code className="text-cyan-300">&lt;/body&gt;</code>.
      </p>

      <div className="mt-4 flex items-start gap-2">
        <code className="flex-1 overflow-x-auto rounded-md bg-slate-950 p-3 text-xs text-slate-300">
          {hostUrl ? snippet : "Loading..."}
        </code>
        <button
          onClick={handleCopy}
          disabled={!hostUrl}
          className="shrink-0 rounded-md bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <div className="mt-5 space-y-5 border-t border-white/10 pt-5">

        {/* Authorized domain */}
        <div>
          <label className="text-sm font-medium text-slate-200">
            Authorized domain
          </label>
          <p className="mt-1 text-xs text-slate-400">
            The widget only runs on these domains. Comma-separated if multiple.
          </p>
          <input
            value={allowedDomains}
            onChange={(e) => { setAllowedDomains(e.target.value); setSaveStatus("idle"); }}
            placeholder="e.g. navahh.in, www.navahh.in"
            className="mt-2 w-full rounded-md bg-slate-900 p-2.5 text-sm outline-none focus:ring-1 focus:ring-cyan-400"
          />
          {isUnrestricted && (
            <p className="mt-1.5 text-xs text-amber-400">
              ⚠ No domain set — widget runs on ANY website. Set before going live.
            </p>
          )}
        </div>

        {/* Follow-up channel */}
        <div>
          <label className="text-sm font-medium text-slate-200">
            Follow-up channel
          </label>
          <p className="mt-1 text-xs text-slate-400">
            How cold leads get nudged after 24 hours of silence.
            Use SMS for US clients, WhatsApp for Indian clients, Email as default.
          </p>
          <select
            value={followupChannel}
            onChange={(e) => { setFollowupChannel(e.target.value); setSaveStatus("idle"); }}
            className="mt-2 w-full rounded-md bg-slate-900 p-2.5 text-sm outline-none focus:ring-1 focus:ring-cyan-400"
          >
            <option value="email">Email (default — works everywhere)</option>
            <option value="sms">SMS (US clients — via Twilio)</option>
            <option value="whatsapp">WhatsApp (India clients — pending Meta verification)</option>
          </select>
          {followupChannel === "whatsapp" && (
            <p className="mt-1.5 text-xs text-amber-400">
              ⚠ WhatsApp is pending Meta business verification. Will fall back to email until verified.
            </p>
          )}
        </div>

        {/* Owner phone — shown when SMS or WhatsApp selected */}
        {(followupChannel === "sms" || followupChannel === "whatsapp") && (
          <div>
            <label className="text-sm font-medium text-slate-200">
              {followupChannel === "sms" ? "Lead follow-up number (Twilio)" : "Lead follow-up number (WhatsApp)"}
            </label>
            <p className="mt-1 text-xs text-slate-400">
              {followupChannel === "sms"
                ? "The Twilio number that sends SMS follow-ups to cold leads. Include country code (e.g. +14155552671)."
                : "The WhatsApp Business number that sends follow-ups. Include country code (e.g. +919798888730)."}
            </p>
            <input
              value={ownerPhone}
              onChange={(e) => { setOwnerPhone(e.target.value); setSaveStatus("idle"); }}
              placeholder={followupChannel === "sms" ? "+14155552671" : "+919798888730"}
              className="mt-2 w-full rounded-md bg-slate-900 p-2.5 text-sm outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </div>
        )}

        {/* Emergency alert email */}
        <div>
          <label className="text-sm font-medium text-slate-200">
            Emergency alert email
          </label>
          <p className="mt-1 text-xs text-slate-400">
            When the AI detects an emergency, it instantly emails this address
            so the owner can respond immediately.
          </p>
          <input
            value={ownerAlertEmail}
            onChange={(e) => { setOwnerAlertEmail(e.target.value); setSaveStatus("idle"); }}
            placeholder="e.g. owner@acmehvac.com"
            type="email"
            className="mt-2 w-full rounded-md bg-slate-900 p-2.5 text-sm outline-none focus:ring-1 focus:ring-cyan-400"
          />
          {!ownerAlertEmail && (
            <p className="mt-1.5 text-xs text-amber-400">
              ⚠ No alert email set — emergency leads will not notify the owner.
            </p>
          )}
        </div>

        {/* Custom knowledge */}
        <div>
          <label className="text-sm font-medium text-slate-200">
            Custom knowledge
          </label>
          <p className="mt-1 text-xs text-slate-400">
            Anything the AI should know that&apos;s not on the website — service area,
            pricing, brands serviced, fees, availability. Plain text.
          </p>
          <textarea
            value={customKnowledge}
            onChange={(e) => { setCustomKnowledge(e.target.value); setSaveStatus("idle"); }}
            placeholder={`Example:\n- Service area: zip codes 85001–85099 only\n- Diagnostic fee: $89 (waived if repair booked same day)\n- Brands serviced: Carrier, Trane, Lennox\n- Not available Sundays`}
            rows={6}
            className="mt-2 w-full rounded-md bg-slate-900 p-2.5 text-sm outline-none focus:ring-1 focus:ring-cyan-400"
          />
        </div>

        {/* Save */}
        <div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save settings"}
          </button>
          {saveStatus === "success" && (
            <span className="ml-3 text-xs text-emerald-400">✓ Saved successfully.</span>
          )}
          {saveStatus === "error" && (
            <span className="ml-3 text-xs text-red-400">✗ Save failed. Try again.</span>
          )}
        </div>
      </div>
    </section>
  );
}