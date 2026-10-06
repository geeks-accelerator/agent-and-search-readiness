# Recipes

Short, working patterns for items in [STANDARD.md](../STANDARD.md), collected from the projects that adopted it. The examples use Next.js App Router route handlers because most of our projects do; the logic carries over to any stack.

## One catch-all for unknown /.well-known paths (D7, D11)

Crawlers sweep dozens of guessed paths under `/.well-known/`. One catch-all answers all of them with a JSON 404 that lists what you do serve, and covers the A2A path (D11) at the same time. Real files and specific routes under `/.well-known` still win over it.

```ts
// app/.well-known/[...path]/route.ts
const AVAILABLE = {
  llms_txt: 'https://example.com/llms.txt',
  openapi: 'https://example.com/openapi.json',
  mcp: 'https://example.com/mcp',
  ai_catalog: 'https://example.com/.well-known/ai-catalog.json',
};

export function GET(_request: Request, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  const a2a = path === 'agent-card.json' || path === 'agent.json';
  return Response.json(
    {
      error: a2a
        ? 'No A2A agent card: this site runs no A2A endpoint. Use MCP or the REST API.'
        : `Nothing at /.well-known/${path}.`,
      available: AVAILABLE,
    },
    { status: 404 },
  );
}
```

Delete any static `public/.well-known/agent-card.json` first: a file in `public/` takes precedence over the route. The other half of D7, a JSON 405 for `POST /`, belongs in middleware.

## GET /api: JSON for agents, the docs for browsers (A2)

People click `/api` links too. Send a browser that asks for HTML to the docs, and give everyone else the JSON index.

```ts
// app/api/route.ts
export function GET(request: Request) {
  if ((request.headers.get('accept') ?? '').includes('text/html')) {
    // Relative, so it stays right behind a proxy that rewrites the host.
    return new Response(null, { status: 302, headers: { Location: '/docs/api', Vary: 'Accept' } });
  }
  return Response.json(
    { name: 'example', openapi: 'https://example.com/openapi.json', operations: listOperations() },
    { headers: { Vary: 'Accept' } },
  );
}
```

`listOperations()` should come from the same source as `/openapi.json`, so the index can't drift from the spec.

## did_you_mean from the OpenAPI paths (A7)

Agents guess paths (`/api/relations` for `/api/relationships`). Suggest the closest real one by edit distance, after treating ids and `{params}` as wildcards.

```ts
// app/api/[...path]/route.ts
import spec from '@/generated/openapi.json';

const shape = (path: string) => path
  .split('/')
  .map((seg) => (/^\{.+\}$/.test(seg) || /^[0-9a-f-]{8,}$|^\d+$/i.test(seg) ? '*' : seg.toLowerCase()))
  .join('/');
const KNOWN = Object.keys(spec.paths).map((path) => ({ path, shape: shape(path) }));

function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[b.length];
}

function didYouMean(path: string): string | null {
  const wanted = shape(path);
  const best = KNOWN.map((k) => ({ ...k, d: distance(wanted, k.shape) })).sort((a, b) => a.d - b.d)[0];
  return best && best.d <= Math.max(3, Math.floor(wanted.length * 0.3)) ? best.path : null;
}

export function GET(request: Request) {
  const path = new URL(request.url).pathname;
  return Response.json(
    { error: `No endpoint at ${path}.`, did_you_mean: didYouMean(path), docs: 'https://example.com/docs/api' },
    { status: 404 },
  );
}
// Export the same handler for POST, PUT, PATCH and DELETE.
```

## Unreplaced placeholders in ids (A6)

An agent that copies an example from your docs sends `/api/agents/{{AGENT_ID}}`. That request matches a real route, so the catch-all never sees it, and the route's own not-found answer should say what happened.

```ts
// Shared by every route that looks something up by id.
const PLACEHOLDER = /^(\{\{.*\}\}|<.+>|\{[a-z_]+\}|:[a-z_]+|YOUR_[A-Z_]+)$/;

export function notFound(kind: string, id: string) {
  const placeholder = PLACEHOLDER.test(id);
  return Response.json(
    {
      error: placeholder
        ? `"${id}" looks like a placeholder copied from the docs. Use a real ${kind} id.`
        : `No ${kind} with id "${id}".`,
      suggestion: `List yours with GET /api/${kind}s, then use an id from that list.`,
    },
    { status: 404 },
  );
}
```

Keep the pattern strict, as above, so a real id is never mistaken for a placeholder. Next.js has already decoded the path segment by the time a route gets it.

## One auth helper for every route (A9, A10)

Every authenticated route calls one helper that returns either the user or the response to send. That keeps the answers consistent: 401 only for a missing or wrong key, 429 for too many failed checks, and 503 when the check itself couldn't run. A 401 for anything else tells an agent with a valid key to get a new one.

```ts
// lib/auth.ts
import { createHash } from 'node:crypto';

type AuthResult = { user: User; response?: undefined } | { user?: undefined; response: Response };

const verified = new Map<string, { user: User; expires: number }>(); // fast hash of the key -> user
const failures = new Map<string, number[]>(); // client IP -> times of recent failed checks

export async function requireAuth(request: Request): Promise<AuthResult> {
  const key = extractKey(request); // Bearer header, any casing
  if (!key) return { response: problem(401, 'Send your API key as Authorization: Bearer <key>. No key yet? Register first.') };

  const ip = clientIp(request);
  const recent = (failures.get(ip) ?? []).filter((t) => t > Date.now() - 60_000);
  if (recent.length >= 20) return { response: problem(429, 'Too many failed key checks from this address.', { 'Retry-After': '60' }) };

  const id = createHash('sha256').update(key).digest('hex');
  const hit = verified.get(id);
  if (hit && hit.expires > Date.now()) return { user: hit.user };

  let user: User | null;
  try {
    user = await verifyKey(key); // prefix lookup plus bcrypt compare
  } catch {
    return { response: problem(503, "Couldn't check your key just now. It's fine; retry shortly.", { 'Retry-After': '5' }) };
  }
  if (!user) {
    failures.set(ip, [...recent, Date.now()]); // count failures only
    return { response: problem(401, 'That key is not valid. No key yet? Register first.') };
  }
  verified.set(id, { user, expires: Date.now() + 60_000 });
  return { user };
}

// When a key rotates or an account is suspended, clear its entry: verified.delete(sha256(oldKey)).
```

In a route: `const auth = await requireAuth(request); if (auth.response) return auth.response;`. The maps live in one process: cap their size, and with several instances accept per-instance limits or move them to a shared store.

## Test accounts out of public pages (T5, W3)

The agent usability test creates real accounts with a test prefix. Keep them off everything the public and other agents see.

```ts
// lib/test-accounts.ts
export const TEST_PREFIX = 'test-usability-';
export const isTestAccount = (username: string) => username.toLowerCase().startsWith(TEST_PREFIX);
```

- **Listings, search and counts:** filter them in the query, so totals stay right (`username NOT ILIKE 'test-usability-%'`), not after the fact in code.
- **Excerpts other agents see:** leave out anything a test account wrote.
- **Their own pages:** render them with `noindex`, and leave them out of the sitemap (W3).
- **A guard test:** create a test account in a fixture and assert it appears in none of the public lists, counts or the sitemap.

## Markdown for agents without a CDN plan (D8)

Before building this, find out whether anyone asks. Host logs often can't tell you (Railway's keep the user agent but not `Accept`), so log markdown requests in middleware for a few weeks:

```ts
// middleware.ts
const accept = request.headers.get('accept') ?? '';
if (accept.includes('text/markdown')) {
  console.log(`[markdown] ${request.nextUrl.pathname} | ${request.headers.get('user-agent') ?? '-'}`);
}
```

If agents do ask, start with the homepage. animalhouse serves its llms.txt as the homepage's markdown:

```ts
// middleware.ts: Accept: text/markdown on / gets the markdown route
if (request.nextUrl.pathname === '/' && accept.includes('text/markdown')) {
  const url = request.nextUrl.clone();
  url.pathname = '/index.md';
  return NextResponse.rewrite(url);
}

// app/index.md/route.ts: also reachable directly as /index.md
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const dynamic = 'force-static';

export async function GET() {
  const markdown = await readFile(join(process.cwd(), 'public', 'llms.txt'), 'utf8');
  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept',
      'x-markdown-tokens': String(Math.ceil(markdown.length / 4)), // about four characters per token
      Link: '<https://example.com/>; rel="canonical"',
    },
  });
}
```

The HTML side needs `Vary: Accept` too, and Next.js 14.2 overwrites `Vary` on App Router pages. Add it with a CDN response header rule, or decline that half in writing.
