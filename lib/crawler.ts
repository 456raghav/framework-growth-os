const FETCH_TIMEOUT_MS = 8000; // 8 seconds per page
const MAX_PAGES = 20;
const MAX_CONTENT_PER_PAGE = 8000; // chars

// Fetch with timeout so we never hang
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}

function buildJinaUrl(rawUrl: string): string {
  const clean = rawUrl
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  return `https://r.jina.ai/https://${clean}`;
}

function is404Content(content: string): boolean {
  const lower = content.toLowerCase();
  // Only flag as 404 if these appear near the start of the page
  const first500 = lower.slice(0, 500);
  return (
    first500.includes("404 not found") ||
    first500.includes("page not found") ||
    first500.includes("this page does not exist")
  );
}

function extractTitle(content: string, fallbackUrl: string): string {
  const titleMatch = content.match(/^Title:\s*(.+)/m);
  return titleMatch?.[1]?.trim() || fallbackUrl;
}

function extractInternalUrls(homepageContent: string, baseUrl: string): string[] {
  const cleanBase = baseUrl
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  const urlMatches = homepageContent.match(/https?:\/\/[^\s)"'\]]+/g) || [];

  const filtered = urlMatches.filter((url) => {
    const cleanUrl = url.replace(/^https?:\/\//, "");
    return (
      cleanUrl.startsWith(cleanBase) &&
      !url.includes("#") &&
      !url.match(/\.(jpg|jpeg|png|svg|gif|pdf|webp|ico|zip|mp4|mp3)$/i) &&
      !url.includes("?") // skip URLs with query params for now
    );
  });

  // Always include homepage
  return [baseUrl, ...new Set(filtered)].slice(0, MAX_PAGES);
}

export async function crawlWebsite(website: string): Promise<{
  pages: { url: string; title: string; content: string }[];
  pagesFound: number;
  pagesCrawled: number;
  errors: string[];
}> {
  const errors: string[] = [];

  // Step 1: Fetch homepage
  let homepageContent = "";
  try {
    const homepageResponse = await fetchWithTimeout(
      buildJinaUrl(website),
      FETCH_TIMEOUT_MS
    );
    homepageContent = await homepageResponse.text();
  } catch (error) {
    errors.push(`Homepage fetch failed: ${error}`);
    return { pages: [], pagesFound: 0, pagesCrawled: 0, errors };
  }

  // Step 2: Extract internal URLs
  const urlsToCrawl = extractInternalUrls(homepageContent, website);

  // Step 3: Crawl each page
  const pages: { url: string; title: string; content: string }[] = [];

  // Always add homepage first
  if (!is404Content(homepageContent)) {
    pages.push({
      url: website,
      title: extractTitle(homepageContent, website),
      content: homepageContent.slice(0, MAX_CONTENT_PER_PAGE),
    });
  }

  // Crawl remaining pages (skip homepage, already added)
  for (const url of urlsToCrawl.slice(1)) {
    try {
      const response = await fetchWithTimeout(
        buildJinaUrl(url),
        FETCH_TIMEOUT_MS
      );

      const content = await response.text();

      if (is404Content(content)) {
        continue;
      }

      pages.push({
        url,
        title: extractTitle(content, url),
        content: content.slice(0, MAX_CONTENT_PER_PAGE),
      });
    } catch (error) {
      errors.push(`Failed to crawl ${url}: ${error}`);
    }
  }

  return {
    pages,
    pagesFound: urlsToCrawl.length,
    pagesCrawled: pages.length,
    errors,
  };
}
