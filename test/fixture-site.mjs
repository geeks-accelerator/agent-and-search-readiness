// A fixture site for the end-to-end test: audit() runs against it with --base, on localhost.
// Domain terms: https://fixture.example.
// Deliberate problems, each one a check should report:
//   /about       inherits the homepage's twitter:title       -> W5 fails
//   /docs/guide  jumps from h1 to h3                          -> W6 warns
//   /docs/guide  markdown copy lacks a section                -> D8 warns
//   /brotli      answers a Brotli body nobody asked for       -> refused, so W1 sees no title
//   /old         llms.txt links it; it 301s to /about         -> D4 warns
// Everything else is meant to pass. Each request is logged in combined format, for --logs.
import { createServer } from 'node:http';
import { gzipSync, brotliCompressSync } from 'node:zlib';

const D = 'https://fixture.example';

const homeTitle = 'Fixture Home | fixture.example';
const homeDesc = 'A fixture site for testing readiness-audit locally: static pages, one template, a sitemap index and a few deliberate problems.';
const items = Array.from({ length: 25 }, (_, i) => `item-${i + 1}`);

const page = ({ path, title, desc, h = '<h1>Page</h1>', twitterTitle, extraLd = [] }) => `<!doctype html><html lang="en"><head>
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${D}${path}">
<meta property="og:type" content="website"><meta property="og:url" content="${D}${path}">
<meta property="og:title" content="${title}"><meta property="og:description" content="${desc}">
<meta property="og:image" content="${D}/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${title}">
<meta name="twitter:card" content="summary_large_image">${twitterTitle ? `<meta name="twitter:title" content="${twitterTitle}">` : ''}
<script type="application/ld+json">${JSON.stringify([{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Fixture', url: D }, { '@context': 'https://schema.org', '@type': 'Organization', name: 'Fixture', url: D }, ...extraLd])}</script>
</head><body><nav><h2>Menu</h2></nav><main>${h}<p>Body text.</p><img src="/x.png" alt="x"></main><footer><h4>Links</h4></footer></body></html>`;

const crumbs = (path) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Items', item: `${D}/items` }, { '@type': 'ListItem', position: 2, name: path, item: `${D}${path}` }] });

const pages = {
  '/': page({ path: '/', title: homeTitle, desc: homeDesc, h: '<h1>Fixture</h1><h2>What it is</h2><h2>How to start</h2>' }),
  '/about': page({ path: '/about', title: 'About the fixture site', desc: 'Who made the fixture site, why it exists, and what each of its deliberate problems is meant to test.', twitterTitle: homeTitle }),
  '/privacy': page({ path: '/privacy', title: 'Privacy at the fixture site', desc: 'What the fixture site records about visitors: nothing beyond a local access log used to test the logs command.' }),
  '/docs/guide': page({ path: '/docs/guide', title: 'Fixture guide', desc: 'How to run readiness-audit against the fixture site with --base, and what each check should report back.', h: '<h1>Guide</h1><h3>Install</h3><h2>Run it</h2><h2>Read the results</h2>' }),
  '/items': page({ path: '/items', title: 'All fixture items', desc: 'Every generated item on the fixture site, listed so the template sampling has a collection page to read.' }),
  ...Object.fromEntries(items.map((id) => [`/items/${id}`, page({ path: `/items/${id}`, title: `Fixture item ${id}`, desc: `Generated fixture page for ${id}, one of twenty-five pages that share a template under the items path.`, extraLd: [crumbs(`/items/${id}`)] })])),
};

const sitemap = (urls) => `<?xml version="1.0"?><urlset>${urls.map((u, i) => `<url><loc>${D}${u}</loc><lastmod>2026-10-${String((i % 20) + 1).padStart(2, '0')}</lastmod></url>`).join('')}</urlset>`;
const staticPaths = ['/', '/about', '/privacy', '/docs/guide', '/items', '/brotli'];
const llms = `# Fixture\n\n> A fixture site for readiness-audit.\n\n- [About](${D}/about)\n- [Guide](${D}/docs/guide)\n- [Old page](${D}/old)\n- [Items](${D}/items)\n`;

function send(req, res, status, headers, body) {
  const gz = /gzip/.test(req.headers['accept-encoding'] ?? '') && typeof body === 'string' && body.length > 200;
  const out = gz ? gzipSync(body) : body;
  res.writeHead(status, { ...headers, ...(gz ? { 'content-encoding': 'gzip' } : {}) });
  res.end(req.method === 'HEAD' ? undefined : out);
}

/** Starts the fixture on a free port: { base, log (lines), close }. */
export async function startFixture({ allow = 'GET, HEAD' } = {}) {
  const log = [];
  const srv = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  res.on('finish', () => log.push(`127.0.0.1 - - [21/Oct/2026:12:00:00 +0000] "${req.method} ${req.url} HTTP/1.1" ${res.statusCode} 0 "-" "${req.headers['user-agent'] ?? '-'}"`));
  const html = { 'content-type': 'text/html; charset=utf-8', vary: 'Accept' };
  const link = '</llms.txt>; rel="describedby"; type="text/plain"';
  const wantsMd = /text\/markdown/.test(req.headers.accept ?? '');

  if (req.method === 'POST' && path === '/') return send(req, res, 405, { 'content-type': 'application/json', ...(allow ? { allow } : {}) }, '{"error":"method_not_allowed","next_steps":["GET /llms.txt"]}');
  if (path === '/robots.txt') return send(req, res, 200, { 'content-type': 'text/plain' }, ['User-agent: *', 'Content-Signal: search=yes, ai-input=yes, ai-train=no', 'Disallow: /private', '', ...['GPTBot', 'ClaudeBot', 'PerplexityBot'].flatMap((b) => [`User-agent: ${b}`, 'Content-Signal: search=yes, ai-input=yes, ai-train=no', 'Disallow: /private', '']), `Sitemap: ${D}/sitemap.xml`].join('\n'));
  if (path === '/sitemap.xml') return send(req, res, 200, { 'content-type': 'application/xml' }, `<?xml version="1.0"?><sitemapindex><sitemap><loc>${D}/sitemap-static.xml</loc><lastmod>2026-01-01</lastmod></sitemap><sitemap><loc>${D}/sitemap-items.xml</loc><lastmod>2026-01-01</lastmod></sitemap></sitemapindex>`);
  if (path === '/sitemap-static.xml') return send(req, res, 200, { 'content-type': 'application/xml' }, sitemap(staticPaths));
  if (path === '/sitemap-items.xml') return send(req, res, 200, { 'content-type': 'application/xml' }, sitemap(items.map((id) => `/items/${id}`)));
  if (path === '/llms.txt') return send(req, res, 200, { 'content-type': 'text/plain; charset=utf-8' }, llms);
  if (path === '/llms-full.txt') return send(req, res, 200, { 'content-type': 'text/plain; charset=utf-8' }, `${llms}\n## Everything\n\n${'Full text. '.repeat(100)}`);
  if (path === '/.well-known/security.txt') return send(req, res, 200, { 'content-type': 'text/plain' }, 'Contact: mailto:security@fixture.example\nExpires: 2027-06-01T00:00:00Z\n');
  if (path === '/og.png') return send(req, res, 200, { 'content-type': 'image/png' }, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (path === '/old') return send(req, res, 301, { location: `${D}/about` }, '');
  if (path === '/brotli') { res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'br' }); return res.end(brotliCompressSync(pages['/'])); }
  if (path.startsWith('/.well-known/')) return send(req, res, 404, { 'content-type': 'application/json' }, `{"error":"not_found","llms":"${D}/llms.txt"}`);
  if (wantsMd && path === '/') return send(req, res, 200, { 'content-type': 'text/markdown; charset=utf-8', vary: 'Accept' }, llms);
  if (wantsMd && path === '/docs/guide') return send(req, res, 200, { 'content-type': 'text/markdown; charset=utf-8', vary: 'Accept' }, '# Guide\n\n## Run it\n\nSteps.\n');
  if (pages[path]) return send(req, res, 200, { ...html, link }, pages[path]);
  return send(req, res, 404, { 'content-type': 'text/html' }, '<!doctype html><title>Not found</title><h1>Not found</h1>');
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { base: `http://localhost:${srv.address().port}`, log, close: () => new Promise((r) => { srv.closeAllConnections(); srv.close(r); }) };
}
