// Renders the charts for docs/research/who-reads-discovery-files.md as static SVG files, from data.json.
// No dependencies:
//   node docs/research/who-reads-discovery-files/charts.mjs
// Each chart sits on its own light card, so it reads the same in GitHub's light and dark themes.
// The style follows the sister project's charts (agent-security-pranks, docs/research/bots-in-ai-clothing).

import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('./', import.meta.url);
const D = JSON.parse(readFileSync(new URL('data.json', dir), 'utf8'));

const C = { bg: '#ffffff', fg: '#1a2230', muted: '#5b6577', line: '#dde2ea', grid: '#eceff4' };
const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (n) => (n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
const text = (x, y, s, { size = 11, anchor = 'start', color = C.muted, weight = 400 } = {}) => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" fill="${color}" font-weight="${weight}">${esc(s)}</text>`;
function svg(W, H, title, body, legend = []) {
  // Legend items flow left to right by label width, wrapping before the right edge.
  let lx = 24, ly = 44;
  const keys = legend.map(([label, color]) => {
    const w = 34 + label.length * 7.4;
    if (lx + w > W - 24) { lx = 24; ly += 18; }
    const item = `<rect x="${lx}" y="${ly}" width="11" height="11" rx="2" fill="${color}"/>${text(lx + 16, ly + 10, label, { size: 12 })}`;
    lx += w;
    return item;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}" role="img" aria-label="${esc(title)}">
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="8" fill="${C.bg}" stroke="${C.line}"/>
${text(24, 30, title, { size: 15, color: C.fg, weight: 600 })}
${keys}
${body}
</svg>
`;
}

// Who reads each file: one 100% bar per file, split by reader class.
const CLASSES = [
  ['verifiedAI', 'verified AI bots', '#2557c7'],
  ['verifiedOther', 'other verified bots', '#8fb0ea'],
  ['namedUnverified', 'crawler names, not verified', '#c2362b'],
  ['directories', 'agent and llms.txt directories', '#8a5cd6'],
  ['auditTools', 'other audit tools', '#c9a227'],
  ['scripts', 'scripts and coding agents', '#3a9a74'],
  ['browsers', 'browser user agents', '#9aa3b2'],
  ['other', 'other and empty', '#d4d8df'],
];
function readers(file, title, keys) {
  const W = 1040, L = 300, R = 80, TOP = 96, ROW = 26, iw = W - L - R, H = TOP + keys.length * ROW + 24;
  const body = keys.map((k, i) => {
    const f = D.files[k]; const y = TOP + i * ROW; let x = L;
    const segs = CLASSES.map(([c, , color]) => { const w = (f.readers[c] / f.requests) * iw; const r = `<rect x="${x.toFixed(1)}" y="${y}" width="${Math.max(0, w).toFixed(1)}" height="${ROW - 8}" fill="${color}"/>`; x += w; return r; }).join('');
    return text(L - 10, y + 13, k, { anchor: 'end', color: C.fg }) + segs + text(W - R + 8, y + 13, fmt(f.requests));
  }).join('');
  writeFileSync(new URL(file, dir), svg(W, H, title, body, CLASSES.map(([, label, color]) => [label, color])));
}

// Asked for versus served: how many of the 49 active sites were asked for each file, and how many serve it.
function demand(file, title, keys) {
  const W = 1000, L = 300, R = 40, TOP = 76, ROW = 24, iw = W - L - R, H = TOP + keys.length * ROW + 30, max = 49;
  const body = keys.map((k, i) => {
    const f = D.files[k]; const y = TOP + i * ROW;
    return text(L - 10, y + 12, k, { anchor: 'end', color: C.fg })
      + `<rect x="${L}" y="${y}" width="${(f.zonesAsked / max) * iw}" height="${ROW - 8}" fill="#c9d5ee"/>`
      + `<rect x="${L}" y="${y}" width="${(f.zonesServing / max) * iw}" height="${ROW - 8}" fill="#2557c7"/>`
      + text(L + (f.zonesAsked / max) * iw + 6, y + 12, `${f.zonesServing} of ${f.zonesAsked}`);
  }).join('') + text(L, TOP + keys.length * ROW + 16, 'sites (of 49 with traffic)');
  writeFileSync(new URL(file, dir), svg(W, H, title, body, [['sites asked for it', '#c9d5ee'], ['sites that serve it', '#2557c7']]));
}

// Follow-through: of the addresses that read a file, the share that made a successful API or MCP call.
function follow(file, title) {
  const rows = Object.entries(D.followThrough.files).sort((a, b) => b[1].readers - a[1].readers);
  const W = 1040, L = 300, R = 170, TOP = 90, ROW = 24, iw = W - L - R, H = TOP + rows.length * ROW + 20;
  const body = rows.map(([k, f], i) => {
    const y = TOP + i * ROW, share = f.calledApi / f.readers, nb = f.calledApiNonBrowser / f.readers;
    return text(L - 10, y + 12, k, { anchor: 'end', color: C.fg })
      + `<rect x="${L}" y="${y}" width="${iw}" height="${ROW - 8}" fill="${C.grid}"/>`
      + `<rect x="${L}" y="${y}" width="${share * iw}" height="${ROW - 8}" fill="#8fb0ea"/>`
      + `<rect x="${L}" y="${y}" width="${nb * iw}" height="${ROW - 8}" fill="#2557c7"/>`
      + text(L + iw + 8, y + 12, `${f.calledApi} of ${f.readers} (${Math.round(share * 100)}%)`);
  }).join('');
  writeFileSync(new URL(file, dir), svg(W, H, title, body, [['called the API, non-browser user agent', '#2557c7'], ['called the API, any user agent', '#8fb0ea']]));
}

const discovery = ['/robots.txt', '/sitemap.xml', '*.md', '/llms.txt', '/llms-full.txt', '/openapi.json', '/.well-known/agent-card.json', '/.well-known/agent.json', '/.well-known/ard.json', '/.well-known/ai-catalog.json', '/.well-known/mcp/server-card.json', '/.well-known/mcp.json', '/.well-known/agent-skills/index.json', '/.well-known/api-catalog', '/.well-known/security.txt', '/.well-known/ai-plugin.json'];
readers('readers.svg', 'Who requested each discovery file (share of requests, total at right)', discovery);
readers('endpoints.svg', 'Who requested /mcp and /api', ['/mcp', '/api']);
demand('demand.svg', 'Asked for versus served, by site', ['/robots.txt', '/sitemap.xml', '/llms.txt', '/.well-known/security.txt', '/api', '/openapi.json', '*.md', '/.well-known/agent-card.json', '/.well-known/ai-plugin.json', '/mcp', '/.well-known/mcp.json', '/.well-known/agent.json', '/.well-known/ard.json', '/llms-full.txt', '/.well-known/ai-catalog.json', '/.well-known/api-catalog']);
follow('follow-through.svg', 'Readers who went on to call the API or MCP endpoint (16 sites with one)');
console.log('wrote readers.svg, endpoints.svg, demand.svg, follow-through.svg');
