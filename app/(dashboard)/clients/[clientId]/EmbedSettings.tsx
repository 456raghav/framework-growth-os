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

  // hostUrl starts empty on both server AND initial client render — this
  // avoids the hydration mismatch. We fill it in AFTER mount, via useEffect,
  // which only runs in the browser. React expects this pattern and won't
  // complain, because the initial client render now matches the server
  // render exactly (both empty), and the update happens in a separate
  // pass after hydration completes.
  const [hostUrl, setHostUrl] = useState("");

  useEffect(() => {
    setHostUrl(window.location.origin);
  }, []);

  const snippet = `<script src="${hostUrl}/embed.js" data-client-id="${clientId}" data-host="${hostUrl}"></script>`;

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedDomains }),
      });
    } catch {
      // Silent fail acceptable here — not safety critical, user can retry
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
    <section className="rounded-lg border border-white/10 bg-white/5 p-5">
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
          multiple (e.g. navahh.com, www.navahh.com).
        </p>

        <div className="mt-2 flex gap-2">
          <input
            value={allowedDomains}
            onChange={(e) => setAllowedDomains(e.target.value)}
            placeholder="e.g. navahh.com"
            className="flex-1 rounded-md bg-slate-900 p-2.5 text-sm"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>

        {isUnrestricted && (
          <p className="mt-2 text-xs text-amber-400">
            ⚠ No domain restriction set — this widget currently runs on ANY
            website. Set this before going live with a real client.
          </p>
        )}
      </div>
    </section>
  );
}
