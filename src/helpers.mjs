// Pure helpers for the checks in audit.mjs, kept apart so the tests can run
// them without a network. Internal: the package exports only audit.mjs.

/** The Agent Skills spec's name rule: lowercase letters, digits and single hyphens, 1 to 64 characters. */
export const SKILL_NAME = /^(?!-)(?!.*--)[a-z0-9-]{1,64}(?<!-)$/;

/**
 * Up to five SKILL.md entries from a skills index, spread across it. Archive
 * entries are skipped: the scorecard reads SKILL.md text, not zip bytes. An
 * entry without a type counts when its URL ends in .md (older indexes).
 */
export function sampleSkillEntries(list) {
  const md = (Array.isArray(list) ? list : []).filter((e) => typeof e?.url === 'string'
    && (e.type === 'skill-md' || (e.type === undefined && /\.md$/i.test(e.url.split(/[?#]/)[0]))));
  return spread(md, 5);
}

/** Up to n items, spread evenly across the list (the first item always included). */
export function spread(list, n) {
  return list.length <= n ? list : Array.from({ length: n }, (_, i) => list[Math.floor((i * list.length) / n)]);
}

/**
 * Each supported Node line at its current security release (the 2026-10-21 release fixed a
 * Brotli decoder bug and TLS hostname bypasses in all three). TLS checks and the decoders are
 * Node's, so being on a line's latest security release matters more than which line. End-of-life
 * and odd-numbered lines get no security releases and are refused. Raise these after each Node
 * security release, with package.json's engines and the docs (a test checks they agree).
 */
export const NODE_LINES = { 22: '22.23.4', 24: '24.22.1', 26: '26.12.1' };
export const NODE_REQUIREMENT = `Node ${Object.values(NODE_LINES).slice(0, -1).join(', ')} or ${Object.values(NODE_LINES).at(-1)}, or later on the same line`;

/** Whether a Node version is a supported line at its security release, or an even line newer than these. */
export function nodeOk(version) {
  const parts = (v) => v.split('.').map(Number);
  const atLeast = (v, min) => { const [a, b] = [parts(v), parts(min)]; const i = a.findIndex((n, j) => n !== b[j]); return i < 0 || a[i] > b[i]; };
  const major = parts(version)[0];
  const newest = Math.max(...Object.keys(NODE_LINES).map(Number));
  if (major > newest) return major % 2 === 0; // an even line newer than this release knows; odd lines get no long-term support
  return NODE_LINES[major] !== undefined && atLeast(version, NODE_LINES[major]);
}

/** Up to three items, then how many more: "a, b, c, +4 more". */
export function list(xs, sep = ', ') {
  return `${xs.slice(0, 3).join(sep)}${xs.length > 3 ? `, +${xs.length - 3} more` : ''}`;
}

/** A URL for comparison: lowercase host, no trailing slash, no fragment. The query stays. */
export function norm(u) {
  try { const x = new URL(u); return `${x.protocol}//${x.host.toLowerCase()}${x.pathname.replace(/\/+$/, '') || '/'}${x.search}`; } catch { return u; }
}

/** A URL's or a path's path segments: / is [], /docs/mcp is ['docs', 'mcp']. */
export function pathSegments(u) {
  try { return new URL(u, 'https://x.invalid').pathname.split('/').filter(Boolean); } catch { return []; }
}

/** How many segments a URL's or a path's path has: / is 0, /about is 1, /docs/mcp is 2. */
export const pathDepth = (u) => pathSegments(u).length;

/** HTML text as plain text: entities decoded, whitespace collapsed. */
export function decodeText(t) {
  const named = { quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return String(t ?? '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(quot|apos|lt|gt|nbsp);/g, (_, k) => named[k])
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

/**
 * A page's headings in order, as { level, text }. Navigation, footers, asides and
 * screen-reader-only headings aren't part of the page's structure, so they're left out.
 * A <header> stays: pages often put their title h1 inside <article><header>.
 */
export function headings(html) {
  const body = String(html ?? '')
    .replace(/<(nav|footer|aside)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<h([1-6])\b[^>]*class="[^"]*\b(visually-hidden|sr-only)\b[^"]*"[^>]*>[\s\S]*?<\/h\1>/gi, '');
  return [...body.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({ level: Number(m[1]), text: decodeText(m[2].replace(/<[^>]+>/g, ' ')) }));
}

/** Where headings skip a level going down (h1 then h3), as "h1 to h3". Going back up is fine. */
export function headingSkips(hs) {
  const skips = [];
  for (let i = 1; i < hs.length; i++) if (hs[i].level > hs[i - 1].level + 1) skips.push(`h${hs[i - 1].level} to h${hs[i].level}`);
  return skips;
}

/**
 * schema.org types that can earn a Google rich result, by the feature Google's search gallery
 * names (read 2026-10-21; the gallery was updated 2026-10-16). FAQ and HowTo aren't there anymore.
 */
export const GOOGLE_RICH_RESULTS = {
  Article: ['Article', 'NewsArticle', 'BlogPosting'], Breadcrumb: ['BreadcrumbList'], 'Course list': ['Course'], Dataset: ['Dataset'],
  'Discussion forum': ['DiscussionForumPosting'], 'Education Q&A': ['Quiz'], 'Employer aggregate rating': ['EmployerAggregateRating'],
  Event: ['Event'], 'Image metadata': ['ImageObject'], 'Job posting': ['JobPosting'], 'Local business': ['LocalBusiness'],
  'Math solver': ['MathSolver'], Movie: ['Movie'], Organization: ['Organization'], Product: ['Product'], 'Profile page': ['ProfilePage'],
  'Q&A': ['QAPage'], Recipe: ['Recipe'], 'Review snippet': ['Review', 'AggregateRating'],
  'Software app': ['SoftwareApplication', 'MobileApplication', 'WebApplication', 'VideoGame'], 'Vacation rental': ['VacationRental'], Video: ['VideoObject'],
};
const RICH_FEATURE = new Map(Object.entries(GOOGLE_RICH_RESULTS).flatMap(([feature, types]) => types.map((t) => [t, feature])));

/**
 * The pages to run through Google's Rich Results Test. Pages from one template share their markup,
 * so one page tests them all; each template is its own code, so each one with rich-result markup is
 * listed once. Candidates come in order (the homepage, the template pages, then the rest), each
 * { url, types, template } with template the page's template pattern, if any; a page outside a
 * template is kept only when it adds a feature no kept page has.
 * Returns up to `max` { url, features, test }.
 */
export function richResultPages(pages, max = 8) {
  const seen = new Set();
  const listedTemplates = new Set();
  const out = [];
  for (const p of pages) {
    const features = [...new Set((p.types ?? []).map((t) => RICH_FEATURE.get(t)).filter(Boolean))].sort();
    if (!features.length || listedTemplates.has(p.template)) continue;
    if (!p.template && !features.some((f) => !seen.has(f))) continue;
    if (p.template) listedTemplates.add(p.template);
    features.forEach((f) => seen.add(f));
    out.push({ url: p.url, features, test: `https://search.google.com/test/rich-results?url=${encodeURIComponent(p.url)}` });
    if (out.length === max) break;
  }
  return out;
}

/** A sitemap's entries, urlset or index, as { loc, lastmod } (lastmod undefined when absent). */
export function sitemapEntries(xml) {
  return [...String(xml ?? '').matchAll(/<(url|sitemap)>([\s\S]*?)<\/\1>/g)].map((m) => ({
    loc: m[2].match(/<loc>\s*([^<\s]+)\s*<\/loc>/)?.[1]?.replace(/&amp;/g, '&'),
    lastmod: m[2].match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/)?.[1],
  })).filter((e) => e.loc);
}

/**
 * The discovery files the audit reads, by name. --logs counts requests for the same paths,
 * so what the scorecard checks and what the logs measure can't drift apart.
 */
export const DISCOVERY_FILES = {
  robots: '/robots.txt',
  sitemap: '/sitemap.xml',
  llms: '/llms.txt',
  llmsFull: '/llms-full.txt',
  openapi: '/openapi.json',
  apiIndex: '/api',
  apiCatalog: '/.well-known/api-catalog',
  security: '/.well-known/security.txt',
  authMd: '/auth.md',
  docsMd: '/docs/api.md',
  agentCard: '/.well-known/agent-card.json',
  ard: '/.well-known/ard.json',
  aiCatalog: '/.well-known/ai-catalog.json',
  skills: '/.well-known/agent-skills/index.json',
  prm: '/.well-known/oauth-protected-resource',
  asMeta: '/.well-known/oauth-authorization-server',
  aiPlugin: '/.well-known/ai-plugin.json',
  legacyCard: '/.well-known/mcp.json',
  wkCard: '/.well-known/mcp/server-card.json',
};

/** The AI crawlers and assistant fetchers D15 wants named in robots.txt, as robots.txt user-agent tokens. */
export const AI_BOTS = ['gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'claude-user', 'claude-searchbot', 'perplexitybot', 'perplexity-user', 'google-extended', 'applebot-extended'];

/**
 * Section headings (h1 to h3) the HTML page has and its markdown copy lacks, compared as
 * lowercase words so formatting doesn't count. Page chrome is left out, as in headings().
 * An empty list when they agree.
 */
export function missingSections(html, markdown) {
  const words = (t) => decodeText(t).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const htmlHeads = headings(html).filter((h) => h.level <= 3 && words(h.text));
  const mdHeads = new Set([...String(markdown ?? '').matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)].map((m) => words(m[1].replace(/[*_`[\]]|\]\([^)]*\)/g, ' '))));
  return [...new Set(htmlHeads.filter((h) => !mdHeads.has(words(h.text))).map((h) => h.text))];
}

/** Text that links an API reference or an MCP reference: what S1 wants in a skill, and what declares an API. */
export const API_LINK = /openapi|\/docs\/api|https?:\/\/[^\s)]+\/api\b/i;
export const MCP_LINK = /\/docs\/mcp|https?:\/\/[^\s)]+\/mcp\b/i;

/** An RFC 8288 Link header as a Map of rel to hrefs. */
export function linkRels(header) {
  const rels = new Map();
  for (const part of String(header ?? '').split(/,(?=\s*<)/)) {
    const href = part.match(/<([^>]+)>/)?.[1];
    const relAttr = part.match(/rel="?([^";]+)"?/)?.[1];
    if (href && relAttr) for (const r of relAttr.split(/\s+/)) rels.set(r, [...(rels.get(r) ?? []), href]);
  }
  return rels;
}

/**
 * Whether a site has a public API, the way the audit decides it has a hosted MCP endpoint:
 * one answers (/openapi.json is an OpenAPI document, or /api answers JSON), or the site
 * declares one (a service-desc naming an OpenAPI document, an API catalog, an API link in
 * llms.txt). A declared API gets the API checks even when nothing answers: claims get checked.
 * Returns { present, answers, declared } with declared naming where the claims are.
 */
export function apiPresence({ openapiSpec, apiIndexJson, rels, catalogJson, llmsText }) {
  const answers = Boolean(openapiSpec?.openapi) || Boolean(apiIndexJson);
  const declared = [];
  if ((rels?.get('service-desc') ?? []).some((h) => /openapi/i.test(h))) declared.push('a service-desc Link');
  if (Array.isArray(catalogJson?.linkset) && catalogJson.linkset.length) declared.push('/.well-known/api-catalog');
  if (llmsText && API_LINK.test(llmsText)) declared.push('llms.txt');
  return { present: answers || declared.length > 0, answers, declared };
}

/**
 * The pages the W checks read: every kind of page, not a spread that a big template drowns out.
 * URLs are grouped by template, the first path segment plus the depth (/creatures/a/b and
 * /creatures/c/d share /creatures/*\/*; one-segment pages share /*; / is its own). A group of
 * up to 20 URLs is static pages, all read; a bigger group is a template, three read with spread().
 * Templates come first, then static pages by shortest path, up to `cap` pages.
 * Returns { pages, templates: [{ pattern, count, urls }], static: number read, skipped: static pages not read }.
 */
export function samplePages(urls, { cap = 40, staticMax = 20, perTemplate = 3 } = {}) {
  const pattern = (u) => {
    const segs = pathSegments(u);
    return segs.length === 0 ? '/' : segs.length === 1 ? '/*' : `/${segs[0]}/${Array(segs.length - 1).fill('*').join('/')}`;
  };
  const groups = new Map();
  for (const u of urls) groups.set(pattern(u), [...(groups.get(pattern(u)) ?? []), u]);
  const templates = [...groups].filter(([, us]) => us.length > staticMax).map(([p, us]) => ({ pattern: p, count: us.length, urls: spread(us, perTemplate) }));
  const statics = [...groups].filter(([, us]) => us.length <= staticMax).flatMap(([, us]) => us)
    .map((u, i) => ({ u, i, d: pathDepth(u), n: u.length })).sort((a, b) => a.d - b.d || a.n - b.n || a.i - b.i).map((x) => x.u);
  const pages = templates.flatMap((t) => t.urls).slice(0, cap);
  const room = Math.max(0, cap - pages.length);
  pages.push(...statics.slice(0, room));
  return { pages, templates, static: Math.min(room, statics.length), skipped: Math.max(0, statics.length - room) };
}

/**
 * Pages whose share card shows another page's text: a title or description
 * that several pages share and that isn't the page's own (its <title> or meta
 * description, or the homepage's when it matches no page's own). X reads twitter:title and twitter:description first and falls
 * back to og:; Facebook and LinkedIn read og:. Each page is
 * { path, title, description, og: { title, description }, twitter: { title, description } }.
 * Returns { x, og }, each { paths, text } with text an example of the shared value.
 */
export function sharedCardText(pages) {
  const views = {
    x: (p) => [p.twitter?.title ?? p.og?.title, p.twitter?.description ?? p.og?.description],
    og: (p) => [p.og?.title, p.og?.description],
  };
  const out = {};
  for (const [key, view] of Object.entries(views)) {
    const flagged = new Set();
    let text;
    for (const i of [0, 1]) {
      const groups = new Map();
      for (const p of pages) {
        const value = view(p)[i];
        if (value) groups.set(value, [...(groups.get(value) ?? []), p]);
      }
      for (const [value, members] of groups) {
        if (members.length < 2) continue;
        // A shared value belongs to the page it matches; failing that, to the homepage, where a layout's default comes from.
        const own = (p) => value === (i === 0 ? p.title : p.description);
        const owner = members.some(own) ? own : (p) => p.path === '/';
        const borrowed = members.filter((p) => !owner(p));
        if (borrowed.length) { borrowed.forEach((p) => flagged.add(p.path)); text ??= value; }
      }
    }
    out[key] = { paths: [...flagged], text };
  }
  return out;
}

/**
 * The site's own links in an llms.txt: markdown links and bare URLs, resolved
 * against the file's URL, without fragments, kept only when they point at one
 * of the site's hosts. Templates such as /items/{id} are skipped.
 */
export function llmsLinks(text, llmsUrl, hosts) {
  const raw = [
    ...[...String(text ?? '').matchAll(/\]\(\s*<?([^)\s>]+)>?[^)]*\)/g)].map((m) => m[1]),
    ...[...String(text ?? '').matchAll(/\bhttps?:\/\/[^\s)>\]"'`]+/g)].map((m) => m[0]),
  ];
  const out = new Set();
  for (const href of raw) {
    if (href.startsWith('#')) continue; // an anchor in the file itself
    if (/[{}]|%7B|%7D|\/:[a-z_]+|YOUR_|\.\.\./i.test(href)) continue; // a template ({id}, :id), not a link
    let u;
    try { u = new URL(href.replace(/[.,;:!?]+$/, ''), llmsUrl); } catch { continue; }
    if (!['http:', 'https:'].includes(u.protocol) || !hosts.has(u.hostname)) continue;
    u.hash = '';
    out.add(u.href);
  }
  return [...out];
}

/**
 * For --base: request a local or preview build as if it were the domain.
 * toBase() sends the site's URLs (the domain or its www twin) to the base;
 * fromBase() maps them back, so every check keeps seeing the domain's URLs.
 */
export function baseMapper(domain, base) {
  const hosts = new Set([domain, domain.startsWith('www.') ? domain.slice(4) : `www.${domain}`]);
  const baseOrigin = base ? new URL(base).origin : null;
  const toBase = (url) => {
    if (!baseOrigin) return url;
    let u;
    try { u = new URL(url); } catch { return url; }
    return hosts.has(u.hostname) ? baseOrigin + u.pathname + u.search : url;
  };
  const fromBase = (url) => (baseOrigin && (url === baseOrigin || url.startsWith(`${baseOrigin}/`) || url.startsWith(`${baseOrigin}?`)) ? `https://${domain}${url.slice(baseOrigin.length) || '/'}` : url);
  return { baseOrigin, toBase, fromBase };
}

/**
 * A recorded T5 or T6 result for the status page. T6 may be structured
 * ({ period, google: { clicks, impressions, ctr, position, indexed,
 * not_indexed, crawled_not_indexed }, bing: { ... } }); otherwise the free-text
 * `result` is shown. Pipes are replaced so the table stays intact.
 */
export function formatRecorded(x) {
  if (!x) return 'not recorded';
  const num = (v, label) => (v === undefined || v === null || v === '' ? null : `${v}${label}`);
  const traffic = (o) => [num(o.clicks, ' clicks'), num(o.impressions, ' impressions'), num(o.ctr, '% CTR'), o.position != null ? `position ${o.position}` : null].filter(Boolean).join(', ');
  const parts = [];
  if (x.attempts != null) { // T5
    const run = [x.model, x.max_turns != null ? `${x.max_turns} turns max` : null].filter(Boolean).join(', ');
    parts.push([`${x.first_try ?? '?'} of ${x.attempts} first try`, run || null, num(x.median_calls, ' calls (median)'), num(x.stops, ' stops'), x.cost_usd != null ? `$${x.cost_usd}` : null].filter(Boolean).join('; '));
  }
  if (x.google && typeof x.google === 'object') {
    const g = x.google;
    const index = [num(g.indexed, ' indexed'), num(g.not_indexed, ' not indexed'), num(g.crawled_not_indexed, ' crawled but not indexed')].filter(Boolean).join(', ');
    parts.push(`Google: ${[traffic(g), index].filter(Boolean).join('; ')}`);
  }
  if (x.bing && typeof x.bing === 'object') parts.push(`Bing: ${traffic(x.bing)}`);
  if (Array.isArray(x.queries) && x.queries.length) parts.push(`${x.queries.length} top quer${x.queries.length === 1 ? 'y' : 'ies'} recorded`);
  const when = [x.attempts == null && parts.length ? x.period : null, x.date].filter(Boolean).join(', ');
  const text = parts.length ? parts.join('. ') : String(x.result ?? '');
  return `${text}${when ? ` (${when})` : ''}`.replace(/\|/g, '/');
}


const decode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

/**
 * Why a SKILL.md's frontmatter name breaks the Agent Skills spec, or null.
 * The name must be a lowercase slug, match its folder when the URL shows one
 * (.../<name>/SKILL.md), and match the name its index entry gives. A URL in
 * another shape (/skills/<name>) says nothing about the folder.
 */
export function skillNameProblem({ name, url, entryName }) {
  if (!SKILL_NAME.test(name ?? '')) return 'not a lowercase slug';
  const path = new URL(url).pathname;
  const folder = /\/SKILL\.md$/i.test(path) ? decode(path.split('/').slice(-2, -1)[0] ?? '') : '';
  if (folder && folder !== name) return `folder is ${folder}`;
  if (typeof entryName === 'string' && entryName && entryName !== name) return `index says ${entryName}`;
  return null;
}

/**
 * A note for checks that read a file a CDN may serve from its cache
 * (Cloudflare caches robots.txt by default): that copy can predate the latest
 * deploy. Empty unless the response says it came from a cache.
 */
export function cdnCacheNote(headers) {
  const cf = headers.get('cf-cache-status');
  const hit = cf ? /^(hit|stale|updating)$/i.test(cf.trim()) : /\bhit\b/i.test(headers.get('x-cache') ?? '');
  const age = Number(headers.get('age') ?? 0);
  if (!hit || !(age > 0)) return '';
  const old = age < 120 ? `${age} seconds` : `${Math.round(age / 60)} minutes`;
  return ` (this copy came from a CDN cache and is ${old} old, so a recent change may not show yet)`;
}

const normText = (t) => String(t ?? '').toLowerCase().replace(/\s+/g, ' ').replace(/[\s.!:;]+$/, '').trim();

/** True when an operation's description adds nothing to its summary (A1 notes these). */
export function repeatsSummary(op) {
  const summary = normText(op?.summary), description = normText(op?.description);
  return Boolean(summary && description) && summary.includes(description);
}

/**
 * True when a field has no description of its own but one of its anyOf, oneOf
 * or allOf members does: where Zod puts it for `.nullable()` when `.describe()`
 * comes first. `deref` resolves $ref members.
 */
export function hasVariantDescription(schema, deref = (s) => s) {
  if (!schema || schema.description) return false;
  return [].concat(schema.anyOf ?? [], schema.oneOf ?? [], schema.allOf ?? []).some((m) => deref(m)?.description);
}

const SYMBOLS = { '✓': 'pass', '✗': 'fail', '!': 'warn', '–': 'skip' };

/**
 * One domain's results from a previous run: a status page (the --matrix
 * output) or a --json report. Returns { date, results: Map(id -> { status,
 * level }) }, or null when the domain isn't in it.
 */
export function parsePrevious(text, domain) {
  const trimmed = String(text ?? '').trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let data;
    try { data = JSON.parse(trimmed); } catch { return null; }
    const rep = [].concat(data).find((r) => r?.domain === domain);
    if (!rep || !Array.isArray(rep.results)) return null;
    return { date: String(rep.checked_at ?? '').slice(0, 10) || null, results: new Map(rep.results.map((r) => [r.id, { status: r.status, level: r.level }])) };
  }
  const lines = trimmed.split('\n');
  const header = lines.find((l) => /^\| ID \| Check \| Level \|/.test(l));
  if (!header) return null;
  const cols = header.split('|').slice(1, -1).map((c) => c.trim());
  const col = cols.indexOf(domain);
  if (col < 3) return null;
  const results = new Map();
  for (const line of lines) {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length !== cols.length || !/^[A-Z]\d+$/.test(cells[0])) continue;
    const status = SYMBOLS[cells[col]]; // recorded rows (T5, T6) hold text, not a symbol
    if (status) results.set(cells[0], { status, level: cells[2] });
  }
  return { date: trimmed.match(/^Generated (\d{4}-\d{2}-\d{2})/m)?.[1] ?? null, results };
}

/** What changed between a previous run's results and this run's, as lists of labeled IDs. */
export function compareResults(previous, results) {
  const rank = { fail: 0, warn: 1, pass: 2 };
  const out = { better: [], worse: [], newlyChecked: [], noLongerChecked: [], levelChanged: [] };
  for (const r of results) {
    const p = previous.get(r.id);
    const was = p && p.status !== 'skip' ? p.status : null;
    const now = r.status !== 'skip' ? r.status : null;
    if (p && p.level && p.level !== r.level) out.levelChanged.push(`${r.id} (${p.level} to ${r.level})`);
    if (!was && now) out.newlyChecked.push(`${r.id} (${r.level}, ${now})`);
    else if (was && !now) out.noLongerChecked.push(r.id);
    else if (was && now && was !== now) (rank[now] > rank[was] ? out.better : out.worse).push(`${r.id} (${was} to ${now})`);
  }
  const current = new Set(results.map((r) => r.id));
  for (const [id, p] of previous) if (!current.has(id) && p.status !== 'skip') out.noLongerChecked.push(id);
  return out;
}

/** The comparison as printable lines. */
export function formatComparison(cmp, since) {
  const rows = [['Better', cmp.better], ['Worse', cmp.worse], ['Newly checked', cmp.newlyChecked], ['No longer checked', cmp.noLongerChecked], ['Level changed', cmp.levelChanged]]
    .filter(([, ids]) => ids.length);
  if (!rows.length) return [`Since ${since}: no changes.`];
  return [`Since ${since}:`, ...rows.map(([label, ids]) => `  ${label}: ${ids.join(', ')}`)];
}
