// --logs: count requests for the discovery files in an exported access log, by client family.
// Pure: the CLI feeds it lines. It prints counts and families, never addresses.

import { DISCOVERY_FILES, AI_BOTS } from './helpers.mjs';

// Client families, checked in order: the first match wins. §2 of STANDARD.md describes each.
// Directories come before the generic "bot" match, assistants before AI crawlers.
export const FAMILIES = [
  ['This audit (readiness-audit)', /^readiness-audit\//i],
  ['Agent and MCP directories', /agenstrybot|brickbluebot|agentprobe|mcpharbor|agenttrustbot|taifoonharvester|mcphub-probe|invokerankbot|proofbench|thepluginstorebot|protogrid-probe|glidemcpindex|agent-tools\.cloud/i],
  ['llms.txt directories', /llms\.?txt/i],
  ['Assistants fetching for a person', /chatgpt-user|claude-user|perplexity-user|meta-externalfetcher/i],
  ['AI crawlers', new RegExp([...AI_BOTS, 'meta-webindexer', 'meta-externalagent', 'bytespider', 'ccbot'].map((b) => b.replace(/[-.]/g, '\\$&')).join('|'), 'i')],
  ['Search crawlers', /googlebot|bingbot|applebot|duckduckbot|yandexbot|baiduspider/i],
  ['Scripts', /^(curl|wget|python|node|undici|axios|go-http-client|okhttp|java\/|libwww|httpie|deno|bun\/)/i],
  ['Headless browsers', /headlesschrome|phantomjs|puppeteer|playwright|selenium/i],
  ['Other bots', /bot|crawl|spider|scan|fetch|probe/i],
  ['Browsers', /^mozilla\//i],
];

export function family(ua) {
  if (!ua || ua === '-') return 'No user agent';
  return FAMILIES.find(([, re]) => re.test(ua))?.[0] ?? 'Unidentified';
}

// Families whose user agent can't show an agent: count them as one only when the same address called the API.
const UNVERIFIED = new Set(['Browsers', 'Headless browsers', 'Unidentified', 'No user agent']);

const COMBINED = /^(\S+) \S+ \S+ \[[^\]]*\] "(\S+) (\S+)[^"]*" (\d{3}) \S+(?: "[^"]*" "([^"]*)")?/;

// Field names per host's JSON lines, from each host's docs (read 2026-10-21): Cloudflare Logpush, Vercel log
// drains in NDJSON (proxy.path before the function's own path), Railway HTTP logs, then generic names.
const FIELDS = {
  path: ['ClientRequestPath', 'ClientRequestURI', 'proxy.path', 'path', 'requestPath', 'request_path', 'url', 'httpRequest.requestUrl'],
  ua: ['ClientRequestUserAgent', 'proxy.userAgent', 'userAgent', 'user_agent', 'clientUa', 'httpRequest.userAgent'],
  addr: ['ClientIP', 'proxy.clientIp', 'srcIp', 'clientIp', 'client_ip', 'ip', 'remote_addr', 'httpRequest.remoteIp'],
  method: ['ClientRequestMethod', 'proxy.method', 'method', 'httpRequest.requestMethod'],
  status: ['EdgeResponseStatus', 'proxy.statusCode', 'httpStatus', 'status', 'statusCode', 'httpRequest.status'],
};
const dig = (o, key) => key.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
const pick = (o, keys) => { for (const k of keys) { const v = dig(o, k); if (v !== undefined && v !== null && v !== '') return Array.isArray(v) ? v[0] : v; } return undefined; };

/** One log line as { path, ua, addr, method, status }, or null. Combined log format and JSON lines. */
export function parseLine(line) {
  const t = line.trim();
  if (!t) return null;
  if (t.startsWith('{')) {
    let o;
    try { o = JSON.parse(t); } catch { return null; }
    let path = pick(o, FIELDS.path);
    if (typeof path !== 'string') return null;
    if (/^https?:\/\//.test(path)) { try { path = new URL(path).pathname; } catch { return null; } }
    return { path: path.split('?')[0], ua: String(pick(o, FIELDS.ua) ?? ''), addr: String(pick(o, FIELDS.addr) ?? ''), method: String(pick(o, FIELDS.method) ?? 'GET').toUpperCase(), status: Number(pick(o, FIELDS.status)) || 0 };
  }
  const m = t.match(COMBINED);
  if (!m) return null;
  return { addr: m[1], method: m[2].toUpperCase(), path: m[3].split('?')[0], status: Number(m[4]), ua: m[5] ?? '' };
}

const FILE_PATHS = new Map(Object.values(DISCOVERY_FILES).map((p) => [p, p]));
/** Which discovery bucket a path counts toward, or null. */
export function bucket(path) {
  const p = path.length > 1 ? path.replace(/\/+$/, '') : path;
  if (FILE_PATHS.has(p)) return p;
  if (p === '/mcp' || p.startsWith('/mcp/')) return '/mcp';
  if (p.startsWith('/.well-known/')) return 'other /.well-known paths';
  if (/\.md$/i.test(p)) return 'markdown pages (*.md)';
  return null;
}
const isApiCall = (r) => r.path.startsWith('/api/') || (r.path === '/mcp' && r.method === 'POST');

/** Tally lines one at a time; result() gives the report. */
export function logTally() {
  let lines = 0, parsed = 0;
  const hits = new Map(); // bucket -> Map(family -> count)
  const readers = new Map(); // bucket -> Set(addr)
  const apiAddrs = new Set();
  const unverifiedAddrs = new Set();
  return {
    add(line) {
      lines++;
      const r = parseLine(line);
      if (!r) return;
      parsed++;
      const fam = family(r.ua);
      if (isApiCall(r)) { if (r.addr) apiAddrs.add(r.addr); if (UNVERIFIED.has(fam) && r.addr) unverifiedAddrs.add(r.addr); }
      const b = bucket(r.path);
      if (!b) return;
      if (!hits.has(b)) hits.set(b, new Map());
      hits.get(b).set(fam, (hits.get(b).get(fam) ?? 0) + 1);
      if (r.addr) { if (!readers.has(b)) readers.set(b, new Set()); readers.get(b).add(r.addr); }
    },
    result() {
      const paths = [...hits].map(([path, fams]) => {
        const addrs = readers.get(path) ?? new Set();
        return {
          path,
          requests: [...fams.values()].reduce((a, b) => a + b, 0),
          families: Object.fromEntries([...fams].sort((a, b) => b[1] - a[1])),
          addresses: addrs.size,
          also_called_api: [...addrs].filter((a) => apiAddrs.has(a)).length,
        };
      }).sort((a, b) => b.requests - a.requests);
      return { lines, parsed, api_addresses: apiAddrs.size, unverified_api_addresses: unverifiedAddrs.size, paths };
    },
  };
}

/** The report as text. */
export function formatLogs(rep) {
  const out = [`Read ${rep.parsed} of ${rep.lines} log lines (${rep.lines - rep.parsed} not understood)`, ''];
  if (!rep.paths.length) out.push('No requests for discovery files.');
  for (const p of rep.paths) {
    out.push(`${p.path}  ${p.requests} request${p.requests === 1 ? '' : 's'}${p.addresses ? `, ${p.addresses} address${p.addresses === 1 ? '' : 'es'}, ${p.also_called_api} of them also called the API` : ''}`);
    for (const [fam, n] of Object.entries(p.families)) out.push(`  ${String(n).padStart(6)}  ${fam}`);
  }
  out.push('', `API calls came from ${rep.api_addresses} address${rep.api_addresses === 1 ? '' : 'es'}. ${rep.unverified_api_addresses} of them sent a browser, headless or missing user agent: count those as agents, since they called the API.`);
  out.push('Browsers, headless browsers and unidentified clients above count as agents only where they also called the API (STANDARD.md, T3).');
  return out;
}
