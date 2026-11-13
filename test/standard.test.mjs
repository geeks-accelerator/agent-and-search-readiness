// Guard tests: the scorecard, its version and the standard can't drift apart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { VERSION, REVIEW, score, matrix, isPrivateAddress, makeGuard } from '../src/audit.mjs';
import { request } from '../src/http.mjs';
import { NODE_LINES, NODE_REQUIREMENT, nodeOk } from '../src/helpers.mjs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../src/audit.mjs', import.meta.url), 'utf8');
const standard = readFileSync(new URL('../STANDARD.md', import.meta.url), 'utf8');
const inChecklist = (id) => new RegExp(`^\\| ${id} \\|`, 'm').test(standard);

test('VERSION matches package.json', () => {
  assert.equal(VERSION, pkg.version);
});

test("the README's sample output is from this version", () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const shown = readme.match(/\(readiness-audit v(\d+\.\d+\.\d+)/)?.[1];
  assert.equal(shown, pkg.version, 'rerun the Quick start sample against a real site and paste the new output');
});

test('"Last verified" is no earlier than the newest source read in §16', () => {
  const verified = standard.match(/^\*\*Last verified:\*\* (\d{4}-\d{2}-\d{2})$/m)?.[1];
  assert.ok(verified, 'STANDARD.md should have a "Last verified" line');
  const sources = standard.slice(standard.indexOf('## 16.'));
  const newest = [...sources.matchAll(/read (\d{4}-\d{2}-\d{2})/g)].map((m) => m[1]).sort().at(-1);
  assert.ok(verified >= newest, `Last verified is ${verified}, but §16 cites a source read ${newest}`);
});

test('package.json, the docs and the CI matrix name the Node lines the CLI accepts', () => {
  const v = Object.values(NODE_LINES);
  assert.equal(pkg.engines.node, `${v.slice(0, -1).map((x) => `^${x}`).join(' || ')} || >=${v.at(-1)}`);
  for (const file of ['README.md', 'STANDARD.md', 'AGENTS.md', 'SECURITY.md']) {
    assert.ok(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').includes(NODE_REQUIREMENT), `${file} should say "${NODE_REQUIREMENT}"`);
  }
  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(ci, new RegExp(`node: \\[${Object.keys(NODE_LINES).join(', ')}\\]`));
});

test('nodeOk accepts each line at its security release, and refuses older ones', () => {
  for (const ok of ['22.23.4', '22.24.0', '24.22.1', '26.12.1', '26.13.0', '28.0.0']) assert.equal(nodeOk(ok), true, ok);
  for (const no of ['22.23.3', '24.21.0', '26.12.0', '26.10.0', '25.9.0', '20.19.0', '27.0.0']) assert.equal(nodeOk(no), false, no);
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

test('matrix shows recorded T5 and T6 results, and says when they are missing', () => {
  const report = (domain) => ({ domain, hosted_mcp: false, results: [{ id: 'D1', name: 'robots.txt', level: 'required', status: 'pass', detail: 'x' }] });
  const recorded = { 'a.example': { T5: { attempts: 5, first_try: 4, date: '2026-10-12' }, T6: { result: 'clicks 24 | CTR 3.8%' } } };
  const md = matrix([report('a.example'), report('b.example')], 'cmd', recorded);
  assert.match(md, /^\| T5 \| Agent usability test \(recorded\) \| required \| 4 of 5 first try \(2026-10-12\) \| not recorded \|$/m);
  assert.match(md, /^\| T6 \| Search numbers \(recorded\) \| required \| clicks 24 \/ CTR 3\.8% \| not recorded \|$/m);
});

test('each check runs at the level the standard checklist gives it', () => {
  const levels = new Map([
    ...[...source.matchAll(/const id = '([A-Z]\d+)', name = '[^']*', level = '(\w+)'/g)].map((m) => [m[1], m[2]]),
    ...[...source.matchAll(/(?:pass|miss|skip)\('([A-Z]\d+)', '[^']*', '(\w+)'/g)].map((m) => [m[1], m[2]]),
  ]);
  const short = { required: 'R', recommended: 'Rec', next: 'N' };
  assert.ok(levels.size > 20);
  for (const [id, level] of levels) {
    const row = standard.match(new RegExp(`^\\| ${id} \\| [^|]* \\| ([^|]+) \\|`, 'm'));
    assert.ok(row, `${id} has no checklist row`);
    assert.equal(row[1].trim(), short[level], `${id} runs as ${level} but the checklist says ${row[1].trim()}`);
  }
});

test('private and local addresses are recognized, public ones are not', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1',
    // IPv4 inside IPv6, in the hex form the URL parser writes: mapped, compatible, NAT64, 6to4
    '::ffff:7f00:1', '::ffff:a9fe:a9fe', '::7f00:1', '64:ff9b::7f00:1', '64:ff9b::a9fe:a9fe', '2002:a9fe:a9fe::1',
    '198.18.0.1', '198.19.255.255', '224.0.0.1', '240.0.0.1', '255.255.255.255', 'ff02::1']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '198.20.0.1', '2606:4700::1111', '::ffff:808:808', '64:ff9b::808:808', '2002:808:808::1', 'example.com']) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test('the audit refuses URLs a site supplies that point at private or local addresses', async () => {
  const { isSafe } = makeGuard('example.com');
  for (const url of ['https://example.com/sitemap.xml', 'http://example.com/', 'https://www.example.com/page']) {
    assert.equal(await isSafe(url), true, url);
  }
  for (const url of ['http://localhost:8080/', 'https://169.254.169.254/latest/meta-data/', 'https://10.0.0.5/', 'http://[::1]/', 'https://printer.local/', 'ftp://example.org/', 'file:///etc/passwd', 'not a url',
    'http://[::ffff:127.0.0.1]/', 'http://[::ffff:169.254.169.254]/', 'http://198.18.0.1/', 'http://[64:ff9b::7f00:1]/', 'http://no-such-host.invalid/']) {
    assert.equal(await isSafe(url), false, url);
  }
});

test('the guard checks the address it connects to, not only the one it looked up first', async () => {
  const { connectLookup } = makeGuard('example.com');
  const srv = createServer((req, res) => res.end('reached'));
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const r = await request(`http://localhost:${srv.address().port}/`, { lookup: connectLookup });
  await new Promise((r2) => { srv.closeAllConnections(); srv.close(r2); });
  assert.equal(r.status, 0);
  assert.match(r.error, /refused: localhost resolves to a private address/);
});
