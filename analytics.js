// Sanitiser for the anonymous usage events posted to POST /api/event by src/lib/analytics.ts.
// The endpoint is public and unauthenticated, so nothing here trusts the body.
//
// Deliberately structural rather than a field whitelist: a whitelist duplicated between
// client and server silently drops any field added on one side only, and the payload is
// expected to grow. What matters at this boundary is that a log line can't be made huge,
// deep, or self-describing - not which stat names are in fashion this month.

const EVENTS = new Set(['generate', 'error', 'session']);
const MAX_STRING = 120;
const MAX_KEYS = 40;
// Arrays hold scalars only, so this is the whole bound on them - see sanitizeValue.
const MAX_ARRAY = 20;
// One level of objects below the top-level event: `{ comp: { id } }` survives,
// `{ comp: { venue: { id } } }` loses the third level.
const MAX_NESTING = 1;
// Assigning these would rewrite the output object's prototype.
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** A scalar the log can carry as-is, or `undefined` to drop the field. */
function sanitizeScalar(value) {
  if (typeof value === 'string') return value.slice(0, MAX_STRING);
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean' || value === null) return value;
  return undefined;
}

/**
 * `depth` is how many further levels of object nesting are still allowed. Arrays don't
 * spend it: they may only hold scalars, so MAX_ARRAY already bounds them.
 */
function sanitizeValue(value, depth) {
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value.slice(0, MAX_ARRAY)) {
      const clean = sanitizeScalar(item);
      if (clean !== undefined) out.push(clean);
    }
    return out;
  }
  if (value !== null && typeof value === 'object') {
    if (depth <= 0) return undefined;
    return sanitizeObject(value, depth - 1);
  }
  return sanitizeScalar(value);
}

function sanitizeObject(obj, depth) {
  const out = {};
  let kept = 0;
  for (const [key, value] of Object.entries(obj)) {
    if (kept >= MAX_KEYS) break;
    if (FORBIDDEN_KEYS.has(key)) continue;
    const clean = sanitizeValue(value, depth);
    if (clean === undefined) continue;
    out[key.slice(0, MAX_STRING)] = clean;
    kept++;
  }
  return out;
}

/**
 * The event to log, or `null` if the body isn't one of ours. Callers must not tell the
 * sender which it was - see the endpoint in server.js.
 */
export function sanitizeEvent(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (body.v !== 1 || !EVENTS.has(body.event)) return null;
  return sanitizeObject(body, MAX_NESTING);
}
