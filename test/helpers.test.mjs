// The checks' pure helpers, run without a network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleSkillEntries, skillNameProblem, cdnCacheNote } from '../src/helpers.mjs';

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
