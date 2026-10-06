// The checks' pure helpers, run without a network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleSkillEntries, skillNameProblem, cdnCacheNote, repeatsSummary, hasVariantDescription, parsePrevious, compareResults, formatComparison, spread, llmsLinks, baseMapper, formatRecorded } from '../src/helpers.mjs';

test('sampleSkillEntries reads SKILL.md entries and skips archives', () => {
  const list = [
    { name: 'a', type: 'skill-md', url: '/.well-known/agent-skills/a/SKILL.md' },
    { name: 'b', type: 'archive', url: '/.well-known/agent-skills/b.zip' },
    { name: 'c', url: '/skills/c/SKILL.md' }, // no type, older index: counts
    { name: 'd', url: '/skills/d.zip' }, // no type, not markdown: skipped
    { name: 'e', type: 'skill-md' }, // no url
  ];
  assert.deepEqual(sampleSkillEntries(list).map((e) => e.name), ['a', 'c']);
  assert.deepEqual(sampleSkillEntries(undefined), []);
});

test('sampleSkillEntries spreads five picks across a long index', () => {
  const list = Array.from({ length: 93 }, (_, i) => ({ name: `s${i}`, type: 'skill-md', url: `/s${i}/SKILL.md` }));
  const picked = sampleSkillEntries(list).map((e) => e.name);
  assert.equal(picked.length, 5);
  assert.equal(new Set(picked).size, 5);
  assert.equal(picked[0], 's0');
});

test('skillNameProblem wants a slug that matches the folder and the index entry', () => {
  const url = 'https://example.com/.well-known/agent-skills/adopt-a-akita/SKILL.md';
  assert.equal(skillNameProblem({ name: 'adopt-a-akita', url, entryName: 'adopt-a-akita' }), null);
  assert.equal(skillNameProblem({ name: 'Akita. Adopt an Akita', url, entryName: 'adopt-a-akita' }), 'not a lowercase slug');
  assert.equal(skillNameProblem({ name: '', url }), 'not a lowercase slug');
  assert.equal(skillNameProblem({ name: 'akita', url, entryName: 'akita' }), 'folder is adopt-a-akita');
  assert.equal(skillNameProblem({ name: 'adopt-a-akita', url, entryName: 'akita' }), 'index says akita');
});

test('skillNameProblem reads a folder only from .../<name>/SKILL.md URLs', () => {
  // A /skills/<name> URL says nothing about the folder: no false "folder is skills".
  assert.equal(skillNameProblem({ name: 'care', url: 'https://example.com/skills/care', entryName: 'care' }), null);
  assert.equal(skillNameProblem({ name: 'care', url: 'https://raw.example.com/repo/main/skills/care/SKILL.md' }), null);
  assert.equal(skillNameProblem({ name: 'care', url: 'https://example.com/SKILL.md' }), null);
});

test('cdnCacheNote speaks up only for a cached copy with an age', () => {
  const h = (o) => new Headers(o);
  assert.match(cdnCacheNote(h({ 'cf-cache-status': 'HIT', age: '5437' })), /CDN cache and is 91 minutes old/);
  assert.match(cdnCacheNote(h({ 'cf-cache-status': 'STALE', age: '30' })), /30 seconds old/);
  assert.match(cdnCacheNote(h({ 'x-cache': 'Hit from cloudfront', age: '600' })), /10 minutes old/);
  assert.equal(cdnCacheNote(h({ 'cf-cache-status': 'MISS', age: '5437' })), '');
  assert.equal(cdnCacheNote(h({ 'cf-cache-status': 'DYNAMIC' })), '');
  assert.equal(cdnCacheNote(h({ 'cf-cache-status': 'HIT' })), '');
  assert.equal(cdnCacheNote(h({})), '');
});

test('repeatsSummary flags descriptions that add nothing to the summary', () => {
  assert.equal(repeatsSummary({ summary: 'Feed your creature', description: 'Feed your creature.' }), true);
  assert.equal(repeatsSummary({ summary: 'Feed your creature now', description: 'feed your creature' }), true);
  assert.equal(repeatsSummary({ summary: 'Feed your creature', description: 'Feed your creature. Use it when hunger is low; the response says what changed.' }), false);
  assert.equal(repeatsSummary({ description: 'Feed your creature' }), false);
});

test('hasVariantDescription finds a description that sits inside anyOf', () => {
  assert.equal(hasVariantDescription({ anyOf: [{ type: 'string', description: 'Your bio' }, { type: 'null' }] }), true);
  assert.equal(hasVariantDescription({ description: 'Your bio', anyOf: [{ type: 'string' }, { type: 'null' }] }), false);
  assert.equal(hasVariantDescription({ anyOf: [{ type: 'string' }, { type: 'null' }] }), false);
  const refs = { '#/x': { description: 'via ref' } };
  assert.equal(hasVariantDescription({ oneOf: [{ $ref: '#/x' }] }, (s) => (s?.$ref ? refs[s.$ref] : s)), true);
});

const STATUS_PAGE = `# Agent and Search Readiness Status

Generated 2026-10-05 by \`npx readiness-audit --matrix one.com two.com\` (readiness-audit v1.0.1).

| ID | Check | Level | one.com | two.com |
|---|---|---|---|---|
| D1 | robots.txt | required | ✓ | ✗ |
| D8 | Markdown for agents | recommended | ! | – |
| S1 | Skill files | required | – | ✓ |
| | **Required passed** | | **1 of 1** | **1 of 2** |
| T5 | Agent usability test (recorded) | required | 4 of 5 first try (2026-10-12) | not recorded |
`;

test('parsePrevious reads one domain from a status page or a JSON report', () => {
  const page = parsePrevious(STATUS_PAGE, 'two.com');
  assert.equal(page.date, '2026-10-05');
  assert.deepEqual(Object.fromEntries(page.results), {
    D1: { status: 'fail', level: 'required' },
    D8: { status: 'skip', level: 'recommended' },
    S1: { status: 'pass', level: 'required' },
  });
  assert.equal(parsePrevious(STATUS_PAGE, 'three.com'), null);
  const json = parsePrevious(JSON.stringify({ domain: 'one.com', checked_at: '2026-10-01T10:00:00Z', results: [{ id: 'D1', status: 'pass', level: 'required' }] }), 'one.com');
  assert.equal(json.date, '2026-10-01');
  assert.deepEqual(json.results.get('D1'), { status: 'pass', level: 'required' });
});

test('compareResults sorts every change into one list', () => {
  const previous = parsePrevious(STATUS_PAGE, 'one.com').results;
  const now = [
    { id: 'D1', status: 'fail', level: 'required' }, // was pass
    { id: 'D8', status: 'pass', level: 'next' }, // was warn, and moved level
    { id: 'S1', status: 'pass', level: 'required' }, // was not applicable
    { id: 'W1', status: 'warn', level: 'required' }, // new check
  ];
  const cmp = compareResults(previous, now);
  assert.deepEqual(cmp.worse, ['D1 (pass to fail)']);
  assert.deepEqual(cmp.better, ['D8 (warn to pass)']);
  assert.deepEqual(cmp.levelChanged, ['D8 (recommended to next)']);
  assert.deepEqual(cmp.newlyChecked, ['S1 (required, pass)', 'W1 (required, warn)']);
  assert.deepEqual(formatComparison(cmp, '2026-10-05').slice(0, 2), ['Since 2026-10-05:', '  Better: D8 (warn to pass)']);
  assert.deepEqual(formatComparison(compareResults(new Map([['D1', { status: 'pass', level: 'required' }]]), [{ id: 'D1', status: 'pass', level: 'required' }]), 'x'), ['Since x: no changes.']);
});

test('spread picks evenly and keeps short lists whole', () => {
  assert.deepEqual(spread([1, 2, 3], 5), [1, 2, 3]);
  assert.deepEqual(spread([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 5), [0, 2, 4, 6, 8]);
});

test('llmsLinks keeps the site\'s own links and skips anchors, templates and other sites', () => {
  const hosts = new Set(['example.com', 'www.example.com']);
  const text = [
    '# Example',
    '- [Docs](https://example.com/docs/api "title")',
    '- [Agents](/agents) and <https://example.com/llms-full.txt>',
    '- Read https://example.com/guide. Elsewhere: https://other.org/x',
    '- [Top](#top), [a creature](https://example.com/creatures/{username}/{name}), GET /api/agents/:id',
    '- https://www.example.com/hall',
  ].join('\n');
  assert.deepEqual(llmsLinks(text, 'https://example.com/llms.txt', hosts), [
    'https://example.com/docs/api',
    'https://example.com/agents',
    'https://example.com/llms-full.txt',
    'https://example.com/guide',
    'https://www.example.com/hall',
  ]);
});

test('baseMapper sends the site\'s URLs to the base and maps them back', () => {
  const { baseOrigin, toBase, fromBase } = baseMapper('example.com', 'http://localhost:3000/ignored-path');
  assert.equal(baseOrigin, 'http://localhost:3000');
  assert.equal(toBase('https://example.com/a?b=1'), 'http://localhost:3000/a?b=1');
  assert.equal(toBase('https://www.example.com/'), 'http://localhost:3000/');
  assert.equal(toBase('https://cdn.example.org/x.png'), 'https://cdn.example.org/x.png');
  assert.equal(fromBase('http://localhost:3000/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(fromBase('http://localhost:3000'), 'https://example.com/');
  assert.equal(fromBase('http://localhost:30001/x'), 'http://localhost:30001/x');
  const off = baseMapper('example.com', null);
  assert.equal(off.toBase('https://example.com/a'), 'https://example.com/a');
});

test('formatRecorded shows structured T6 numbers and free text', () => {
  assert.equal(formatRecorded(undefined), 'not recorded');
  assert.equal(formatRecorded({ result: '4 of 5 first try', date: '2026-10-12' }), '4 of 5 first try (2026-10-12)');
  assert.equal(formatRecorded({ result: 'clicks 24 | CTR 3.8%' }), 'clicks 24 / CTR 3.8%');
  assert.equal(
    formatRecorded({ period: 'last 3 months', google: { clicks: 24, impressions: 630, ctr: 3.8, position: 18.2, indexed: 120, crawled_not_indexed: 40 }, bing: { clicks: 31 }, date: '2026-10-01' }),
    'Google: 24 clicks, 630 impressions, 3.8% CTR, position 18.2; 120 indexed, 40 crawled but not indexed. Bing: 31 clicks (last 3 months, 2026-10-01)',
  );
});
