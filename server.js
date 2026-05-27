'use strict';

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');

const DIST_DIR = path.join(__dirname, 'dist');
const INDEX_PATH = path.join(DIST_DIR, 'index.html');
const PORT = Number(process.env.PORT || 8080);

// Injected server-side so the secret is never exposed in the browser bundle.
const WCA_CLIENT_SECRET = process.env.WCA_CLIENT_SECRET;

const app = express();
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://www.worldcubeassociation.org'],
        connectSrc: [
          "'self'",
          'https://www.worldcubeassociation.org',
          'https://live.worldcubeassociation.org',
        ],
        manifestSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// WCA OAuth token proxy.
// WCA's /oauth/token has no CORS headers, so the browser cannot call it
// directly. Requests arrive here, the client_secret is appended, then
// the request is forwarded to WCA.
app.post('/wca-token', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const params = new URLSearchParams(req.body);
    if (WCA_CLIENT_SECRET) params.set('client_secret', WCA_CLIENT_SECRET);

    const wcaRes = await fetch('https://www.worldcubeassociation.org/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const body = await wcaRes.text();
    res.status(wcaRes.status).type('application/json').send(body);
  } catch {
    res.status(502).json({ error: 'Token exchange failed' });
  }
});

// Hashed assets are content-addressed — safe to cache for 1 year.
app.use(
  '/assets',
  express.static(path.join(DIST_DIR, 'assets'), {
    immutable: true,
    maxAge: '1y',
    index: false,
  }),
);

// Other static files (favicons, manifest, etc.).
app.use(express.static(DIST_DIR, { maxAge: 0, index: false }));

// Unknown file extensions → 404 (don't fall through to SPA handler).
app.use((req, res, next) => {
  if (path.extname(req.path)) {
    res.status(404).type('text/plain; charset=utf-8').send('Not found');
    return;
  }
  next();
});

// SPA fallback — every non-file route serves index.html.
app.use((req, res) => {
  fs.readFile(INDEX_PATH, 'utf8', (err, html) => {
    if (err) {
      res
        .status(500)
        .type('text/plain; charset=utf-8')
        .send('Missing dist/index.html — run npm run build first.');
      return;
    }
    res
      .status(200)
      .type('text/html; charset=utf-8')
      .set('Cache-Control', 'no-store')
      .send(html);
  });
});

const server = app.listen(PORT, () => {
  console.log(`Scorecard server listening on port ${PORT}`);
});

process.on('SIGTERM', () =>
  server.close(() => console.log('Process terminated')),
);
