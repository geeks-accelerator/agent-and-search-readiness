// Guard tests: the scorecard, its version and the standard can't drift apart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION, REVIEW, score, matrix } from '../src/audit.mjs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../src/audit.mjs', import.meta.url), 'utf8');
const standard = readFileSync(new URL('../STANDARD.md', import.meta.url), 'utf8');
const inChecklist = (id) => new RegExp(`^\\| ${id} \\|`, 'm').test(standard);

test('VERSION matches package.json', () => {
  assert.equal(VERSION, pkg.version);
});

test('every check the scorecard runs is in the standard checklist', () => {
  const scored = new Set([
    ...[...source.matchAll(/const id = '([A-Z]\d+)'/g)].map((m) => m[1]),
    ...[...source.matchAll(/(?:pass|miss|skip)\('([A-Z]\d+)'/g)].map((m) => m[1]),
  ]);
  assert.ok(scored.size > 20, `expected more than 20 scored IDs, found ${scored.size}`);
  for (const id of scored) assert.ok(inChecklist(id), `${id} is scored but missing from the STANDARD.md checklist`);
});

test('every item the scorecard leaves to review is in the standard checklist', () => {
  for (const [ids] of REVIEW) {
    const first = ids.split('-')[0]; // "E1-E6" names a range; its first ID must exist
    assert.ok(inChecklist(first), `${first} from REVIEW is missing from the STANDARD.md checklist`);
  }
});

test('score counts passes and ignores skipped checks', () => {
  const results = [
    { id: 'D1', level: 'required', status: 'pass' },
    { id: 'D2', level: 'required', status: 'fail' },
    { id: 'M1', level: 'required', status: 'skip' },
    { id: 'D5', level: 'recommended', status: 'warn' },
  ];
  assert.equal(score(results, 'required'), '1 of 2');
  assert.equal(score(results, 'recommended'), '0 of 1');
  assert.equal(score(results, 'next'), 'n/a');
});

test('matrix renders one row per check and a score row', () => {
  const report = (domain, status) => ({ domain, hosted_mcp: false, results: [
    { id: 'D1', name: 'robots.txt', level: 'required', status, detail: 'x' },
    { id: 'D5', name: 'Link headers', level: 'recommended', status: 'warn', detail: 'missing rel service-desc' },
  ] });
  const md = matrix([report('a.example', 'pass'), report('b.example', 'fail')], 'npx readiness-audit --matrix a.example b.example');
  assert.match(md, /^\| D1 \| robots.txt \| required \| ✓ \| ✗ \|$/m);
  assert.match(md, /\*\*Required passed\*\* \| \| \*\*1 of 1\*\* \| \*\*0 of 1\*\*/);
  assert.match(md, /- \*\*D5\*\* Link headers \(warning, recommended\): missing rel service-desc/);
});
