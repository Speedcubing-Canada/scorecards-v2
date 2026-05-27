export const WCA_OAUTH_URL = 'https://www.worldcubeassociation.org/oauth/authorize';
// In dev, route through the Vite proxy (WCA's token endpoint has no CORS headers).
// In production, a backend proxy at /wca-token is required — see README.
export const WCA_TOKEN_URL = import.meta.env.DEV
  ? '/wca-token'
  : '/wca-token';
export const WCA_API_URL = 'https://www.worldcubeassociation.org/api/v0';

export const CLIENT_ID = import.meta.env.VITE_WCA_CLIENT_ID as string;
export const REDIRECT_URI = import.meta.env.VITE_WCA_REDIRECT_URI || `${window.location.origin}/auth/callback`;

export interface WCAToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  created_at: number;
}

export interface WCAUser {
  id: number;
  name: string;
  wca_id: string | null;
  avatar: { thumb_url: string };
  email: string;
}

export async function exchangeCodeForToken(code: string, verifier: string): Promise<WCAToken> {
  const res = await fetch(WCA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Token exchange failed (${res.status}): ${body || res.statusText}`);
  }
  return res.json();
}

export async function fetchMe(token: string): Promise<WCAUser> {
  const res = await fetch(`${WCA_API_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch user: ${res.statusText}`);
  const data = await res.json();
  return data.me;
}

export async function fetchManagedCompetitions(token: string) {
  const res = await fetch(`${WCA_API_URL}/competitions?managed_by_me=true&per_page=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch competitions: ${res.statusText}`);
  return res.json();
}

export const WCA_LIVE_API = 'https://live.worldcubeassociation.org/api';

/** Returns the numeric WCA Live competition ID, or null if not found / API error. */
export async function fetchWcaLiveId(wcaId: string): Promise<string | null> {
  try {
    const res = await fetch(WCA_LIVE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ competitions { id wcaId } }' }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const competitions: { id: string; wcaId: string }[] = json?.data?.competitions ?? [];
    const match = competitions.find(c => c.wcaId === wcaId);
    return match?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns a map of registrantId → WCA Live person ID for all competitors in a competition.
 * The WCA Live person ID is the internal numeric ID used in live.worldcubeassociation.org URLs.
 */
export async function fetchWcaLivePersonIds(
  competitionLiveId: string,
): Promise<Record<number, string> | null> {
  try {
    const res = await fetch(WCA_LIVE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query($id: ID!) { competition(id: $id) { competitors { id registrantId } } }`,
        variables: { id: competitionLiveId },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const competitors: { id: string; registrantId: number }[] =
      json?.data?.competition?.competitors ?? [];
    if (competitors.length === 0) return null;
    const map: Record<number, string> = {};
    for (const c of competitors) map[c.registrantId] = c.id;
    return map;
  } catch {
    return null;
  }
}
