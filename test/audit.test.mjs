// End to end: audit() against a fixture site on localhost, through --base, with no outside network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audit } from '../src/audit.mjs';
import { logTally } from '../src/logs.mjs';
import { startFixture } from './fixture-site.mjs';

test('the audit reports the fixture site\'s deliberate problems, and passes the rest', async () => {
  const site = await startFixture();
  let rep;
  try { rep = await audit('fixture.example', { base: site.base }); } finally { await site.close(); }
  const by = Object.fromEntries(rep.results.map((r) => [r.id, r]));
  const status = (id) => by[id]?.status;

  // A sitemap index, expanded to its pages; static pages and one template sampled.
  assert.equal(status('D2'), 'pass', by.D2.detail);
  assert.match(by.D2.detail, /^31 URLs/);
  assert.match(by.W1.detail, /6 static, 1 template/);

  // Each deliberate problem, reported once, where it belongs.
  assert.equal(status('D4'), 'warn');
  assert.match(by.D4.detail, /\/old → \/about/);
  assert.equal(status('W3'), 'fail');
  assert.match(by.W3.detail, /\/brotli \(refused: br body\)/);
  assert.equal(status('W5'), 'fail');
  assert.match(by.W5.detail, /X shows another page's title or description on \/about/);
  assert.doesNotMatch(by.W5.detail, /brotli/); // the refused page isn't reported as missing tags
  assert.equal(status('W6'), 'warn');
  assert.match(by.W6.detail, /\/docs\/guide \(h1 to h3\)/);
  assert.equal(status('D8'), 'warn');
  assert.match(by.D8.detail, /\/docs\/guide lacks 2 sections/);

  // The rest of what the fixture does right.
  for (const id of ['D1', 'D6', 'D11', 'D12', 'W1', 'W2', 'W4', 'D5', 'D7', 'D15']) assert.equal(status(id), 'pass', `${id}: ${by[id]?.detail}`);

  // No API and no MCP endpoint: those checks skip; DNS skips under --base.
  assert.equal(rep.has_api, false);
  assert.equal(rep.hosted_mcp, false);
  for (const id of ['A1', 'A2', 'M1', 'M4', 'D10']) assert.equal(status(id), 'skip', id);

  // Google's Rich Results Test: the homepage, and one page of the template.
  assert.deepEqual(rep.rich_results_test.map((p) => [new URL(p.url).pathname.replace(/item-\d+$/, 'item-N'), p.features.join('+')]), [['/', 'Organization'], ['/items/item-N', 'Breadcrumb+Organization']]);
  assert.match(rep.rich_results_test[0].test, /^https:\/\/search\.google\.com\/test\/rich-results\?url=https%3A%2F%2Ffixture\.example%2F$/);

  // --logs reads what the audit just requested, and names it.
  const tally = logTally();
  site.log.forEach((l) => tally.add(l));
  const robots = tally.result().paths.find((p) => p.path === '/robots.txt');
  assert.deepEqual(Object.keys(robots.families), ['This audit (readiness-audit)']);
});

test('D7 warns about a 405 with no Allow header', async () => {
  const site = await startFixture({ allow: null });
  let rep;
  try { rep = await audit('fixture.example', { base: site.base }); } finally { await site.close(); }
  const d7 = rep.results.find((r) => r.id === 'D7');
  assert.equal(d7.status, 'warn');
  assert.match(d7.detail, /no Allow header/);
});
