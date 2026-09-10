// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WCA_API_URL,
  exchangeCodeForToken,
  fetchManagedCompetitions,
  fetchMe,
  fetchScoretakingSoftware,
  fetchWcaLiveId,
  fetchWcaLivePersonIds,
  fetchWcif,
} from './wca';

// Eight fetch wrappers, and the only place the app talks to the WCA or WCA Live.
// Two contracts are asserted here that nothing else can see:
//
//  - the four throwing functions carry the status into the message, because that string is
//    what the pages render back to the organizer (picker.error, GeneratePage's error state).
//  - the three WCA Live / scoretaking functions swallow every failure and return null *by
//    design*. That is what keeps a WCA Live outage from blocking a download, and it is also
//    what makes a regression invisible: nametag QR codes silently degrade instead of failing.
//
// jsdom, not node: the module reads `window.location.origin` at import time for REDIRECT_URI.

/** Queue one response per call, in order. */
function stubFetch(...responses: Partial<Response>[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  vi.stubGlobal('fetch', fn);
  return fn;
}

const ok = (json: unknown): Partial<Response> => ({
  ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json),
});
const fail = (status: number, statusText = '', body = ''): Partial<Response> => ({
  ok: false, status, statusText, json: async () => ({}), text: async () => body,
});

/** The single argument list the stub was called with. */
const callArgs = (fn: ReturnType<typeof vi.fn>, i = 0) =>
  fn.mock.calls[i] as [string, RequestInit | undefined];

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('exchangeCodeForToken', () => {
  it('posts the PKCE grant to the same-origin proxy', async () => {
    const fn = stubFetch(ok({ access_token: 'tok' }));
    const token = await exchangeCodeForToken('the-code', 'the-verifier');

    expect(token).toEqual({ access_token: 'tok' });
    const [url, init] = callArgs(fn);
    // Must be same-origin: WCA's token endpoint sends no CORS headers, so a direct
    // call from the browser cannot work.
    expect(url).toBe('/wca-token');
    expect(init?.method).toBe('POST');

    const body = new URLSearchParams(init?.body as string);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('the-code');
    expect(body.get('code_verifier')).toBe('the-verifier');
    expect(body.get('client_id')).toBe('test-client-id');
    // The secret is added server-side and must never appear in a browser-built body.
    expect(body.get('client_secret')).toBeNull();
  });

  it('carries the status and the response body into the error', async () => {
    stubFetch(fail(401, 'Unauthorized', 'invalid_client'));
    await expect(exchangeCodeForToken('c', 'v'))
      .rejects.toThrow('Token exchange failed (401): invalid_client');
  });

  it('falls back to the status text when the body is empty', async () => {
    stubFetch(fail(500, 'Internal Server Error', ''));
    await expect(exchangeCodeForToken('c', 'v'))
      .rejects.toThrow('Token exchange failed (500): Internal Server Error');
  });

  it('still reports the status when the body cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 502, statusText: 'Bad Gateway',
      text: async () => { throw new Error('stream closed'); },
    }));
    await expect(exchangeCodeForToken('c', 'v')).rejects.toThrow('Token exchange failed (502)');
  });
});

describe('fetchMe', () => {
  it('unwraps the me envelope', async () => {
    const fn = stubFetch(ok({ me: { id: 7, name: 'Test Organizer' } }));
    expect(await fetchMe('tok')).toEqual({ id: 7, name: 'Test Organizer' });

    const [url, init] = callArgs(fn);
    expect(url).toBe(`${WCA_API_URL}/me`);
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('throws with the status text', async () => {
    stubFetch(fail(403, 'Forbidden'));
    await expect(fetchMe('tok')).rejects.toThrow('Failed to fetch user: Forbidden');
  });
});

describe('fetchManagedCompetitions', () => {
  it('requests the organizer-managed page', async () => {
    const fn = stubFetch(ok([{ id: 'Comp2026' }]));
    expect(await fetchManagedCompetitions('tok')).toEqual([{ id: 'Comp2026' }]);

    const [url, init] = callArgs(fn);
    expect(url).toBe(`${WCA_API_URL}/competitions?managed_by_me=true&per_page=50`);
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('throws with the status text', async () => {
    stubFetch(fail(500, 'Server Error'));
    await expect(fetchManagedCompetitions('tok'))
      .rejects.toThrow('Failed to fetch competitions: Server Error');
  });
});

describe('fetchWcif', () => {
  it('fetches the competition WCIF with the token', async () => {
    const fn = stubFetch(ok({ formatVersion: '1.0', id: 'Comp2026' }));
    expect(await fetchWcif('Comp2026', 'tok')).toEqual({ formatVersion: '1.0', id: 'Comp2026' });

    const [url, init] = callArgs(fn);
    expect(url).toBe(`${WCA_API_URL}/competitions/Comp2026/wcif`);
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('throws with the status code, which the generate page renders', async () => {
    stubFetch(fail(404, 'Not Found'));
    await expect(fetchWcif('Nope2026', 'tok')).rejects.toThrow('WCIF fetch failed (404)');
  });
});

// ── The three that never throw ────────────────────────────────────────────────
// Each returns null on any failure so a WCA Live outage degrades the QR codes instead
// of blocking the download. Losing that would turn an outage into a failed generation.

describe('fetchScoretakingSoftware', () => {
  it('reads the field off the single-competition endpoint', async () => {
    const fn = stubFetch(ok({ scoretaking_software: 'internal' }));
    expect(await fetchScoretakingSoftware('Comp2026', 'tok')).toBe('internal');
    expect(callArgs(fn)[0]).toBe(`${WCA_API_URL}/competitions/Comp2026`);
  });

  it('sends no Authorization header when called without a token', async () => {
    // Announced competitions are public; only unannounced ones need the token.
    const fn = stubFetch(ok({ scoretaking_software: 'wca_live' }));
    expect(await fetchScoretakingSoftware('Comp2026')).toBe('wca_live');
    expect(callArgs(fn)[1]?.headers).toEqual({});
  });

  it('returns null when the field is absent', async () => {
    stubFetch(ok({}));
    expect(await fetchScoretakingSoftware('Comp2026')).toBeNull();
  });

  it('returns null rather than throwing on a bad status', async () => {
    stubFetch(fail(404));
    expect(await fetchScoretakingSoftware('Comp2026')).toBeNull();
  });

  it('returns null rather than throwing on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fetchScoretakingSoftware('Comp2026')).toBeNull();
  });
});

describe('fetchWcaLiveId', () => {
  const live = (competitions: unknown) => ok({ data: { competitions } });

  it('matches on wcaId client-side, not on name', async () => {
    // WCA Live's competitions(filter:) matches on *name*, which can differ from the WCA's
    // and resolve to the wrong competition - hence the whole-list fetch and local match.
    const fn = stubFetch(live([
      { id: '11', wcaId: 'Other2026' },
      { id: '42', wcaId: 'Comp2026' },
    ]));
    expect(await fetchWcaLiveId('Comp2026')).toBe('42');

    const [url, init] = callArgs(fn);
    expect(url).toBe('https://live.worldcubeassociation.org/api');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string).query).toContain('competitions');
  });

  it('returns null when no competition matches', async () => {
    stubFetch(live([{ id: '11', wcaId: 'Other2026' }]));
    expect(await fetchWcaLiveId('Comp2026')).toBeNull();
  });

  it('returns null when the payload has no competitions', async () => {
    stubFetch(ok({}));
    expect(await fetchWcaLiveId('Comp2026')).toBeNull();
  });

  it('returns null on a bad status or a network error', async () => {
    stubFetch(fail(503));
    expect(await fetchWcaLiveId('Comp2026')).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fetchWcaLiveId('Comp2026')).toBeNull();
  });
});

describe('fetchWcaLivePersonIds', () => {
  const competitors = (list: unknown) => ok({ data: { competition: { competitors: list } } });

  it('maps registrantId to the WCA Live person id', async () => {
    const fn = stubFetch(competitors([
      { id: 'p1', registrantId: 1 },
      { id: 'p2', registrantId: 2 },
    ]));
    expect(await fetchWcaLivePersonIds('42')).toEqual({ 1: 'p1', 2: 'p2' });

    expect(JSON.parse(callArgs(fn)[1]?.body as string).variables).toEqual({ id: '42' });
  });

  it('returns null, not an empty map, when the competition has no competitors', async () => {
    // The caller stores this in settings.wcaLivePersonIds; an empty object would read as
    // "looked up successfully, nobody has an id" and print QR codes pointing nowhere.
    stubFetch(competitors([]));
    expect(await fetchWcaLivePersonIds('42')).toBeNull();
  });

  it('returns null when the competition is missing from the payload', async () => {
    stubFetch(ok({ data: { competition: null } }));
    expect(await fetchWcaLivePersonIds('42')).toBeNull();
  });

  it('returns null on a bad status or a network error', async () => {
    stubFetch(fail(500));
    expect(await fetchWcaLivePersonIds('42')).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fetchWcaLivePersonIds('42')).toBeNull();
  });
});
