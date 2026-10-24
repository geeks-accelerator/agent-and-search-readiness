// The audit's one HTTP request, on node:http(s). Internal: the package exports only audit.mjs.
//
// Not fetch(): fetch decodes a Brotli body even when the request didn't ask for one, so a
// hostile site could hand any body to the Brotli decoder (CVE-2026-111497 was an out-of-bounds
// write there). node:http decodes nothing; this decodes gzip and deflate and refuses the rest.
// Every body is capped, before and after decoding, so a site that answers with a zip bomb or an
// endless stream can't exhaust the memory of the machine running the audit.

import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { gunzipSync, inflateSync, inflateRawSync } from 'node:zlib';

export const TIMEOUT_MS = 15000;
// Large enough for a big llms-full.txt or OpenAPI document, small enough to be safe.
export const MAX_BYTES = 16 * 1024 * 1024;

/**
 * One request, no redirects followed. Headers default to `accept: *\/*` and
 * `accept-encoding: gzip, deflate`; a header set to null isn't sent (M4's no-Accept probe).
 * Resolves, never rejects: { status, headers (a Headers object), text, error?, tooBig? }, status 0
 * on no answer. tooBig: the body passed maxBytes, raw or decoded; reading stopped and the text is empty.
 */
export function request(url, { method = 'GET', headers = {}, body, userAgent, timeoutMs = TIMEOUT_MS, maxBytes = MAX_BYTES } = {}) {
  const target = new URL(url);
  const send = target.protocol === 'http:' ? httpRequest : httpsRequest;
  const all = { 'user-agent': userAgent, accept: '*/*', 'accept-encoding': 'gzip, deflate', ...headers };
  if (body !== undefined) all['content-length'] = Buffer.byteLength(body);
  const sent = Object.fromEntries(Object.entries(all).filter(([, v]) => v !== null && v !== undefined));
  const none = (error) => ({ status: 0, headers: new Headers(), text: '', error });
  const failed = (e) => none(e.name === 'AbortError' || e.name === 'TimeoutError' ? `no answer in ${timeoutMs / 1000} seconds` : e.message);
  const headersOf = (res) => new Headers(Object.entries(res.headers).flatMap(([k, v]) => [].concat(v).map((x) => [k, String(x)])));
  const mb = (n) => (n >= 1024 * 1024 ? `${Math.round(n / 1024 / 1024)} MB` : `${Math.round(n / 1024)} KB`);
  return new Promise((resolve) => {
    let settled = false;
    const done = (out) => { if (!settled) { settled = true; resolve(out); } };
    const req = send(target, { method, headers: sent, signal: AbortSignal.timeout(timeoutMs) }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size > maxBytes) {
          done({ status: res.statusCode, headers: headersOf(res), text: '', tooBig: true, error: `body over ${mb(maxBytes)}` });
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      res.on('error', (e) => done(failed(e)));
      res.on('end', () => {
        const headers = headersOf(res);
        const raw = Buffer.concat(chunks);
        const encoding = (headers.get('content-encoding') ?? 'identity').trim().toLowerCase();
        const out = { status: res.statusCode, headers, text: '' };
        const opts = { maxOutputLength: maxBytes };
        try {
          if (encoding === 'identity' || encoding === '') out.text = raw.toString('utf8');
          else if (encoding === 'gzip' || encoding === 'x-gzip') out.text = gunzipSync(raw, opts).toString('utf8');
          else if (encoding === 'deflate') { try { out.text = inflateSync(raw, opts).toString('utf8'); } catch (e) { if (e.code === 'ERR_BUFFER_TOO_LARGE') throw e; out.text = inflateRawSync(raw, opts).toString('utf8'); } } // zlib-wrapped, or raw as some servers send it
          else out.error = `refused: ${encoding} body`;
        } catch (e) {
          if (e.code === 'ERR_BUFFER_TOO_LARGE') { out.tooBig = true; out.error = `${encoding} body decodes to over ${mb(maxBytes)}`; }
          else out.error = `undecodable ${encoding} body: ${e.message}`;
        }
        done(out);
      });
    });
    req.on('error', (e) => done(failed(e)));
    req.end(body);
  });
}
