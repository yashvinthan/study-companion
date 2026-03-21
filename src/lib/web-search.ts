export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: string;
};

export type SearchMode = 'web' | 'academic' | 'social';

function sanitizeText(value: string, max = 500) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) {
    return cleaned;
  }
  return `${cleaned.slice(0, max)}...`;
}

function applySearchMode(query: string, mode: SearchMode) {
  if (mode === 'academic') {
    return `${query} (site:arxiv.org OR site:nature.com OR site:sciencedirect.com OR site:springer.com OR site:scholar.google.com)`;
  }
  if (mode === 'social') {
    return `${query} (site:reddit.com OR site:x.com OR site:youtube.com)`;
  }
  return query;
}

async function searchWithSerper(
  query: string,
  limit: number,
  mode: SearchMode,
): Promise<WebSearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) {
    return [];
  }

  const scopedQuery = applySearchMode(query, mode);

  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({
      q: scopedQuery,
      num: limit,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Serper search failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as {
    organic?: Array<{
      title?: string;
      link?: string;
      snippet?: string;
    }>;
  };

  return (payload.organic ?? [])
    .map((item) => ({
      title: sanitizeText(item.title ?? 'Untitled'),
      url: (item.link ?? '').trim(),
      snippet: sanitizeText(item.snippet ?? ''),
      source: 'Google',
    }))
    .filter((item) => item.url.length > 0)
    .slice(0, limit);
}

async function searchWithSearxng(
  query: string,
  limit: number,
  mode: SearchMode,
): Promise<WebSearchResult[]> {
  const baseUrl = process.env.SEARXNG_BASE_URL?.trim();
  if (!baseUrl) {
    return [];
  }

  const scopedQuery = applySearchMode(query, mode);
  const searchUrl = new URL('/search', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  searchUrl.searchParams.set('q', scopedQuery);
  searchUrl.searchParams.set('format', 'json');
  searchUrl.searchParams.set('language', 'en-US');
  searchUrl.searchParams.set('safesearch', '1');

  const response = await fetch(searchUrl.toString(), {
    method: 'GET',
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SearXNG search failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      engine?: string;
    }>;
  };

  return (payload.results ?? [])
    .map((item) => ({
      title: sanitizeText(item.title ?? 'Untitled'),
      url: (item.url ?? '').trim(),
      snippet: sanitizeText(item.content ?? ''),
      source: item.engine?.trim() || 'SearXNG',
    }))
    .filter((item) => item.url.length > 0)
    .slice(0, limit);
}

export async function searchWeb(
  query: string,
  limit = 6,
  mode: SearchMode = 'web',
): Promise<WebSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const searxng = await searchWithSearxng(trimmed, limit, mode);
    if (searxng.length > 0) {
      return searxng;
    }
  } catch (error) {
    console.warn('SearXNG search failed; falling back to hosted provider.', error);
  }

  try {
    const serper = await searchWithSerper(trimmed, limit, mode);
    if (serper.length > 0) {
      return serper;
    }
  } catch (error) {
    console.warn('Web search failed; continuing without external sources.', error);
  }

  return [];
}
