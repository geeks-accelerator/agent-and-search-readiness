#!/usr/bin/env node
// readiness-audit: score a live site against the Agent and Search Readiness Standard.
//
//   readiness-audit <domain> [--mcp /path] [--no-mcp] [--json] [--compare previous] [--base url]
//   readiness-audit --matrix <domain> <domain> ... [--recorded results.json]   (a markdown status page)
//   readiness-audit --logs <access-log> [--json]   (who requests the discovery files)
//
// Exits 1 when a required check fails, so it can gate a deploy.

import { readFileSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { audit, matrix, score, LEVELS, REVIEW, VERSION } from '../src/audit.mjs';
import { parsePrevious, compareResults, formatComparison } from '../src/helpers.mjs';
import { logTally, formatLogs } from '../src/logs.mjs';

// engines in package.json only warns, so say it plainly before anything fails oddly.
const NODE_MAJOR = 26;
if (Number(process.versions.node.split('.')[0]) < NODE_MAJOR) {
  console.error(`readiness-audit needs Node ${NODE_MAJOR} or later, with current security releases (this is ${process.versions.node}).`);
  process.exit(2);
}

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
if (flag('--version') || flag('-v')) {
  console.log(VERSION);
  process.exit(0);
}
const valueOf = (name) => (flag(name) ? args[args.indexOf(name) + 1] : undefined);
const mcpOpt = valueOf('--mcp');
const recordedPath = valueOf('--recorded');
const comparePath = valueOf('--compare');
const base = valueOf('--base');
const logsPath = valueOf('--logs');
const domains = args.filter((a, i) => !a.startsWith('-') && !['--mcp', '--recorded', '--compare', '--base', '--logs'].includes(args[i - 1]))
  .map((d) => d.replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
const opts = { mcpPath: flag('--no-mcp') ? null : (mcpOpt ?? '/mcp'), base: base ?? null };
if (base) {
  let u;
  try { u = new URL(base); } catch { u = null; }
  if (!u || !['http:', 'https:'].includes(u.protocol)) { console.error(`--base needs an http(s) URL, like http://localhost:3000 (got ${base})`); process.exit(2); }
}

if (logsPath) {
  const tally = logTally();
  try {
    for await (const line of createInterface({ input: createReadStream(logsPath), crlfDelay: Infinity })) tally.add(line);
  } catch (e) { console.error(`Couldn't read ${logsPath}: ${e.message}`); process.exit(2); }
  const rep = tally.result();
  console.log(flag('--json') ? JSON.stringify(rep, null, 2) : formatLogs(rep).join('\n'));
  process.exit(0);
}

if (!domains.length || flag('--help') || flag('-h')) {
  console.error(`readiness-audit ${VERSION}

Usage:
  readiness-audit <domain> [--mcp /path] [--no-mcp] [--json] [--compare previous] [--base url]
  readiness-audit --matrix <domain> <domain> ... [--recorded results.json]
  readiness-audit --logs <access-log> [--json]

Options:
  --mcp /path   where your hosted MCP endpoint lives (default /mcp)
  --no-mcp      skip the hosted MCP checks
  --json        print the results as JSON
  --matrix      score several sites and print a markdown status page
  --recorded f  with --matrix: add recorded T5 and T6 results from a JSON file
  --compare f   list what changed since a previous run: a status page from
                --matrix (docs/readiness-status.md) or a saved --json report
  --base url    score a local or preview build as the domain, before you
                deploy (http://localhost:3000); DNS and host redirects are
                skipped
  --logs f      count requests for the discovery files in an exported access
                log (combined log format or JSON lines), by client family;
                prints counts, never addresses

The API checks run when /openapi.json or /api answers, or the site declares
an API (a service-desc link, an API catalog, an API link in llms.txt).`);
  process.exit(domains.length ? 0 : 2);
}

if (flag('--matrix')) {
  if (comparePath || base) console.error('--compare and --base work with a single domain; ignoring them for --matrix.');
  opts.base = null;
  let recorded = {};
  if (recordedPath) {
    try { recorded = JSON.parse(readFileSync(recordedPath, 'utf8')); }
    catch (e) { console.error(`Couldn't read ${recordedPath}: ${e.message}`); process.exit(2); }
  }
  const reports = await Promise.all(domains.map((d) => audit(d, opts)));
  const pinned = `readiness-audit@${VERSION.split('.')[0]}`; // the major version, as STANDARD.md §14 says to pin it
  console.log(matrix(reports, `npx ${pinned} --matrix ${domains.join(' ')}${recordedPath ? ` --recorded ${recordedPath}` : ''}`, recorded));
} else {
  let previous = null;
  if (comparePath) {
    let text;
    try { text = readFileSync(comparePath, 'utf8'); }
    catch (e) { console.error(`Couldn't read ${comparePath}: ${e.message}`); process.exit(2); }
    previous = parsePrevious(text, domains[0]);
    if (!previous) { console.error(`${comparePath} has no results for ${domains[0]}`); process.exit(2); }
  }
  const rep = await audit(domains[0], opts);
  const since = previous ? `${previous.date ?? 'the previous run'} (${comparePath})` : null;
  const changes = previous ? compareResults(previous.results, rep.results) : null;
  if (flag('--json')) console.log(JSON.stringify(changes ? { ...rep, changes: { since: previous.date, ...changes } } : rep, null, 2));
  else {
    const label = { pass: 'PASS', warn: 'WARN', fail: 'FAIL', skip: 'skip' };
    console.log(`Agent and search readiness: ${rep.domain}${rep.base ? ` via ${rep.base}` : ''}  (readiness-audit v${VERSION}, ${rep.checked_at.slice(0, 16)}Z)`);
    for (const level of LEVELS) {
      const rows = rep.results.filter((r) => r.level === level);
      if (!rows.length) continue;
      console.log(`\n${{ required: 'Required', recommended: 'Recommended', next: 'Next level' }[level]}`);
      for (const r of rows) console.log(`  ${label[r.status]}  ${r.id.padEnd(4)} ${r.name.padEnd(36)} ${r.detail}`);
    }
    console.log(`\nScore on ${rep.checked_at.slice(0, 10)}: required ${score(rep.results, 'required')}, recommended ${score(rep.results, 'recommended')}, next level ${score(rep.results, 'next')}`);
    if (changes) console.log(`\n${formatComparison(changes, since).join('\n')}`);
    console.log('\nNot scored, so check these yourself:');
    for (const [id, what] of REVIEW) {
      console.log(`  ${id.padEnd(6)} ${what}`);
      if (id === 'W4') for (const p of rep.rich_results_test ?? []) console.log(`         ${p.url} (${p.features.join(', ')})\n           ${p.test}`);
    }
  }
  process.exitCode = rep.results.some((r) => r.level === 'required' && r.status === 'fail') ? 1 : 0;
}
