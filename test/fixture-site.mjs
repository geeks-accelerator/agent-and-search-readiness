// A fixture site for the end-to-end test: audit() runs against it with --base, on localhost.
// Domain terms: https://fixture.example.
// Deliberate problems, each one a check should report:
//   /about       inherits the homepage's twitter:title       -> W5 fails
//   /docs/guide  jumps from h1 to h3                          -> W6 warns
//   /docs/guide  markdown copy lacks a section, and no .md URL -> D8 warns
//   /brotli      answers a Brotli body nobody asked for       -> refused, so W1 sees no title
//   /old         llms.txt links it; it 301s to /about         -> D4 warns
//   /privacy     llms.txt links it; llms-full.txt doesn't      -> D4 warns
//   /mapped      llms.txt links it; it 302s to this server at [::ffff:127.0.0.1] -> refused, D4 warns
// llms.txt links a sibling site's API, which doesn't give this site one (has_api stays false).
// robots.txt blocks BadBot entirely, which is stricter than *, so D1 still passes.
// With { api: true } it also serves an API, its docs, an API catalog and a skills index (apiRoutes below).
// Everything else is meant to pass. Each request is logged in combined format, for --logs.
import { createServer } from 'node:http';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';

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
<script type="application/ld+json">${JSON.stringify([{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Fixture', url: D, sameAs: ['https://github.com/example/fixture', 'https://www.npmjs.com/package/fixture'] }, { '@context': 'https://schema.org', '@type': 'Organization', name: 'Fixture', url: D }, ...extraLd])}</script>
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
const llms = `# Fixture\n\n> A fixture site for readiness-audit.\n\n- [About](${D}/about)\n- [Guide](${D}/docs/guide)\n- [Old page](${D}/old)\n- [Items](${D}/items)\n- [Privacy](${D}/privacy)\n- [Mapped](${D}/mapped)\n- For pets, use [the sibling's API](https://sibling.example/api/v1).\n`;
// The catalog: each page's link and summary, not its full text. It leaves out /privacy.
const llmsFull = `# Fixture\n\n> A fixture site for readiness-audit.\n\n## Pages\n\n${[['About', '/about'], ['Guide', '/docs/guide'], ['Items', '/items']].map(([t, p]) => `### [${t}](${D}${p})\n\n${pages[p].match(/name="description" content="([^"]+)"/)[1]}\n`).join('\n')}`;

// The API surfaces, served with { api: true }: path -> [status, headers, body].
const json = (status, body, type = 'application/json') => [status, { 'content-type': type }, JSON.stringify(body)];
const md = (body) => [200, { 'content-type': 'text/markdown; charset=utf-8' }, body];
const openapiDoc = {
  openapi: '3.1.0',
  info: { title: 'Fixture API', version: '1.0.0' },
  paths: {
    '/api/pets': { get: { summary: 'List pets', description: 'List the fixture pets. Call it first, to find a pet\'s id.', parameters: [{ name: 'limit', in: 'query', description: 'How many pets to return.', schema: { type: 'integer' } }], responses: { 200: { description: 'The pets', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Pet' } } } } }, 400: { description: 'A limit that isn\'t a number', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } } },
    '/api/me': { get: { summary: 'Your pet', description: 'Read the pet your key owns. Call it after registering.', security: [{ bearer: [] }], responses: { 200: { description: 'Your pet', content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } }, 401: { description: 'No key, or a wrong one' } } } },
  },
  components: {
    schemas: {
      Pet: { type: 'object', properties: { id: { type: 'string', description: 'The pet\'s id.' }, name: { type: 'string', description: 'The pet\'s name.' } } },
      Error: { type: 'object', properties: { error: { type: 'string', description: 'What went wrong.' }, suggestion: { type: 'string', description: 'What to do next.' } } },
    },
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
  },
};
const skillMd = {
  care: `---\nname: care\ndescription: Use when the user wants to look after a fixture pet, or asks how it is doing.\n---\n# Care\n\nStart with [llms.txt](${D}/llms.txt). The calls are in [the API reference](${D}/openapi.json).\n`,
  feed: `---\nname: feed\ndescription: Feeds a fixture pet through the API.\n---\n# Feed\n\nStart with [llms.txt](${D}/llms.txt). The calls are in [the API reference](${D}/openapi.json).\n`,
};
const sha = (t) => `sha256:${createHash('sha256').update(t).digest('hex')}`;
const apiRoutes = {
  '/openapi.json': json(200, openapiDoc),
  '/api': json(200, { name: 'Fixture API', openapi: `${D}/openapi.json`, endpoints: ['GET /api/pets', 'GET /api/me'] }),
  '/api/pets': json(200, [{ id: 'p1', name: 'Rex' }]),
  '/api/me': json(401, { error: 'unauthorized', suggestion: 'Send Authorization: Bearer <key>. Get a key at POST /api/register.' }),
  '/.well-known/api-catalog': json(200, { linkset: [
    { anchor: `${D}/.well-known/api-catalog`, item: [{ href: `${D}/api` }] },
    { anchor: `${D}/api`, 'service-desc': [{ href: `${D}/openapi.json`, type: 'application/vnd.oai.openapi+json' }], 'service-doc': [{ href: `${D}/docs/api`, type: 'text/html' }] },
  ] }, 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"'),
  '/.well-known/agent-skills/index.json': json(200, { $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json', skills: Object.entries(skillMd).map(([name, text]) => ({ name, type: 'skill-md', description: `The ${name} skill.`, url: `/.well-known/agent-skills/${name}/SKILL.md`, digest: sha(text) })) }),
  ...Object.fromEntries(Object.entries(skillMd).map(([name, text]) => [`/.well-known/agent-skills/${name}/SKILL.md`, md(text)])),
  '/auth.md': md('# Auth\n\nSend `Authorization: Bearer <key>`. Get a key at `POST /api/register`; a wrong key answers 401 with a suggestion.\n'),
  '/docs/api.md': md('# Fixture API\n\n## GET /api/pets\n\nList the pets.\n'),
};

function send(req, res, status, headers, body) {
  const gz = /gzip/.test(req.headers['accept-encoding'] ?? '') && typeof body === 'string' && body.length > 200;
  const out = gz ? gzipSync(body) : body;
  res.writeHead(status, { ...headers, ...(gz ? { 'content-encoding': 'gzip' } : {}) });
  res.end(req.method === 'HEAD' ? undefined : out);
}

/** Starts the fixture on a free port: { base, log (lines), maxInFlight, close }.
 *  `delay` holds each answer for that many ms, so requests overlap and maxInFlight counts them.
 *  `full` picks the llms-full.txt: 'catalog', 'none' or 'huge'.
 *  `malformed` adds /malformed (a canonical and og:image that aren't URLs) and /bad-location
 *  (a Location that isn't one) to the sitemap. */
export async function startFixture({ allow = 'GET, HEAD', delay = 0, malformed = false, api = false, full = 'catalog' } = {}) {
  const extra = malformed ? ['/malformed', '/bad-location'] : [];
  const log = [];
  let inFlight = 0, maxInFlight = 0;
  const srv = createServer(async (req, res) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    res.on('close', () => inFlight--);
    if (delay) await new Promise((r) => setTimeout(r, delay));
    handle(req, res);
  });
  const handle = (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  res.on('finish', () => log.push(`127.0.0.1 - - [21/Oct/2026:12:00:00 +0000] "${req.method} ${req.url} HTTP/1.1" ${res.statusCode} 0 "-" "${req.headers['user-agent'] ?? '-'}"`));
  const html = { 'content-type': 'text/html; charset=utf-8', vary: 'Accept' };
  const link = ['</llms.txt>; rel="describedby"; type="text/plain"', ...(api ? ['</openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"', '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"'] : [])].join(', ');
  const wantsMd = /text\/markdown/.test(req.headers.accept ?? '');

  if (api && apiRoutes[path]) { const [status, headers, body] = apiRoutes[path]; return send(req, res, status, headers, body); }
  if (api && path.startsWith('/api/')) return send(req, res, 404, { 'content-type': 'application/json' }, '{"error":"not_found","next_steps":["GET /api lists the endpoints"]}');
  if (req.method === 'POST' && path === '/') return send(req, res, 405, { 'content-type': 'application/json', ...(allow ? { allow } : {}) }, '{"error":"method_not_allowed","next_steps":["GET /llms.txt"]}');
  if (path === '/robots.txt') return send(req, res, 200, { 'content-type': 'text/plain' }, ['User-agent: *', 'Content-Signal: search=yes, ai-input=yes, ai-train=no', 'Disallow: /private', '', ...['GPTBot', 'ClaudeBot', 'PerplexityBot'].flatMap((b) => [`User-agent: ${b}`, 'Content-Signal: search=yes, ai-input=yes, ai-train=no', 'Disallow: /private', '']), 'User-agent: BadBot', 'Content-Signal: search=yes, ai-input=yes, ai-train=no', 'Disallow: /', '', `Sitemap: ${D}/sitemap.xml`].join('\n'));
  if (path === '/sitemap.xml') return send(req, res, 200, { 'content-type': 'application/xml' }, `<?xml version="1.0"?><sitemapindex><sitemap><loc>${D}/sitemap-static.xml</loc><lastmod>2026-01-01</lastmod></sitemap><sitemap><loc>${D}/sitemap-items.xml</loc><lastmod>2026-01-01</lastmod></sitemap></sitemapindex>`);
  if (path === '/sitemap-static.xml') return send(req, res, 200, { 'content-type': 'application/xml' }, sitemap([...staticPaths, ...extra]));
  if (path === '/sitemap-items.xml') return send(req, res, 200, { 'content-type': 'application/xml' }, sitemap(items.map((id) => `/items/${id}`)));
  if (path === '/llms.txt') return send(req, res, 200, { 'content-type': 'text/plain; charset=utf-8' }, llms);
  // full: 'catalog' (the default), 'none' (no llms-full.txt; it's optional) or 'huge' (more than one fetch reads).
  if (path === '/llms-full.txt' && full !== 'none') return send(req, res, 200, { 'content-type': 'text/plain; charset=utf-8' }, full === 'huge' ? `${llmsFull}\n## Everything\n\n${'Every word of every page. '.repeat(5000)}` : llmsFull);
  if (path === '/.well-known/security.txt') return send(req, res, 200, { 'content-type': 'text/plain' }, 'Contact: mailto:security@fixture.example\nExpires: 2027-06-01T00:00:00Z\n');
  if (path === '/og.png') return send(req, res, 200, { 'content-type': 'image/png' }, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (malformed && path === '/malformed') return send(req, res, 200, html, page({ path, title: 'A malformed fixture page', desc: 'A page whose canonical and share image are not URLs, so the audit has to report them instead of stopping.' }).replace(`href="${D}${path}"`, 'href="http://["').replace(`content="${D}/og.png"`, 'content="http://["'));
  if (malformed && path === '/bad-location') return send(req, res, 301, { location: 'http://[' }, '');
  if (path === '/mapped') return send(req, res, 302, { location: `http://[::ffff:127.0.0.1]:${req.socket.localPort}/about` }, '');
  if (path === '/old') return send(req, res, 301, { location: `${D}/about` }, '');
  if (path === '/brotli') { res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'br' }); return res.end(brotliCompressSync(pages['/'])); }
  if (path.startsWith('/.well-known/')) return send(req, res, 404, { 'content-type': 'application/json' }, `{"error":"not_found","llms":"${D}/llms.txt"}`);
  if (path === '/index.md') return send(req, res, 200, { 'content-type': 'text/markdown; charset=utf-8' }, llms);
  if (wantsMd && path === '/') return send(req, res, 200, { 'content-type': 'text/markdown; charset=utf-8', vary: 'Accept' }, llms);
  if (wantsMd && path === '/docs/guide') return send(req, res, 200, { 'content-type': 'text/markdown; charset=utf-8', vary: 'Accept' }, '# Guide\n\n## Run it\n\nSteps.\n');
  // The API fixture's homepage reaches its API through a developers page, the way agents find it. Its /docs is content, and doesn't count.
  if (api && path === '/') return send(req, res, 200, { ...html, link }, pages['/'].replace('<p>Body text.</p>', '<p>Body text. Read the <a href="/docs/chants">chants</a>.</p><footer><a href="/developers/">For <b>developers</b></a></footer>'));
  if (api && path === '/docs/api') return send(req, res, 200, { ...html, link }, page({ path, title: 'Fixture API reference', desc: 'Every operation the fixture API offers, with its parameters, its responses and the errors it can return.' }));
  if (pages[path]) return send(req, res, 200, { ...html, link }, pages[path]);
  if (wantsMd) return send(req, res, 404, { 'content-type': 'text/markdown; charset=utf-8', vary: 'Accept' }, `# Not found\n\nNothing at ${path}. Start at [llms.txt](${D}/llms.txt).\n`);
  return send(req, res, 404, { 'content-type': 'text/html', vary: 'Accept' }, '<!doctype html><title>Not found</title><h1>Not found</h1>');
  };
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { base: `http://localhost:${srv.address().port}`, log, get maxInFlight() { return maxInFlight; }, close: () => new Promise((r) => { srv.closeAllConnections(); srv.close(r); }) };
}
