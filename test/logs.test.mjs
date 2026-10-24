// --logs: parsing, client families and the tally, without a network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLine, family, bucket, logTally, formatLogs } from '../src/logs.mjs';

const clf = (addr, method, path, status, ua) => `${addr} - - [01/Oct/2026:10:00:00 +0000] "${method} ${path} HTTP/1.1" ${status} 512 "-" "${ua}"`;

test('parseLine reads combined log format and the hosts\' JSON exports', () => {
  assert.deepEqual(parseLine(clf('203.0.113.5', 'GET', '/llms.txt?x=1', 200, 'curl/8.4.0')),
    { addr: '203.0.113.5', method: 'GET', path: '/llms.txt', status: 200, ua: 'curl/8.4.0' });
  // Cloudflare Logpush
  assert.deepEqual(parseLine('{"ClientIP":"203.0.113.6","ClientRequestMethod":"GET","ClientRequestPath":"/robots.txt","EdgeResponseStatus":200,"ClientRequestUserAgent":"GPTBot/1.2"}'),
    { path: '/robots.txt', ua: 'GPTBot/1.2', addr: '203.0.113.6', method: 'GET', status: 200 });
  // Vercel log drain: nested, user agent as an array
  assert.deepEqual(parseLine('{"proxy":{"path":"/.well-known/agent-card.json","userAgent":["AgenstryBot/1.0"],"clientIp":"203.0.113.7","method":"GET","statusCode":404}}'),
    { path: '/.well-known/agent-card.json', ua: 'AgenstryBot/1.0', addr: '203.0.113.7', method: 'GET', status: 404 });
  // Railway HTTP logs
  assert.deepEqual(parseLine('{"path":"/llms.txt","method":"GET","httpStatus":200,"clientUa":"python-httpx/0.27","srcIp":"203.0.113.8"}'),
    { path: '/llms.txt', ua: 'python-httpx/0.27', addr: '203.0.113.8', method: 'GET', status: 200 });
  // A full URL as the path
  assert.equal(parseLine('{"url":"https://example.com/llms-full.txt?v=2","userAgent":"node"}').path, '/llms-full.txt');
  assert.equal(parseLine('not a log line'), null);
  assert.equal(parseLine('{"broken json'), null);
  assert.equal(parseLine(''), null);
});

test('family puts each client in the first matching family', () => {
  assert.equal(family('readiness-audit/2.0.0 (+https://github.com/geeks-accelerator/agent-and-search-readiness)'), 'This audit (readiness-audit)');
  assert.equal(family('agentprobe/0.1.0 (+https://agentprobe.org/methodology)'), 'Other audit tools');
  assert.equal(family('Mozilla/5.0 (compatible; SemrushBot/7~bl)'), 'Other audit tools');
  assert.equal(family('AgenstryBot/1.0'), 'Agent and MCP directories');
  assert.equal(family('llms.txt-directory/1.0'), 'llms.txt directories');
  assert.equal(family('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0)'), 'Assistants fetching for a person');
  assert.equal(family('Mozilla/5.0 (compatible; ClaudeBot/1.0)'), 'AI crawlers');
  assert.equal(family('Mozilla/5.0 (compatible; Googlebot/2.1)'), 'Search crawlers');
  assert.equal(family('python-httpx/0.27'), 'Scripts');
  assert.equal(family('Mozilla/5.0 HeadlessChrome/120.0'), 'Headless browsers');
  assert.equal(family('SomeRandomCrawler/2'), 'Other bots');
  assert.equal(family('Mozilla/5.0 (Macintosh) Chrome/130.0'), 'Browsers');
  assert.equal(family('-'), 'No user agent');
  assert.equal(family('weird-client'), 'Unidentified');
});

test('bucket groups the discovery paths', () => {
  assert.equal(bucket('/llms.txt'), '/llms.txt');
  assert.equal(bucket('/api'), '/api');
  assert.equal(bucket('/mcp'), '/mcp');
  assert.equal(bucket('/.well-known/agents.json'), 'other /.well-known paths');
  assert.equal(bucket('/docs/api.md'), '/docs/api.md');
  assert.equal(bucket('/guide.md'), 'markdown pages (*.md)');
  assert.equal(bucket('/about'), null);
  assert.equal(bucket('/api/pets'), null);
});

test('logTally counts readers who also called the API, and unverified clients only by the API', () => {
  const t = logTally();
  t.add(clf('198.51.100.1', 'GET', '/llms.txt', 200, 'curl/8.4.0'));
  t.add(clf('198.51.100.1', 'POST', '/api/pets', 201, 'curl/8.4.0'));
  t.add(clf('198.51.100.2', 'GET', '/llms.txt', 200, 'AgenstryBot/1.0'));
  t.add(clf('198.51.100.3', 'GET', '/api/pets', 200, 'Mozilla/5.0 (Macintosh) Chrome/130.0'));
  t.add('garbage');
  const rep = t.result();
  assert.equal(rep.lines, 5);
  assert.equal(rep.parsed, 4);
  assert.deepEqual(rep.paths, [{ path: '/llms.txt', requests: 2, families: { Scripts: 1, 'Agent and MCP directories': 1 }, addresses: 2, also_called_api: 1 }]);
  assert.equal(rep.api_addresses, 2);
  assert.equal(rep.unverified_api_addresses, 1);
  const text = formatLogs(rep).join('\n');
  assert.match(text, /\/llms\.txt {2}2 requests, 2 addresses, 1 of them also called the API/);
  assert.doesNotMatch(text, /198\.51\.100/); // never prints addresses
});

test('logTally counts secret-file probes sent under crawler names', () => {
  const t = logTally();
  t.add(clf('198.51.100.9', 'GET', '/agents/.env', 404, 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)'));
  t.add(clf('198.51.100.9', 'GET', '/.git/config', 404, 'Mozilla/5.0 (compatible; ClaudeBot/1.0)'));
  t.add(clf('198.51.100.9', 'GET', '/@fs/etc/passwd', 404, 'Mozilla/5.0 (compatible; Googlebot/2.1)'));
  t.add(clf('198.51.100.8', 'GET', '/llms.txt', 200, 'Mozilla/5.0 (compatible; GPTBot/1.2)')); // a real path: not counted
  t.add(clf('198.51.100.7', 'GET', '/.env', 404, 'curl/8.4.0')); // a probe, but not under a crawler name
  t.add(clf('198.51.100.8', 'GET', '/wp-content/themes/x.css', 200, 'Mozilla/5.0 (compatible; Googlebot/2.1)')); // a WordPress site's real asset
  const rep = t.result();
  assert.deepEqual(rep.crawler_names_on_secret_probes, { requests: 3, families: { 'AI crawlers': 2, 'Search crawlers': 1 } });
  assert.match(formatLogs(rep).join('\n'), /3 requests under crawler names asked for secret files .*AI crawlers 2, Search crawlers 1/);
  assert.match(formatLogs(logTally().result()).join('\n'), /No request under a crawler name asked for secret files/);
});
