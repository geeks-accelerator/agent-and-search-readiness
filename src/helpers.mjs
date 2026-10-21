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
 * lowercase words so formatting doesn't count. Headings in nav, header, footer and aside,
 * and screen-reader-only ones, are left out. An empty list when they agree.
 */
export function missingSections(html, markdown) {
  const text = (t) => t.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const words = (t) => text(t).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  // Navigation, page chrome and screen-reader-only headings aren't sections of the page.
  const body = String(html ?? '').replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, '').replace(/<h[1-3]\b[^>]*class="[^"]*\b(visually-hidden|sr-only)\b[^"]*"[^>]*>[\s\S]*?<\/h[1-3]>/gi, '');
  const htmlHeads = [...body.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => [text(m[1]), words(m[1])]).filter(([, w]) => w);
  const mdHeads = new Set([...String(markdown ?? '').matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)].map((m) => words(m[1].replace(/[*_`[\]]|\]\([^)]*\)/g, ' '))));
  return [...new Set(htmlHeads.filter(([, w]) => !mdHeads.has(w)).map(([text]) => text))];
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
 * Up to n URLs at most one path segment deep (/, /about, /privacy), spread
 * across the list. A sample spread across a sitemap of entity pages tends to
 * miss these, and they're the pages most likely to inherit a layout's metadata.
 */
export function shallowPages(urls, n) {
  const shallow = urls.filter((u) => { try { return new URL(u).pathname.split('/').filter(Boolean).length <= 1; } catch { return false; } });
  return spread(shallow, n);
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
