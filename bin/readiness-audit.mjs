#!/usr/bin/env node
// readiness-audit: score a live site against the Agent and Search Readiness Standard.
//
//   readiness-audit <domain> [--mcp /path] [--no-mcp] [--no-api] [--json]
//   readiness-audit --matrix <domain> <domain> ...   (a markdown status page)
//
// Exits 1 when a required check fails, so it can gate a deploy.

import { audit, matrix, score, LEVELS, REVIEW, VERSION } from '../src/audit.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
if (flag('--version') || flag('-v')) {
  console.log(VERSION);
  process.exit(0);
}
const mcpOpt = flag('--mcp') ? args[args.indexOf('--mcp') + 1] : undefined;
const domains = args.filter((a, i) => !a.startsWith('-') && args[i - 1] !== '--mcp')
  .map((d) => d.replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
const opts = { hasApi: !flag('--no-api'), mcpPath: flag('--no-mcp') ? null : (mcpOpt ?? '/mcp') };

if (!domains.length || flag('--help') || flag('-h')) {
  console.error(`readiness-audit ${VERSION}

Usage:
  readiness-audit <domain> [--mcp /path] [--no-mcp] [--no-api] [--json]
  readiness-audit --matrix <domain> <domain> ...

Options:
  --mcp /path   where your hosted MCP endpoint lives (default /mcp)
  --no-mcp      skip the hosted MCP checks
  --no-api      skip the API checks, for a site with no public API
  --json        print the results as JSON
  --matrix      score several sites and print a markdown status page`);
  process.exit(domains.length ? 0 : 2);
}

if (flag('--matrix')) {
  const reports = await Promise.all(domains.map((d) => audit(d, opts)));
  console.log(matrix(reports, `npx readiness-audit --matrix ${domains.join(' ')}`));
} else {
  const rep = await audit(domains[0], opts);
  if (flag('--json')) console.log(JSON.stringify(rep, null, 2));
  else {
    const label = { pass: 'PASS', warn: 'WARN', fail: 'FAIL', skip: 'skip' };
    console.log(`Agent and search readiness: ${rep.domain}  (readiness-audit v${VERSION}, ${rep.checked_at.slice(0, 16)}Z)`);
    for (const level of LEVELS) {
      const rows = rep.results.filter((r) => r.level === level);
      if (!rows.length) continue;
      console.log(`\n${{ required: 'Required', recommended: 'Recommended', next: 'Next level' }[level]}`);
      for (const r of rows) console.log(`  ${label[r.status]}  ${r.id.padEnd(4)} ${r.name.padEnd(36)} ${r.detail}`);
    }
    console.log(`\nScore: required ${score(rep.results, 'required')}, recommended ${score(rep.results, 'recommended')}, next level ${score(rep.results, 'next')}`);
    console.log('\nNot scored, so check these yourself:');
    for (const [id, what] of REVIEW) console.log(`  ${id.padEnd(6)} ${what}`);
  }
  process.exitCode = rep.results.some((r) => r.level === 'required' && r.status === 'fail') ? 1 : 0;
}
