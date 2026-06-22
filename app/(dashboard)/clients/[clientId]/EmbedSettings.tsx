"use client";

import { useEffect, useState } from "react";

type Props = {
  clientId: string;
  initialAllowedDomains: string | null;
};

export default function EmbedSettings({ clientId, initialAllowedDomains }: Props) {
  const [allowedDomains, setAllowedDomains] = useState(initialAllowedDomains || "");
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
        body: JSON.stringify({ allowedDomains }),
      });

      if (!res.ok) {
        setSaveStatus("error");
      } else {
        setSaveStatus("success");
        // Reset success message after 3 seconds
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

      <div className="mt-5 border-t border-white/10 pt-5">
        <label className="text-sm font-medium text-slate-200">
          Authorized domain
        </label>
        <p className="mt-1 text-xs text-slate-400">
          The widget will only run on these domains. Comma-separated if
          multiple (e.g. navahh.in, www.navahh.in).
        </p>

        <div className="mt-2 flex gap-2">
          <input
            value={allowedDomains}
            onChange={(e) => {
              setAllowedDomains(e.target.value);
              setSaveStatus("idle");
            }}
            placeholder="e.g. navahh.in"
            className="flex-1 rounded-md bg-slate-900 p-2.5 text-sm outline-none focus:ring-1 focus:ring-cyan-400"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>

        {/* Feedback messages */}
        {saveStatus === "success" && (
          <p className="mt-2 text-xs text-emerald-400">
            ✓ Domain saved successfully.
          </p>
        )}
        {saveStatus === "error" && (
          <p className="mt-2 text-xs text-red-400">
            ✗ Failed to save. Check your connection and try again.
          </p>
        )}
        {saveStatus === "idle" && isUnrestricted && (
          <p className="mt-2 text-xs text-amber-400">
            ⚠ No domain restriction set — this widget runs on ANY website. Set this before going live.
          </p>
        )}
      </div>
    </section>
  );
}