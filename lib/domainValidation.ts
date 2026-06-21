// Validates that a request claiming to come from a given origin/referrer
// is actually allowed to use a specific client's widget.
//
// Used in two places:
// 1. The embed-config endpoint (iframe calls this before rendering at all)
// 2. The chat route (re-validates on every message — never trust the
//    frontend check alone, since anyone can read the JS and bypass it)

export function extractDomain(urlOrOrigin: string | null): string | null {
  if (!urlOrOrigin) return null;

  try {
    const url = new URL(urlOrOrigin);
    return url.hostname.toLowerCase();
  } catch {
    // Already a bare hostname, not a full URL
    return urlOrOrigin.toLowerCase().trim();
  }
}

export function isDomainAllowed(
  requestDomain: string | null,
  allowedDomainsRaw: string | null
): boolean {
  // No allowlist configured yet — this is the MVP/dev-testing state.
  // Allow everything, but this should NEVER be true for a paying client.
  // The dashboard should visibly warn if this is unset.
  if (!allowedDomainsRaw || allowedDomainsRaw.trim() === "") {
    return true;
  }

  if (!requestDomain) {
    return false;
  }

  const allowedList = allowedDomainsRaw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  // Also always allow localhost during development, regardless of
  // what's configured, so you're never locked out of your own testing.
  if (requestDomain === "localhost" || requestDomain === "127.0.0.1") {
    return true;
  }

  return allowedList.some((allowed) => {
    // Exact match, or the request domain is a subdomain of the allowed one
    // (e.g. allowing "navahh.com" also permits "www.navahh.com")
    return requestDomain === allowed || requestDomain.endsWith(`.${allowed}`);
  });
}
