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
