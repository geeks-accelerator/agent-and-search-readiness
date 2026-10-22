// The audit's one HTTP request, on node:http(s). Internal: the package exports only audit.mjs.
//
// Not fetch(): fetch decodes a Brotli body even when the request didn't ask for one, so a
// hostile site could hand any body to the Brotli decoder (CVE-2026-111497 was an out-of-bounds
// write there). node:http decodes nothing; this decodes gzip and deflate and refuses the rest.

import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { gunzipSync, inflateSync, inflateRawSync } from 'node:zlib';

export const TIMEOUT_MS = 15000;

/**
 * One request, no redirects followed. Headers default to `accept: *\/*` and
 * `accept-encoding: gzip, deflate`; a header set to null isn't sent (M4's no-Accept probe).
 * Resolves, never rejects: { status, headers (a Headers object), text, error? }, status 0 on no answer.
 */
export function request(url, { method = 'GET', headers = {}, body, userAgent, timeoutMs = TIMEOUT_MS } = {}) {
  const target = new URL(url);
  const send = target.protocol === 'http:' ? httpRequest : httpsRequest;
  const all = { 'user-agent': userAgent, accept: '*/*', 'accept-encoding': 'gzip, deflate', ...headers };
  if (body !== undefined) all['content-length'] = Buffer.byteLength(body);
  const sent = Object.fromEntries(Object.entries(all).filter(([, v]) => v !== null && v !== undefined));
  const none = (error) => ({ status: 0, headers: new Headers(), text: '', error });
  return new Promise((resolve) => {
    const req = send(target, { method, headers: sent, signal: AbortSignal.timeout(timeoutMs) }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('error', (e) => resolve(none(e.message)));
      res.on('end', () => {
        const headers = new Headers(Object.entries(res.headers).flatMap(([k, v]) => [].concat(v).map((x) => [k, String(x)])));
        const raw = Buffer.concat(chunks);
        const encoding = (headers.get('content-encoding') ?? 'identity').trim().toLowerCase();
        const out = { status: res.statusCode, headers, text: '' };
        try {
          if (encoding === 'identity' || encoding === '') out.text = raw.toString('utf8');
          else if (encoding === 'gzip' || encoding === 'x-gzip') out.text = gunzipSync(raw).toString('utf8');
          else if (encoding === 'deflate') { try { out.text = inflateSync(raw).toString('utf8'); } catch { out.text = inflateRawSync(raw).toString('utf8'); } } // zlib-wrapped, or raw as some servers send it
          else out.error = `refused: ${encoding} body`;
        } catch (e) { out.error = `undecodable ${encoding} body: ${e.message}`; }
        resolve(out);
      });
    });
    req.on('error', (e) => resolve(none(e.name === 'AbortError' || e.name === 'TimeoutError' ? `no answer in ${timeoutMs / 1000} seconds` : e.message)));
    req.end(body);
  });
}
