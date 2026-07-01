// Server-side geocoding via OpenStreetMap Nominatim.
// Never call this from the browser — it must run on the server only.
// Geocodes to ZIP CODE CENTROID, not exact address, to protect lead privacy.

let lastCallTime = 0;
const MIN_INTERVAL_MS = 1100; // Nominatim policy: max 1 request/second

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastCallTime = Date.now();

  return fetch(url, {
    headers: {
      // Nominatim requires a descriptive User-Agent identifying the app
      "User-Agent": "FGOS-FrameworkGrowthOS/1.0 (contact: 456raghavmishra@gmail.com)",
    },
  });
}

export async function geocodeZip(
  zipCode: string,
  countryHint: string
): Promise<{ lat: number; lng: number } | null> {
  if (!zipCode || zipCode.trim().length < 3) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(
      zipCode.trim()
    )}${countryHint ? `&country=${countryHint}` : ""}&format=json&limit=1`;

    const response = await rateLimitedFetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch (error) {
    console.error("[Geocode] Failed:", error);
    return null;
  }
}

// For one-time shop address geocoding (full address, not just zip —
// this is the business's own public address, not a private lead's)
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  if (!address || address.trim().length < 3) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      address.trim()
    )}&format=json&limit=1`;

    const response = await rateLimitedFetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch (error) {
    console.error("[Geocode] Failed:", error);
    return null;
  }
}