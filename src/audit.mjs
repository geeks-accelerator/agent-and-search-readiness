// readiness-audit: score a live site against the Agent and Search Readiness Standard.
//
// Library entry. The command-line tool is bin/readiness-audit.mjs.
// The standard and what each ID means: STANDARD.md in
// https://github.com/geeks-accelerator/agent-and-search-readiness
// Read-only: GETs plus a few POSTs that create nothing (an MCP initialize, server/discover and
// tools/list, an empty POST to /). Node 18+, no dependencies.

import { resolveTxt } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';

export const VERSION = '1.0.0';
export const REPO = 'https://github.com/geeks-accelerator/agent-and-search-readiness';
const UA = `readiness-audit/${VERSION} (+${REPO})`;
const AI_BOTS = ['gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'claude-user', 'claude-searchbot', 'perplexitybot', 'perplexity-user', 'google-extended', 'applebot-extended'];
const AID_PROTOCOLS = ['mcp', 'a2a', 'openapi', 'grpc', 'graphql', 'websocket', 'local', 'zeroconf', 'ucp'];
const SKILLS_SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';
const CARD_SCHEMA = 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json';
export const LEVELS = ['required', 'recommended', 'next'];
const ORDER = ['D1', 'D2', 'D4', 'D6', 'D11', 'D12', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'A1', 'A2', 'A6', 'A7', 'M1', 'M4', 'S1', 'D5', 'D7', 'D8', 'D9', 'D10', 'D15', 'A3', 'A4', 'A5', 'M5', 'S2', 'N5', 'N6'];
// Items the scorecard can't see from outside. Each project checks these in review and tests.
export const REVIEW = [
  ['D3', 'pages read well: server-rendered, unique prose on generated pages (the scorecard checks W1 to W6 on a sample)'],
  ['W7', 'internal links: entity names link to their pages, descriptive anchors, no orphan pages'],
  ['W8', 'Core Web Vitals on the main pages (Lighthouse or PageSpeed Insights)'],
  ['W9', 'listed in the directories your audience uses'],
  ['D13', 'a page for agents\' builders with a copy-paste prompt'],
  ['D14', 'AGENTS.md in public repos, imported from CLAUDE.md'],
  ['A6', 'next_steps and suggestion on every response (the scorecard only tests one unauthenticated call)'],
  ['A8', 'forgiving input (aliases, Bearer in any case), writes never guess'],
  ['A9', 'Retry-After on 429, documented limits'],
  ['A10', 'self-service keys, rotation, attribution'],
  ['A11', 'public and private stated honestly, one privacy filter'],
  ['M2', 'stdio package: saved key, register guard, rotate, User-Agent'],
  ['M3', 'published to npm, the MCP Registry, Smithery and Glama, one version'],
  ['S1', 'skills ask before anything public or permanent (the scorecard checks names, descriptions and links on a sample)'],
  ['S3', 'ClawHub owners map'],
  ['S4', 'plugin bundle with generated manifests'],
  ['E1-E6', 'first-call value, reasons to return, scheduled-agent performance'],
  ['T1-T4', 'logs, attribution, come-back measure, guard tests'],
  ['T6', 'Search Console and Bing Webmaster Tools: coverage, queries, clicks and click-through rate, monthly'],
  ['T5', 'agent usability test: a fresh agent, only the domain and a goal; report its first-try success rate'],
];

export async function audit(domain, { hasApi = true, mcpPath = '/mcp' } = {}) {
  const BASE = `https://${domain}`;
  const rand = Math.random().toString(36).slice(2, 10);

  async function get(path, { headers = {}, method = 'GET', body, redirect = 'follow' } = {}) {
    const url = path.startsWith('http') ? path : BASE + path;
    try {
      const res = await fetch(url, { method, body, redirect, headers: { 'user-agent': UA, ...headers }, signal: AbortSignal.timeout(15000) });
      const text = await res.text();
      return { status: res.status, headers: res.headers, text, url: res.url, type: res.headers.get('content-type') ?? '' };
    } catch (e) {
      return { status: 0, headers: new Headers(), text: '', url, type: '', error: e.message };
    }
  }
  // fetch() always sends an Accept header, so the "no Accept" MCP probe uses node:https.
  function postNoAccept(path, payload) {
    return new Promise((resolve) => {
      const req = httpsRequest(BASE + path, { method: 'POST', timeout: 15000, headers: { 'user-agent': UA, 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } }, (res) => {
        let text = '';
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] ?? '', text }));
      });
      req.on('error', () => resolve({ status: 0, type: '', text: '' }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, type: '', text: '' }); });
      req.end(payload);
    });
  }
  const json = (r) => { try { return JSON.parse(r.text); } catch { return null; } };
  const isJson = (r) => /json/.test(r.type) && json(r) !== null;
  const ok = (r) => r.status >= 200 && r.status < 300;
  const ct = (r) => r.type.split(';')[0] || (r.status ? 'no body' : 'no answer');
  const rpc = (r) => {
    if (/event-stream/.test(r.type)) {
      const line = r.text.split('\n').find((l) => l.startsWith('data:'));
      try { return line ? JSON.parse(line.slice(5)) : null; } catch { return null; }
    }
    return json(r);
  };

  const results = [];
  const record = (id, name, level, status, detail) => results.push({ id, name, level, status, detail });
  const pass = (id, name, level, detail) => record(id, name, level, 'pass', detail);
  const miss = (id, name, level, detail) => record(id, name, level, level === 'required' ? 'fail' : 'warn', detail);
  const wrong = (id, name, level, detail) => record(id, name, level, 'fail', detail); // present but false or invalid
  const skip = (id, name, level, detail) => record(id, name, level, 'skip', detail);

  const [home, homeMd, robots, sitemap, llms, llmsFull, openapi, apiIndex, apiCatalog, security, authMd, docsMd,
    agentCard, ard, aiCatalog, skills, prm, asMeta, aiPlugin, wkMiss, apiMiss, postRoot, legacyCard, wkCard] = await Promise.all([
    get('/'), get('/', { headers: { accept: 'text/markdown' } }), get('/robots.txt'), get('/sitemap.xml'),
    get('/llms.txt'), get('/llms-full.txt'), get('/openapi.json'), get('/api', { headers: { accept: 'application/json' } }),
    get('/.well-known/api-catalog'), get('/.well-known/security.txt'), get('/auth.md'), get('/docs/api.md'),
    get('/.well-known/agent-card.json'), get('/.well-known/ard.json'), get('/.well-known/ai-catalog.json'),
    get('/.well-known/agent-skills/index.json'), get('/.well-known/oauth-protected-resource'),
    get('/.well-known/oauth-authorization-server'), get('/.well-known/ai-plugin.json'),
    get(`/.well-known/no-such-file-${rand}`), get(`/api/no-such-endpoint-${rand}`, { headers: { accept: 'application/json' } }),
    get('/', { method: 'POST', redirect: 'manual' }), get('/.well-known/mcp.json'), get('/.well-known/mcp/server-card.json'),
  ]);
  const catalogEntries = [...(json(ard)?.entries ?? []), ...(json(aiCatalog)?.entries ?? [])];

  // ---- D1 robots.txt (required) and D15 AI crawlers and Content-Signal (recommended) ----
  const groups = [];
  let sitemapLine = false;
  if (ok(robots)) {
    let cur = null, lastUa = false;
    for (const raw of robots.text.split('\n')) {
      const line = raw.split('#')[0].trim();
      const i = line.indexOf(':');
      if (i < 0) continue;
      const k = line.slice(0, i).trim().toLowerCase();
      const v = line.slice(i + 1).trim();
      if (k === 'user-agent') {
        if (!lastUa) { cur = { agents: [], disallow: new Set(), signal: false }; groups.push(cur); }
        cur.agents.push(v.toLowerCase());
        lastUa = true;
        continue;
      }
      lastUa = false;
      if (k === 'sitemap') sitemapLine = true;
      if (!cur) continue;
      if (k === 'disallow' && v) cur.disallow.add(v);
      if (k === 'content-signal') cur.signal = true;
    }
  }
  {
    const id = 'D1', name = 'robots.txt', level = 'required';
    const star = groups.find((g) => g.agents.includes('*'));
    const leaks = star ? groups.filter((g) => g !== star).flatMap((g) => [...star.disallow].filter((d) => !g.disallow.has(d)).map((d) => `${g.agents[0]} skips Disallow ${d}`)) : [];
    if (!ok(robots)) miss(id, name, level, `/robots.txt answered ${robots.status}`);
    else if (leaks.length) miss(id, name, level, `named groups drop rules from the * group (a crawler obeys only its own group): ${[...new Set(leaks)].slice(0, 3).join('; ')}`);
    else if (!sitemapLine) miss(id, name, level, 'no Sitemap line');
    else pass(id, name, level, `${groups.length} group${groups.length === 1 ? '' : 's'} with consistent rules, Sitemap listed`);
  }
  {
    const id = 'D15', name = 'AI crawlers named, Content-Signal', level = 'recommended';
    const named = AI_BOTS.filter((b) => groups.some((g) => g.agents.includes(b)));
    const unsignaled = groups.filter((g) => !g.signal);
    const problems = [];
    if (unsignaled.length) problems.push(`${unsignaled.length} of ${groups.length} group${groups.length === 1 ? '' : 's'} ${unsignaled.length === 1 ? 'has' : 'have'} no Content-Signal (${unsignaled.slice(0, 3).map((g) => g.agents[0]).join(', ')}${unsignaled.length > 3 ? ', ...' : ''})`);
    if (named.length < 3) problems.push(`names ${named.length} of the main AI crawlers`);
    if (!ok(robots)) miss(id, name, level, 'no robots.txt');
    else if (problems.length) miss(id, name, level, problems.join('; '));
    else pass(id, name, level, `${named.length} AI crawlers named, Content-Signal in every group`);
  }

  // ---- D2 sitemap ----
  {
    const id = 'D2', name = 'sitemap.xml', level = 'required';
    const lastmods = [...sitemap.text.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1].slice(0, 10));
    if (!ok(sitemap) || !/<urlset|<sitemapindex/.test(sitemap.text)) miss(id, name, level, `/sitemap.xml answered ${sitemap.status}`);
    else if (!lastmods.length) miss(id, name, level, 'no lastmod dates');
    else if (new Set(lastmods).size === 1 && lastmods.length > 5) miss(id, name, level, `all ${lastmods.length} lastmod dates are ${lastmods[0]}; use each page's real change date`);
    else pass(id, name, level, `${lastmods.length} URLs with ${new Set(lastmods).size} distinct lastmod dates`);
  }

  // ---- D4 llms.txt ----
  {
    const id = 'D4', name = 'llms.txt and llms-full.txt', level = 'required';
    if (!ok(llms) || !/^\s*# \S/.test(llms.text)) miss(id, name, level, ok(llms) ? 'llms.txt has no H1 title on its first line' : `/llms.txt answered ${llms.status}`);
    else if (!ok(llmsFull)) miss(id, name, level, '/llms-full.txt missing');
    else pass(id, name, level, `llms.txt ${(llms.text.length / 1024).toFixed(1)} KB, llms-full.txt ${(llmsFull.text.length / 1024).toFixed(0)} KB`);
  }

  // ---- D5 Link headers (recommended; a wrong service-desc is a false declaration) ----
  {
    const id = 'D5', name = 'Link headers', level = 'recommended';
    const link = home.headers.get('link') ?? '';
    const rels = new Map();
    for (const part of link.split(/,(?=\s*<)/)) {
      const href = part.match(/<([^>]+)>/)?.[1];
      const relAttr = part.match(/rel="?([^";]+)"?/)?.[1];
      if (href && relAttr) for (const r of relAttr.split(/\s+/)) rels.set(r, [...(rels.get(r) ?? []), href]);
    }
    const desc = rels.get('service-desc') ?? [];
    const missing = ['service-desc', 'describedby', ...(hasApi ? ['api-catalog'] : [])].filter((r) => !rels.has(r));
    if (!link) miss(id, name, level, 'no Link header on the homepage');
    else if (hasApi && desc.length && !desc.some((h) => /openapi/i.test(h))) wrong(id, name, level, `service-desc points at ${desc.join(', ')}; it must name the OpenAPI document`);
    else if (missing.length) miss(id, name, level, `missing rel ${missing.join(', ')} (has ${[...rels.keys()].join(', ')})`);
    else pass(id, name, level, `rels: ${[...rels.keys()].join(', ')}`);
  }

  // ---- D6 security.txt ----
  {
    const id = 'D6', name = 'security.txt', level = 'required';
    const expires = [...security.text.matchAll(/^expires:\s*(.+)$/gim)].map((m) => Date.parse(m[1].trim()));
    const days = expires.length === 1 ? (expires[0] - Date.now()) / 86_400_000 : NaN;
    if (!ok(security) || !/text\/plain/.test(security.type)) miss(id, name, level, `/.well-known/security.txt answered ${security.status}`);
    else if (!/^contact:\s*\S/im.test(security.text)) miss(id, name, level, 'no Contact field');
    else if (expires.length !== 1) miss(id, name, level, `${expires.length} Expires fields (RFC 9116 requires exactly one)`);
    else if (!(days > 0)) miss(id, name, level, `Expires passed ${Math.round(-days)} days ago`);
    else pass(id, name, level, `Contact present, Expires in ${Math.round(days)} days${days > 366 ? ' (the RFC recommends under a year)' : ''}`);
  }

  // ---- D7 JSON answers for unknown well-known paths and POST / (recommended) ----
  {
    const id = 'D7', name = 'JSON 404s and a JSON 405 on POST /', level = 'recommended';
    const problems = [];
    if (!isJson(wkMiss)) problems.push(`an unknown /.well-known path answers ${wkMiss.status} ${ct(wkMiss)}`);
    if (!(postRoot.status === 405 && isJson(postRoot))) problems.push(`POST / answers ${postRoot.status} ${ct(postRoot)}`);
    if (problems.length) miss(id, name, level, problems.join('; '));
    else pass(id, name, level, 'JSON 404 for unknown well-known paths, JSON 405 for POST /');
  }

  // ---- D8 markdown for agents ----
  {
    const id = 'D8', name = 'Markdown for agents', level = 'recommended';
    const varyAccept = (r) => /(^|,)\s*accept\s*(,|$)/i.test(r.headers.get('vary') ?? '');
    const tokens = homeMd.headers.get('x-markdown-tokens');
    if (!/text\/markdown/.test(homeMd.type)) miss(id, name, level, `Accept: text/markdown on / returns ${ct(homeMd)}`);
    else if (!varyAccept(homeMd) || !varyAccept(home)) miss(id, name, level, `Vary: Accept missing on the ${!varyAccept(home) ? 'HTML' : 'markdown'} response`);
    else if (!tokens) miss(id, name, level, 'markdown and Vary are right; add x-markdown-tokens');
    else pass(id, name, level, `markdown with Vary: Accept on both, x-markdown-tokens ${tokens}`);
  }

  // ---- D9 AI catalog (ARD) ----
  {
    const id = 'D9', name = 'AI catalog (ARD)', level = 'recommended';
    const rels = [...home.text.matchAll(/<link[^>]+rel="?(ard|ai-catalog)"?/gi)].map((m) => m[1].toLowerCase());
    const problems = [];
    for (const [file, r] of [['ard.json', ard], ['ai-catalog.json', aiCatalog]]) {
      if (!ok(r)) { problems.push(`${file} answered ${r.status}`); continue; }
      if (!/application\/ai-catalog\+json/.test(r.type)) problems.push(`${file} served as ${ct(r)}`);
      const entries = json(r)?.entries;
      if (!Array.isArray(entries) || !entries.length) problems.push(`${file} has no entries`);
      else if (entries.some((e) => !String(e.identifier ?? '').startsWith('urn:air:'))) problems.push(`${file} has identifiers outside urn:air:`);
    }
    if (!rels.includes('ard')) problems.push('no <link rel="ard"> in the page head');
    if (problems.length) miss(id, name, level, problems.join('; '));
    else pass(id, name, level, 'ard.json and ai-catalog.json as application/ai-catalog+json, linked from the page head');
  }

  // ---- D11 the A2A path ----
  let a2aValid = false;
  {
    const id = 'D11', name = 'A2A path is honest', level = 'required';
    const card = json(agentCard);
    if (ok(agentCard) && card) {
      const ifaces = Array.isArray(card.supportedInterfaces) ? card.supportedInterfaces : [];
      const validIfaces = ifaces.length && ifaces.every((i) => i.url && i.protocolBinding && i.protocolVersion);
      const fields = ['name', 'description', 'version', 'capabilities', 'defaultInputModes', 'defaultOutputModes', 'skills'].filter((f) => card[f] === undefined);
      if (validIfaces && !fields.length) { a2aValid = true; pass(id, name, level, `A2A v1.0 card with ${ifaces.length} interface(s); confirm each one answers`); }
      else wrong(id, name, level, `200 without a valid A2A v1.0 card (${!validIfaces ? 'no supportedInterfaces with url, protocolBinding and protocolVersion' : `missing ${fields.join(', ')}`}). Answer a JSON 404 that points to your real entry points`);
    } else if (!ok(agentCard) && isJson(agentCard)) pass(id, name, level, `JSON ${agentCard.status} pointing elsewhere`);
    else if (!ok(agentCard)) record(id, name, level, 'warn', `honest ${agentCard.status}, but ${ct(agentCard)} body. It's the most requested agent path: answer with JSON that points to your real entry points`);
    else wrong(id, name, level, `200 at the A2A path that isn't JSON (${ct(agentCard)})`);
  }

  // ---- A: API ----
  if (!hasApi) {
    for (const [id, name, level] of [['A1', 'OpenAPI 3.1', 'required'], ['A2', 'GET /api index', 'required'], ['A6', 'Errors that teach (401 without a key)', 'required'], ['A7', 'JSON catch-all for wrong API paths', 'required'], ['A3', 'API catalog (RFC 9727)', 'recommended'], ['A4', 'auth.md', 'recommended'], ['A5', 'API reference as markdown', 'recommended']]) skip(id, name, level, '--no-api');
  } else {
    {
      const id = 'A1', name = 'OpenAPI 3.1', level = 'required';
      const spec = json(openapi);
      if (!ok(openapi) || !spec?.openapi) miss(id, name, level, `/openapi.json answered ${openapi.status}`);
      else {
        const deref = (s, seen = new Set()) => {
          if (!s || typeof s !== 'object' || !s.$ref) return s;
          if (seen.has(s.$ref)) return {};
          seen.add(s.$ref);
          return deref(s.$ref.replace(/^#\//, '').split('/').reduce((n, k) => n?.[k], spec), seen);
        };
        const undescribedProps = (schema, seen = new Set()) => {
          const s = deref(schema);
          if (!s || typeof s !== 'object' || seen.has(s)) return [];
          seen.add(s);
          const out = [];
          for (const [k, v] of Object.entries(s.properties ?? {})) {
            const d = deref(v);
            if (!(v?.description || d?.description)) out.push(k);
            out.push(...undescribedProps(d, seen));
          }
          for (const key of ['items', 'allOf', 'anyOf', 'oneOf']) for (const sub of [].concat(s[key] ?? [])) out.push(...undescribedProps(sub, seen));
          return out;
        };
        const ops = Object.entries(spec.paths ?? {}).flatMap(([p, item]) => Object.entries(item)
          .filter(([m]) => ['get', 'post', 'put', 'patch', 'delete'].includes(m))
          .map(([m, o]) => ({ key: `${m.toUpperCase()} ${p}`, o, params: [...(item.parameters ?? []), ...(o.parameters ?? [])] })));
        const noDesc = ops.filter(({ o }) => !String(o.description ?? '').trim());
        const fieldGaps = ops.flatMap(({ key, o, params }) => [
          ...params.map((p) => deref(p)).filter((p) => p && !p.description && !deref(p.schema)?.description).map((p) => `${key} ${p.name}`),
          ...Object.values(deref(o.requestBody)?.content ?? {}).flatMap((c) => undescribedProps(c.schema)).map((f) => `${key} ${f}`),
        ]);
        const respGaps = new Set(ops.flatMap(({ o }) => Object.values(o.responses ?? {}).flatMap((r) => Object.values(deref(r)?.content ?? {}).flatMap((c) => undescribedProps(c.schema)))));
        const respNote = respGaps.size ? `; ${respGaps.size} response field${respGaps.size === 1 ? ' has' : 's have'} no description (see N7)` : '';
        if (!String(spec.openapi).startsWith('3.1')) miss(id, name, level, `OpenAPI ${spec.openapi} (use 3.1)`);
        else if (noDesc.length) miss(id, name, level, `${noDesc.length} of ${ops.length} operations ${noDesc.length === 1 ? 'has' : 'have'} no description (${noDesc.slice(0, 3).map((x) => x.key).join(', ')}${noDesc.length > 3 ? ', ...' : ''})${respNote}`);
        else if (fieldGaps.length) miss(id, name, level, `${fieldGaps.length} request field${fieldGaps.length === 1 ? ' has' : 's have'} no description (${fieldGaps.slice(0, 3).join(', ')}${fieldGaps.length > 3 ? ', ...' : ''})${respNote}`);
        else pass(id, name, level, `OpenAPI ${spec.openapi}; all ${ops.length} operations and their request fields described${respNote}`);
      }
    }
    {
      const id = 'A2', name = 'GET /api index', level = 'required';
      if (ok(apiIndex) && isJson(apiIndex)) pass(id, name, level, 'JSON index');
      else miss(id, name, level, `/api answered ${apiIndex.status} ${ct(apiIndex)}`);
    }
    {
      // A6, partly: an authenticated operation called without a key should answer JSON that says how to get one.
      const id = 'A6', name = 'Errors that teach (401 without a key)', level = 'required';
      const spec = json(openapi);
      const globalSec = Array.isArray(spec?.security) && spec.security.length > 0;
      const protectedOps = Object.entries(spec?.paths ?? {}).flatMap(([p, item]) => Object.entries(item)
        .filter(([m, o]) => ['get', 'post'].includes(m) && (Array.isArray(o.security) ? o.security.some((r) => Object.keys(r).length) : globalSec))
        .map(([m]) => ({ m, p })));
      const target = protectedOps.find((x) => x.m === 'get' && !x.p.includes('{')) ?? protectedOps.find((x) => !x.p.includes('{'));
      if (!target) skip(id, name, level, 'no authenticated operation in the OpenAPI document');
      else {
        const r = await get(target.p, { method: target.m.toUpperCase(), headers: { accept: 'application/json', ...(target.m === 'post' ? { 'content-type': 'application/json' } : {}) }, body: target.m === 'post' ? '{}' : undefined });
        const body = json(r);
        if (!(r.status === 401 || r.status === 403)) miss(id, name, level, `${target.m.toUpperCase()} ${target.p} without a key answered ${r.status}`);
        else if (!isJson(r) || !(body.suggestion || body.next_steps)) miss(id, name, level, `${target.m.toUpperCase()} ${target.p} without a key answered ${r.status} ${ct(r)} with no suggestion or next_steps`);
        else pass(id, name, level, `${target.m.toUpperCase()} ${target.p} without a key: ${r.status} JSON with ${['suggestion', 'next_steps'].filter((k) => body[k]).join(' and ')}`);
      }
    }
    {
      const id = 'A7', name = 'JSON catch-all for wrong API paths', level = 'required';
      const body = json(apiMiss);
      if (!isJson(apiMiss)) miss(id, name, level, `an unknown /api path answers ${apiMiss.status} ${ct(apiMiss)}`);
      else if (!(body.next_steps || body.suggestion || body.did_you_mean)) miss(id, name, level, 'JSON, but no next_steps, suggestion or did_you_mean');
      else pass(id, name, level, `JSON ${apiMiss.status} with ${['next_steps', 'suggestion', 'did_you_mean'].filter((k) => body[k]).join(', ')}`);
    }
    {
      const id = 'A3', name = 'API catalog (RFC 9727)', level = 'recommended';
      const doc = json(apiCatalog);
      if (!ok(apiCatalog) || !Array.isArray(doc?.linkset)) miss(id, name, level, `/.well-known/api-catalog answered ${apiCatalog.status}`);
      else if (!/application\/linkset\+json/.test(apiCatalog.type)) miss(id, name, level, `served as ${ct(apiCatalog)} (must be application/linkset+json)`);
      else if (!/rfc9727/.test(apiCatalog.type)) miss(id, name, level, 'add profile="https://www.rfc-editor.org/info/rfc9727" to the content type');
      else pass(id, name, level, 'linkset+json with the RFC 9727 profile');
    }
    {
      const id = 'A4', name = 'auth.md', level = 'recommended';
      if (ok(authMd) && /text\/(markdown|plain)/.test(authMd.type)) pass(id, name, level, `served as ${ct(authMd)}`);
      else miss(id, name, level, `/auth.md answered ${authMd.status} ${ct(authMd)}`);
    }
    {
      const id = 'A5', name = 'API reference as markdown', level = 'recommended';
      if (ok(docsMd) && /text\/(markdown|plain)/.test(docsMd.type)) pass(id, name, level, '/docs/api.md');
      else miss(id, name, level, `/docs/api.md answered ${docsMd.status} ${ct(docsMd)}`);
    }
  }

  // ---- S1 skill files, on a sample from the skills index ----
  {
    const id = 'S1', name = 'Skill files', level = 'required';
    const entries = (json(skills)?.skills ?? []).filter((e) => typeof e?.url === 'string');
    if (!ok(skills) || !entries.length) skip(id, name, level, 'no skills index to sample; check your SKILL.md files in review');
    else {
      const sample = entries.length <= 5 ? entries : [0, 1, 2, 3, 4].map((i) => entries[Math.floor((i * entries.length) / 5)]);
      const files = await Promise.all(sample.map(async (e) => {
        const url = new URL(e.url, BASE).href;
        const r = await get(url);
        const fm = r.text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
        const field = (k) => fm.match(new RegExp(`^${k}:\\s*(?:"([^"]*)"|'([^']*)'|(.*))$`, 'm'))?.slice(1).find((v) => v !== undefined)?.trim() ?? '';
        const folder = url.split('/').slice(-2, -1)[0] ?? '';
        return { url, status: r.status, text: r.text, name: field('name'), description: field('description'), folder, lines: r.text.split('\n').length };
      }));
      const label = (f) => f.folder || f.url;
      const unreachable = files.filter((f) => f.status !== 200).map((f) => `${label(f)} (${f.status})`);
      const read = files.filter((f) => f.status === 200);
      const badName = read.filter((f) => !/^(?!-)(?!.*--)[a-z0-9-]{1,64}(?<!-)$/.test(f.name) || (f.folder && f.name !== f.folder)).map(label);
      const badDesc = read.filter((f) => !f.description || f.description.length > 1024).map(label);
      const noMap = read.filter((f) => !/llms\.txt/.test(f.text)).map(label);
      const noApi = read.filter((f) => !/openapi|\/docs\/(api|mcp)|https?:\/\/[^\s)]+\/(api|mcp)\b/i.test(f.text)).map(label);
      const long = read.filter((f) => f.lines > 500).map((f) => `${label(f)} (${f.lines} lines)`);
      const list = (xs) => `${xs.slice(0, 3).join(', ')}${xs.length > 3 ? `, +${xs.length - 3} more` : ''}`;
      const problems = [], warns = [];
      if (unreachable.length) problems.push(`skill files that don't load: ${list(unreachable)}`);
      if (badName.length) problems.push(`names that aren't a lowercase slug matching the folder: ${list(badName)}`);
      if (badDesc.length) problems.push(`missing or over-long descriptions: ${list(badDesc)}`);
      if (noMap.length) warns.push(`no link to llms.txt: ${list(noMap)}`);
      if (noApi.length) warns.push(`no link to the API or MCP reference: ${list(noApi)}`);
      if (long.length) warns.push(`over 500 lines: ${list(long)}`);
      if (problems.length) miss(id, name, level, problems.concat(warns).join('; '));
      else if (warns.length) record(id, name, level, 'warn', warns.join('; '));
      else pass(id, name, level, `${read.length} sampled skills follow the spec and link llms.txt and the API or MCP reference`);
    }
  }

  // ---- S2 skills index ----
  {
    const id = 'S2', name = 'Agent skills index', level = 'recommended';
    const doc = json(skills);
    if (!ok(skills) || !doc) miss(id, name, level, `/.well-known/agent-skills/index.json answered ${skills.status}`);
    else {
      const list = Array.isArray(doc.skills) ? doc.skills : [];
      const bad = [];
      if (doc.$schema !== SKILLS_SCHEMA) bad.push(`unrecognized $schema, so clients skip the whole index (${doc.$schema ?? 'none'})`);
      const types = list.filter((s) => !['skill-md', 'archive'].includes(s.type)).length;
      const digests = list.filter((s) => !/^sha256:[0-9a-f]{64}$/.test(s.digest ?? '')).length;
      const names = list.filter((s) => !/^(?!-)(?!.*--)[a-z0-9-]{1,64}(?<!-)$/.test(s.name ?? '')).length;
      if (types) bad.push(`${types} entries with a type other than skill-md or archive`);
      if (digests) bad.push(`${digests} entries without a sha256: digest`);
      if (names) bad.push(`${names} names that aren't lowercase slugs`);
      if (bad.length) wrong(id, name, level, bad.join('; '));
      else pass(id, name, level, `${list.length} skills, v0.2.0 fields`);
    }
  }

  // ---- M: hosted MCP endpoint ----
  const META = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientInfo': { name: 'readiness-audit', version: VERSION }, 'io.modelcontextprotocol/clientCapabilities': {} };
  const INIT = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'readiness-audit', version: VERSION } } });
  const answersMcp = async (path) => {
    const r = await get(path, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: INIT });
    return { r, hosted: r.status !== 404 && r.status !== 0 && !/text\/html/.test(r.type) && (rpc(r)?.jsonrpc === '2.0' || r.status === 406) };
  };
  const modern = (method, id) => get(mcpPath, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2026-07-28', 'mcp-method': method },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params: { _meta: META } }),
  });
  let hosted = false;
  if (mcpPath) {
    const { r: probe, hosted: h } = await answersMcp(mcpPath);
    hosted = h;
    if (hosted) {
      {
        const id = 'M4', name = 'Hosted MCP edge', level = 'required';
        const variants = [['application/json, text/event-stream', probe]];
        for (const accept of ['application/json', '*/*']) variants.push([accept, await get(mcpPath, { method: 'POST', headers: { 'content-type': 'application/json', accept }, body: INIT })]);
        variants.push(['(none)', await postNoAccept(mcpPath, INIT)]);
        const discover = await modern('server/discover', 2);
        const browser = await get(mcpPath, { headers: { accept: 'text/html' }, redirect: 'manual' });
        const aliases = await Promise.all(['/sse', '/api/mcp'].map((p) => get(p, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/json' }, body: INIT })));
        const problems = [];
        const refused = variants.filter(([, r]) => r.status !== 200).map(([a, r]) => `${a} → ${r.status}`);
        if (refused.length) problems.push(`2025-era initialize refused for Accept ${refused.join(', ')}`);
        const sse = variants.filter(([, r]) => r.status === 200 && /event-stream/.test(r.type)).length;
        if (sse) problems.push(`${sse} of 4 legacy answers are SSE frames, not JSON`);
        const d = rpc(discover);
        if (!(discover.status === 200 && d?.result?.supportedVersions?.includes('2026-07-28'))) problems.push(`2026-07-28 server/discover answered ${discover.status}`);
        if (!(browser.status >= 300 && browser.status < 400)) problems.push(`a browser GET gets ${browser.status}, not a redirect to the docs`);
        const badAlias = ['/sse', '/api/mcp'].filter((p, i) => !(aliases[i].status >= 300 && aliases[i].status < 400));
        if (badAlias.length) problems.push(`no redirect from ${badAlias.join(', ')}`);
        if (problems.length) miss(id, name, level, problems.join('; '));
        else pass(id, name, level, 'both eras, JSON for every Accept, browsers redirected, aliases redirect');
        const instructions = d?.result?.instructions ?? rpc(probe)?.result?.instructions;
        if (instructions) pass('N5', 'MCP server instructions', 'next', `${instructions.length} characters`);
        else miss('N5', 'MCP server instructions', 'next', 'no instructions in server/discover or initialize');
      }
      {
        const id = 'M1', name = 'MCP tools', level = 'required';
        let list = rpc(await modern('tools/list', 3))?.result?.tools;
        if (!Array.isArray(list)) list = rpc(await get(mcpPath, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }) }))?.result?.tools;
        if (!Array.isArray(list)) miss(id, name, level, 'tools/list failed');
        else {
          const undescribed = list.filter((t) => !String(t.description ?? '').trim()).length;
          const unannotated = list.filter((t) => !t.annotations || (t.annotations.readOnlyHint === undefined && t.annotations.destructiveHint === undefined)).length;
          if (undescribed || unannotated) miss(id, name, level, [undescribed && `${undescribed} without a description`, unannotated && `${unannotated} without readOnlyHint or destructiveHint`].filter(Boolean).join('; '));
          else pass(id, name, level, `${list.length} tools, all described and annotated`);
          const structured = list.filter((t) => t.outputSchema).length;
          if (structured) pass('N6', 'MCP structured output', 'next', `${structured} of ${list.length} tools declare outputSchema`);
          else miss('N6', 'MCP structured output', 'next', 'no tool declares outputSchema');
        }
      }
      {
        const id = 'M5', name = 'MCP server card', level = 'recommended';
        const cardPath = `${mcpPath.replace(/\/$/, '')}/server-card`;
        const card = await get(cardPath, { headers: { accept: 'application/mcp-server-card+json' } });
        const doc = json(card);
        const problems = [];
        if (!ok(card) || !doc) problems.push(`${cardPath} answered ${card.status}`);
        else {
          if (!/application\/mcp-server-card\+json/.test(card.type)) problems.push(`served as ${ct(card)}`);
          if (doc.$schema !== CARD_SCHEMA) problems.push('$schema is not the v1 server card schema');
          if (!/^[^/\s]+\/[^/\s]+$/.test(doc.name ?? '')) problems.push(`name "${doc.name}" is not reverse-DNS`);
          for (const f of ['version', 'description']) if (!doc[f]) problems.push(`no ${f}`);
          if (!Array.isArray(doc.remotes) || !doc.remotes.length) problems.push('no remotes');
        }
        if (!catalogEntries.some((e) => e.type === 'application/mcp-server-card+json' && (e.url === BASE + cardPath || e.data))) problems.push('the AI catalog has no entry pointing at it');
        if (problems.length) miss(id, name, level, problems.join('; '));
        else pass(id, name, level, `${cardPath}, v1 schema, listed in the AI catalog`);
      }
    }
  }
  if (!hosted) {
    for (const [id, name] of [['M1', 'MCP tools'], ['M4', 'Hosted MCP edge']]) skip(id, name, 'required', 'no hosted MCP endpoint');
    skip('M5', 'MCP server card', 'recommended', 'no hosted MCP endpoint');
    for (const [id, name] of [['N5', 'MCP server instructions'], ['N6', 'MCP structured output']]) skip(id, name, 'next', 'no hosted MCP endpoint');
  }

  // ---- W: search, on a sample of sitemap pages ----
  {
    const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
    let urls = locs(sitemap.text);
    if (/<sitemapindex/.test(sitemap.text)) {
      const subs = urls.slice(0, 3);
      urls = [];
      for (const sub of subs) urls.push(...locs((await get(sub)).text));
    }
    urls = [...new Set(urls)].filter((u) => u.startsWith('http'));
    const norm = (u) => { try { const x = new URL(u); return `${x.protocol}//${x.host.toLowerCase()}${x.pathname.replace(/\/+$/, '') || '/'}${x.search}`; } catch { return u; } };
    const pick = [];
    const n = Math.min(20, urls.length);
    for (let i = 0; i < n; i++) pick.push(urls[Math.floor((i * urls.length) / n)]);
    const decode = (t) => t.replace(/&amp;/g, '&').replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
    const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)].map((m) => [m[1].toLowerCase(), m[3] ?? m[4]]));
    const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((m) => attrs(m[0]));
    const meta = (html, key, val) => tags(html, 'meta').find((a) => (a[key] ?? '').toLowerCase() === val)?.content;
    const pages = await Promise.all(pick.map(async (u) => {
      const r = await get(u, { headers: { accept: 'text/html' } });
      const h = r.text;
      const ld = [...h.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } });
      const types = [];
      const walk = (x) => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x['@type']) types.push(...[].concat(x['@type'])); if (x['@graph']) walk(x['@graph']); } };
      ld.forEach(walk);
      return {
        url: u, status: r.status, finalUrl: r.url, html: /text\/html/.test(r.type),
        title: decode(h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''),
        description: decode(meta(h, 'name', 'description') ?? ''),
        robots: (meta(h, 'name', 'robots') ?? '').toLowerCase(),
        canonicals: tags(h, 'link').filter((a) => (a.rel ?? '').toLowerCase() === 'canonical').map((a) => a.href),
        og: { title: meta(h, 'property', 'og:title'), description: meta(h, 'property', 'og:description'), image: meta(h, 'property', 'og:image'), width: meta(h, 'property', 'og:image:width'), alt: meta(h, 'property', 'og:image:alt') },
        twitterCard: meta(h, 'name', 'twitter:card'),
        h1: (h.match(/<h1[\s>]/gi) ?? []).length,
        lang: /<html[^>]*\slang=["']?[\w-]+/i.test(h),
        imgNoAlt: tags(h, 'img').filter((a) => a.alt === undefined).length,
        ldBroken: ld.filter((x) => x === null).length, types,
      };
    }));
    const ok200 = pages.filter((p) => p.status === 200 && p.html);
    const short = (u) => u.replace(BASE, '') || '/';
    const list = (xs) => `${xs.slice(0, 3).join(', ')}${xs.length > 3 ? `, +${xs.length - 3} more` : ''}`;
    if (!pick.length) {
      for (const [id, name] of [['W1', 'Titles and descriptions'], ['W2', 'Canonical URLs'], ['W3', 'Indexable pages only'], ['W4', 'Structured data'], ['W5', 'Link previews'], ['W6', 'Page structure']]) miss(id, name, 'required', 'no URLs in the sitemap to sample');
    } else {
      // W1 titles and descriptions
      {
        const id = 'W1', name = 'Titles and descriptions', level = 'required';
        const noTitle = ok200.filter((p) => !p.title).map((p) => short(p.url));
        const noDesc = ok200.filter((p) => !p.description).map((p) => short(p.url));
        const dupe = (key) => { const seen = new Map(); for (const p of ok200) if (p[key]) seen.set(p[key], [...(seen.get(p[key]) ?? []), short(p.url)]); return [...seen.values()].filter((v) => v.length > 1); };
        const dupTitles = dupe('title'), dupDescs = dupe('description');
        const longTitles = ok200.filter((p) => p.title.length > 70).map((p) => `${short(p.url)} (${p.title.length})`);
        const badDescs = ok200.filter((p) => p.description && (p.description.length < 50 || p.description.length > 160)).map((p) => `${short(p.url)} (${p.description.length})`);
        const problems = [];
        if (noTitle.length) problems.push(`no title on ${list(noTitle)}`);
        if (noDesc.length) problems.push(`no meta description on ${list(noDesc)}`);
        if (dupTitles.length) problems.push(`${dupTitles.length} title${dupTitles.length === 1 ? '' : 's'} shared by several pages (${dupTitles[0].slice(0, 2).join(', ')})`);
        if (dupDescs.length) problems.push(`${dupDescs.length} description${dupDescs.length === 1 ? '' : 's'} shared by several pages (${dupDescs[0].slice(0, 2).join(', ')})`);
        const lengths = [];
        if (longTitles.length) lengths.push(`titles over 70 characters: ${list(longTitles)}`);
        if (badDescs.length) lengths.push(`descriptions outside 50 to 160 characters: ${list(badDescs)}`);
        if (problems.length) miss(id, name, level, problems.concat(lengths).join('; '));
        else if (lengths.length) record(id, name, level, 'warn', lengths.join('; '));
        else pass(id, name, level, `${ok200.length} sampled pages, all with their own title and description`);
      }
      // W2 canonical URLs and one canonical host
      {
        const id = 'W2', name = 'Canonical URLs', level = 'required';
        const none = ok200.filter((p) => !p.canonicals.length).map((p) => short(p.url));
        const many = ok200.filter((p) => new Set(p.canonicals).size > 1).map((p) => short(p.url));
        const elsewhere = ok200.filter((p) => p.canonicals.length && norm(new URL(p.canonicals[0], p.url).href) !== norm(p.url)).map((p) => `${short(p.url)} → ${short(new URL(p.canonicals[0], p.url).href)}`);
        const origin = new URL(BASE).origin;
        // Count only the hops it takes to reach the canonical host; a later path redirect (a language prefix, say) isn't a host hop.
        const hostHops = async (start) => {
          let url = start;
          for (let n = 0; n < 5; n++) {
            if (new URL(url).origin === origin) return { n, end: url };
            let r;
            try { r = await fetch(url, { method: 'GET', redirect: 'manual', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) }); } catch { return n === 0 ? null : { n, end: url }; }
            const loc = r.headers.get('location');
            if (r.status < 300 || r.status >= 400 || !loc) return { n, end: url };
            url = new URL(loc, url).href;
          }
          return { n: 5, end: url };
        };
        const alt = domain.startsWith('www.') ? `https://${domain.slice(4)}/` : `https://www.${domain}/`;
        const hostProblems = [];
        for (const start of [`http://${domain}/`, alt]) {
          const h = await hostHops(start);
          if (!h) continue; // that host doesn't resolve or answer
          if (new URL(h.end).origin !== origin) hostProblems.push(`${start} never reaches ${origin} (ends at ${h.end})`);
          else if (h.n > 1) hostProblems.push(`${start} takes ${h.n} redirects to reach ${origin}`);
        }
        const problems = [];
        if (none.length) problems.push(`no canonical on ${list(none)}`);
        if (many.length) problems.push(`conflicting canonicals on ${list(many)}`);
        if (elsewhere.length) problems.push(`sitemap URLs canonical to another URL: ${list(elsewhere)}`);
        problems.push(...hostProblems);
        if (problems.length) miss(id, name, level, problems.join('; '));
        else pass(id, name, level, `self-referencing canonicals on ${ok200.length} sampled pages; http and the other host redirect once to ${origin}`);
      }
      // W3 only indexable pages in the sitemap; real 404s
      {
        const id = 'W3', name = 'Indexable pages only', level = 'required';
        const broken = pages.filter((p) => p.status !== 200).map((p) => `${short(p.url)} (${p.status})`);
        const moved = pages.filter((p) => p.status === 200 && norm(p.finalUrl) !== norm(p.url)).map((p) => `${short(p.url)} → ${short(p.finalUrl)}`);
        const noindex = ok200.filter((p) => /noindex/.test(p.robots)).map((p) => short(p.url));
        const deep = ok200.map((p) => new URL(p.url).pathname).find((path) => path.split('/').filter(Boolean).length >= 2);
        const probes = [`/no-such-page-${rand}`, ...(deep ? [deep.replace(/\/[^/]+\/?$/, `/no-such-item-${rand}`)] : [])];
        const soft = [];
        for (const path of probes) {
          const r = await get(path, { headers: { accept: 'text/html' } });
          if (r.status === 200) soft.push(path);
        }
        const problems = [];
        if (broken.length) problems.push(`sitemap URLs that don't answer 200: ${list(broken)}`);
        if (moved.length) problems.push(`sitemap URLs that redirect: ${list(moved)}`);
        if (noindex.length) problems.push(`sitemap URLs marked noindex: ${list(noindex)}`);
        if (soft.length) problems.push(`missing pages answer 200 instead of 404: ${list(soft)}`);
        if (problems.length) miss(id, name, level, problems.join('; '));
        else pass(id, name, level, `${pages.length} sampled sitemap URLs answer 200 with no redirect or noindex; missing pages get a 404`);
      }
      // W4 structured data
      {
        const id = 'W4', name = 'Structured data', level = 'required';
        const home = ok200.find((p) => norm(p.url) === norm(BASE + '/')) ?? null;
        const homeTypes = home ? home.types : [];
        const broken = ok200.filter((p) => p.ldBroken).map((p) => short(p.url));
        const none = ok200.filter((p) => !p.types.length).map((p) => short(p.url));
        const deepPages = ok200.filter((p) => new URL(p.url).pathname.split('/').filter(Boolean).length >= 2);
        const noCrumbs = deepPages.filter((p) => !p.types.includes('BreadcrumbList')).map((p) => short(p.url));
        const all = new Set(ok200.flatMap((p) => p.types));
        const notes = [];
        if (all.has('FAQPage') || all.has('HowTo')) notes.push(`${['FAQPage', 'HowTo'].filter((t) => all.has(t)).join(' and ')} markup earns no rich results in Google anymore (HowTo ended in 2023, FAQ in May 2026); keep it only where the page really is one`);
        if (all.has('Person')) notes.push('Person markup found: fine on a profile the page labels as an AI agent; don\'t imply a human');
        const problems = [];
        if (broken.length) problems.push(`JSON-LD that doesn't parse on ${list(broken)}`);
        if (home && !homeTypes.some((t) => ['Organization', 'WebSite'].includes(t))) problems.push('no Organization or WebSite on the homepage');
        if (none.length) problems.push(`no JSON-LD on ${list(none)}`);
        if (problems.length) miss(id, name, level, problems.concat(notes).join('; '));
        else if (noCrumbs.length > deepPages.length / 2) record(id, name, level, 'warn', [`no BreadcrumbList on ${noCrumbs.length} of ${deepPages.length} deeper pages`, ...notes].join('; '));
        else pass(id, name, level, [`types: ${[...all].slice(0, 8).join(', ')}`, ...notes].join('; '));
      }
      // W5 link previews
      {
        const id = 'W5', name = 'Link previews', level = 'required';
        const missingOg = ok200.filter((p) => !(p.og.title && p.og.description && p.og.image)).map((p) => short(p.url));
        const noCard = ok200.filter((p) => !p.twitterCard).map((p) => short(p.url));
        const undeclared = ok200.filter((p) => p.og.image && !(p.og.width && p.og.alt)).map((p) => short(p.url));
        const images = [...new Set(ok200.map((p) => p.og.image).filter(Boolean))].slice(0, 3);
        const badImages = [];
        for (const img of images) {
          const r = await get(new URL(img, BASE).href);
          if (!(r.status === 200 && /^image\//.test(r.type))) badImages.push(`${short(new URL(img, BASE).href)} (${r.status} ${ct(r)})`);
        }
        const problems = [];
        if (missingOg.length) problems.push(`missing og:title, og:description or og:image on ${list(missingOg)}`);
        if (noCard.length) problems.push(`no twitter:card on ${list(noCard)}`);
        if (badImages.length) problems.push(`share images that don't load: ${list(badImages)}`);
        if (problems.length) miss(id, name, level, problems.join('; '));
        else if (undeclared.length) record(id, name, level, 'warn', `og:image size or alt text not declared on ${list(undeclared)}`);
        else pass(id, name, level, `Open Graph and twitter:card on ${ok200.length} sampled pages; share images load`);
      }
      // W6 page structure
      {
        const id = 'W6', name = 'Page structure', level = 'required';
        const noH1 = ok200.filter((p) => p.h1 === 0).map((p) => short(p.url));
        const manyH1 = ok200.filter((p) => p.h1 > 1).map((p) => `${short(p.url)} (${p.h1})`);
        const noLang = ok200.filter((p) => !p.lang).map((p) => short(p.url));
        const noAlt = ok200.filter((p) => p.imgNoAlt).map((p) => `${short(p.url)} (${p.imgNoAlt})`);
        const problems = [], warns = [];
        if (noH1.length) problems.push(`no h1 on ${list(noH1)}`);
        if (noLang.length) problems.push(`no html lang on ${list(noLang)}`);
        if (manyH1.length) warns.push(`several h1s on ${list(manyH1)}`);
        if (noAlt.length) warns.push(`images without alt on ${list(noAlt)}`);
        if (problems.length) miss(id, name, level, problems.concat(warns).join('; '));
        else if (warns.length) record(id, name, level, 'warn', warns.join('; '));
        else pass(id, name, level, `one h1, html lang and alt text on ${ok200.length} sampled pages`);
      }
    }
  }

  // ---- D10 DNS AID (recommended; a record naming a service you don't run is false) ----
  {
    const id = 'D10', name = 'DNS AID record', level = 'recommended';
    let recs = [];
    try { recs = (await resolveTxt(`_agent.${domain}`)).map((r) => r.join('')).filter((r) => r.startsWith('v=aid')); } catch { recs = []; }
    if (!recs.length) miss(id, name, level, `no TXT record at _agent.${domain}`);
    else if (recs.length > 1) wrong(id, name, level, `${recs.length} records at _agent.${domain}; AID clients fail on ambiguity, so keep exactly one`);
    else {
      const kv = Object.fromEntries(recs[0].split(';').map((p) => p.split('=')).filter((p) => p.length >= 2).map(([k, ...v]) => [k.trim(), v.join('=').trim()]));
      if (kv.v !== 'aid2') miss(id, name, level, `version ${kv.v} (current is aid2)`);
      else if (!kv.u || !AID_PROTOCOLS.includes(kv.p)) wrong(id, name, level, `invalid record: u=${kv.u ?? 'missing'} p=${kv.p ?? 'missing'}`);
      else {
        let why = '';
        if (kv.p === 'a2a' && !a2aValid) why = 'p=a2a, but there is no valid A2A card';
        else if (kv.p === 'mcp' && !(await answersMcp(kv.u)).hosted) why = `p=mcp, but ${kv.u} doesn't answer MCP`;
        else if (kv.p === 'openapi' && !json(await get(kv.u))?.openapi) why = `p=openapi, but ${kv.u} isn't an OpenAPI document`;
        if (why) wrong(id, name, level, why);
        else pass(id, name, level, `p=${kv.p} u=${kv.u}`);
      }
    }
  }

  // ---- D12 no false declarations (required) ----
  {
    const id = 'D12', name = 'No false declarations', level = 'required';
    const fails = [], warns = [];
    const p = ok(prm) ? json(prm) ?? {} : null;
    const asDoc = ok(asMeta) ? json(asMeta) ?? {} : null;
    if (p?.authorization_servers?.length && !asDoc?.token_endpoint) fails.push('the protected-resource metadata names an authorization server that has no token_endpoint');
    else if (asDoc && !asDoc.token_endpoint) fails.push('authorization-server metadata with no token_endpoint');
    if (!a2aValid && catalogEntries.some((e) => /a2a-agent-card/.test(e.type ?? ''))) fails.push('the AI catalog types an entry as an A2A agent card, but there is no valid A2A card');
    for (const e of catalogEntries.filter((x) => x.type === 'application/mcp-server-card+json' && x.url)) {
      const target = await get(e.url, { headers: { accept: 'application/mcp-server-card+json' } });
      if (json(target)?.$schema !== CARD_SCHEMA) fails.push(`the AI catalog types ${e.url.replace(BASE, '')} as a server card, but it isn't a v1 server card`);
    }
    if (ok(aiPlugin)) warns.push('ai-plugin.json (ChatGPT plugins ended in 2024)');
    if (!hosted) {
      const strays = [['/.well-known/mcp.json', legacyCard], ['/.well-known/mcp/server-card.json', wkCard]].filter(([, r]) => ok(r) && json(r));
      if (strays.length) warns.push(`${strays.map(([x]) => x).join(' and ')} ${strays.length === 1 ? 'implies' : 'imply'} a hosted MCP endpoint, but none answers at ${mcpPath ?? '/mcp'}`);
    }
    const all = [...new Set(fails)].concat(warns);
    if (fails.length) wrong(id, name, level, all.join('; '));
    else if (warns.length) record(id, name, level, 'warn', all.join('; '));
    else pass(id, name, level, 'no OAuth, A2A, plugin or server-card claims without the service behind them');
  }

  results.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  return { domain, version: VERSION, checked_at: new Date().toISOString(), hosted_mcp: hosted, results };
}

export function score(results, level) {
  const rows = results.filter((r) => r.level === level && r.status !== 'skip');
  return rows.length ? `${rows.filter((r) => r.status === 'pass').length} of ${rows.length}` : 'n/a';
}

// Markdown status page for several sites, for docs/guides/agent-readiness-status.md.
// `recorded` holds what the scorecard can't measure, per domain:
// { "example.com": { "T5": { "result": "4 of 5 first try", "date": "2026-10-12" }, "T6": { ... } } }
export function matrix(reports, command, recorded = {}) {
  const sym = { pass: '✓', warn: '!', fail: '✗', skip: '–' };
  const domains = reports.map((r) => r.domain);
  const ids = reports[0].results.map((r) => [r.id, r.name, r.level]);
  const out = [
    '# Agent and Search Readiness Status', '',
    `Generated ${new Date().toISOString().slice(0, 10)} by \`${command}\` (readiness-audit v${VERSION}). Don't edit it by hand: regenerate it. What each ID means: [the standard](${REPO}/blob/main/STANDARD.md).`, '',
    'The scorecard sees only what is visible from outside a site. Items checked in review and tests (listed at the end) aren\'t in these numbers, so a high score can hide real gaps.', '',
    '✓ pass, ✗ fail, ! warning, – not applicable.', '',
    `| ID | Check | Level | ${domains.join(' | ')} |`, `|---|---|---|${domains.map(() => '---').join('|')}|`,
    ...ids.map(([id, name, level]) => `| ${id} | ${name} | ${level} | ${reports.map((rep) => sym[rep.results.find((r) => r.id === id)?.status ?? 'skip']).join(' | ')} |`),
    `| | **Required passed** | | ${reports.map((rep) => `**${score(rep.results, 'required')}**`).join(' | ')} |`,
    `| | Recommended passed | | ${reports.map((rep) => score(rep.results, 'recommended')).join(' | ')} |`,
    `| | Hosted MCP endpoint | | ${reports.map((rep) => (rep.hosted_mcp ? 'yes' : 'no')).join(' | ')} |`,
    ...[['T5', 'Agent usability test (recorded)'], ['T6', 'Search numbers (recorded)']].map(([id, label]) =>
      `| ${id} | ${label} | required | ${reports.map((rep) => { const x = recorded[rep.domain]?.[id]; return x ? `${String(x.result ?? '').replace(/\|/g, '/')}${x.date ? ` (${x.date})` : ''}` : 'not recorded'; }).join(' | ')} |`),
    '',
    '## What to fix, per site', '',
    'Failures and warnings with the scorecard\'s reason, required items first.', '',
  ];
  for (const rep of reports) {
    out.push(`### ${rep.domain}`, '');
    const open = rep.results.filter((r) => r.status === 'fail' || r.status === 'warn');
    if (!open.length) out.push('Everything the scorecard can see passes.');
    for (const r of open) out.push(`- **${r.id}** ${r.name} (${r.status === 'fail' ? 'fail' : 'warning'}, ${r.level}): ${r.detail}`);
    out.push('');
  }
  out.push('## Checked in review and tests, not scored', '', ...REVIEW.map(([id, what]) => `- **${id}**: ${what}`), '');
  return out.join('\n');
}
