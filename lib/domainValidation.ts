export function extractDomain(urlOrOrigin: string | null): string | null {
  if (!urlOrOrigin) return null;

  try {
    const url = new URL(urlOrOrigin);
    return url.hostname.toLowerCase();
  } catch {
    return urlOrOrigin.toLowerCase().trim();
  }
}

export function isDomainAllowed(
  requestDomain: string | null,
  allowedDomainsRaw: string | null
): boolean {
  // CHANGED: no domain configured = DENY, not allow.
  // Old behavior was allow-all until a domain was set — that meant
  // every new client onboarded had a fully open widget until Hadron1
  // manually set the domain. One forgotten step = data leak.
  // Now it's deny-all until explicitly authorized.
  // Exception: localhost always passes so dev/testing is never blocked.
  if (!allowedDomainsRaw || allowedDomainsRaw.trim() === "") {
    if (
      requestDomain === "localhost" ||
      requestDomain === "127.0.0.1"
    ) {
      return true;
    }
    return false;
  }

  if (!requestDomain) {
    return false;
  }

  const allowedList = allowedDomainsRaw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  // Always allow localhost in dev regardless of what's configured
  if (requestDomain === "localhost" || requestDomain === "127.0.0.1") {
    return true;
  }

  return allowedList.some((allowed) => {
    return requestDomain === allowed || requestDomain.endsWith(`.${allowed}`);
  });
}