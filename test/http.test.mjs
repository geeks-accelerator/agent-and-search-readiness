// request(): one HTTP request on node:http, tested against a local server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { brotliCompressSync, gzipSync, deflateSync, deflateRawSync } from 'node:zlib';
import { request } from '../src/http.mjs';

// A server that answers each path its own way and records the headers it received.
async function serve(routes) {
  const seen = [];
  const srv = createServer((req, res) => {
    seen.push(req.headers);
    const [status, headers, body] = routes[req.url] ?? [404, {}, 'missing'];
    if (status === 'stall') return; // never answers
    res.writeHead(status, headers);
    res.end(body);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  return { base, seen, close: () => new Promise((r) => { srv.closeAllConnections(); srv.close(r); }) };
}

test('request refuses a Brotli body it never asked for, and keeps the status', async () => {
  const s = await serve({ '/br': [200, { 'content-encoding': 'br', 'content-type': 'text/plain' }, brotliCompressSync('secret')] });
  const r = await request(`${s.base}/br`, { userAgent: 'test' });
  await s.close();
  assert.equal(r.status, 200);
  assert.equal(r.text, '');
  assert.equal(r.error, 'refused: br body');
  assert.equal(s.seen[0]['accept-encoding'], 'gzip, deflate');
  assert.equal(s.seen[0]['user-agent'], 'test');
});

test('request decodes gzip and deflate, zlib-wrapped or raw', async () => {
  const s = await serve({
    '/gz': [200, { 'content-encoding': 'gzip' }, gzipSync('from gzip')],
    '/zlib': [200, { 'content-encoding': 'deflate' }, deflateSync('from deflate')],
    '/raw': [200, { 'content-encoding': 'deflate' }, deflateRawSync('from raw deflate')],
    '/plain': [200, { link: '</a>; rel="describedby"' }, 'plain'],
  });
  const [gz, zl, raw, plain] = await Promise.all(['/gz', '/zlib', '/raw', '/plain'].map((p) => request(s.base + p)));
  await s.close();
  assert.deepEqual([gz.text, zl.text, raw.text, plain.text], ['from gzip', 'from deflate', 'from raw deflate', 'plain']);
  assert.equal(plain.headers.get('link'), '</a>; rel="describedby"');
});

test('request sends Accept by default, and none when it is null', async () => {
  const s = await serve({ '/': [200, {}, 'ok'] });
  await request(`${s.base}/`);
  await request(`${s.base}/`, { method: 'POST', headers: { accept: null, 'content-type': 'application/json' }, body: '{}' });
  await s.close();
  assert.equal(s.seen[0].accept, '*/*');
  assert.equal(s.seen[1].accept, undefined);
  assert.equal(s.seen[1]['content-length'], '2');
});

test('request does not follow redirects, and ends a stalled answer', async () => {
  const s = await serve({ '/moved': [301, { location: '/new' }, ''], '/stall': ['stall'] });
  const moved = await request(`${s.base}/moved`);
  const stalled = await request(`${s.base}/stall`, { timeoutMs: 200 });
  await s.close();
  assert.equal(moved.status, 301);
  assert.equal(moved.headers.get('location'), '/new');
  assert.equal(stalled.status, 0);
  assert.match(stalled.error, /no answer in 0.2 seconds/);
});
