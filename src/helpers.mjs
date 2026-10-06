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
  return md.length <= 5 ? md : [0, 1, 2, 3, 4].map((i) => md[Math.floor((i * md.length) / 5)]);
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
