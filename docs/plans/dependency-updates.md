# Plan: bring every pinned version up to date

Written 2026-10-21, after Node's security release that day, from an audit of every version the repo names. Revised the same day after an audit of the code, and set to Node 26 only at the user's direction.

**Status (2026-10-21):** steps 1 to 4, 6 and 7 are done and committed in 2.0.0; the localhost pass became `test/audit.test.mjs`. Open: step 5's Next.js 16.4 and zod-to-openapi v9 re-checks (they need animalhouse's and drifts' agents). This machine runs Node 26.12.1 (upgraded 2026-10-22), and the tests pass on it. It ships inside 2.0.0, which is committed and not yet published.

## What the audit found

The package has no dependencies and no lockfile, as AGENTS.md requires, so there's nothing for `npm audit` to read. The versions that matter are the runtime, the CI actions, and the specs and libraries the checks and the standard are written against.

### Runtime and tooling

| What | Where | Now | Latest (2026-10-21) | Action |
|---|---|---|---|---|
| Node.js floor | `package.json` `engines`, README, STANDARD.md, AGENTS.md, `src/audit.mjs` header | `>=20`, "Node 20 or later" | 20 ended 2026-04-30; patched lines are 22.23.4, 24.22.1, 26.12.1 | `>=26`, "Node 26 or later, with current security releases"; the CLI refuses an older major |
| CI matrix | `.github/workflows/ci.yml` | 20, 22, 24 | 26 (LTS from 2026-10-28, supported to 2029-04-30) | 26 |
| Release tests | `.github/workflows/release.yml` | its own `npm test` on 24 | n/a | run the CI workflow before publishing, on 26 (below) |
| npm in the release job | `release.yml` | `npm install -g npm@latest` | 12.2.1 | `npm@12`: a major pin, so a future major can't change the publish step unannounced |
| Example workflow runtime | `examples/github-action.yml` | 22 | 26 | 26 |
| `actions/checkout`, `actions/setup-node` | all three workflows | `@v7` | v7.0.1, v7.1.0 | current; the major pins pick up patches |
| Updates over time | none | nothing watches the actions | n/a | `.github/dependabot.yml` for the `github-actions` ecosystem, weekly |
| This machine | local | Node 26.10.0 | 26.12.1 | upgrade (the user's step) |

### Specs and schemas the checks are built against

| What | Where | Now | Latest | Action |
|---|---|---|---|---|
| MCP protocol | M checks (`2026-07-28`, legacy `2025-11-25`) | 2026-07-28 | 2026-07-28 | current |
| MCP structured tool output | N6's source in §16 | spec 2025-06-18 | the 2026-07-28 spec covers it | cite the 2026-07-28 page |
| A2A | D11 | v1.0.1 | v1.0.1 | current |
| AID | D10 | v2.1.1 (`aid2`) | v2.1.1 | current |
| Agent Skills discovery | S2 (`0.2.0/schema.json`) | 0.2.0 | 0.2.0 (last change 2026-03-24) | current; the schema host doesn't resolve, which is fine: the audit compares the `$schema` string, as the RFC defines it |
| MCP server card | M5, D12 (`schemas/v1/server-card.schema.json`) | v1 | v1, pre-release; the URL answers 404 until the extension graduates | current, same reasoning |
| ARD | D9 | v0.91 | v0.91 (last change 2026-10-12) | current; re-read the latest changes for anything D9 checks |

### Libraries named in the standard's evidence and gotchas

| What | Where | Named | Latest | Action |
|---|---|---|---|---|
| `@modelcontextprotocol/server` (SDK v2) | §16, M4 | 2.3.1 | 2.3.1 | current |
| `@modelcontextprotocol/sdk` (SDK v1) | §12 "SDK v1 can't speak 2026-07-28" | v1 | 1.32.1, whose newest protocol is 2025-11-25 | still true; add "(checked on 1.32.1)" |
| Next.js | §12 `Vary` gotcha "tested on 14.2 and 16.3"; `force-dynamic` on 14.2; recipes for 15 and 16 | 14.2, 16.3 | 16.4.2 | re-test the `Vary` gotcha on 16.4 in a project that runs it; keep 14.2's lines as dated evidence |
| zod-to-openapi with Zod | §12 "v7 (Zod 3) needed `extendZodWithOpenApi`" | v7, Zod 3 | 9.1.0, Zod 4.6.7 | keep as dated evidence (drifts); check whether v9 with Zod 4 still needs the call, and say so either way |

## What the code audit found

**`Accept-Encoding` alone doesn't keep Brotli out.** Node's `fetch` decodes a Brotli body even when the request didn't ask for one: tested on 26.10.0, a server that ignored `Accept-Encoding: gzip, deflate` and sent `content-encoding: br` got its body decoded. A hostile site ignores the header, so the first version of this plan protected nothing. `node:http` and `node:https` decode nothing, and the audit already uses them for one probe (`postNoAccept()`).

**Three request paths do one job:**

| Path | Where | Why it exists |
|---|---|---|
| `get()` over `fetch` | every check | follows redirects one hop at a time, each through `isSafe` and `toBase` |
| `postNoAccept()` over `node:https` | M4's "no Accept" probe | `fetch` always adds an `Accept` header |
| a bare `fetch` in `hostHops` | W2's host redirects | counts hops with `redirect: 'manual'`, which `get()` already supports |

Each sets its own `user-agent` and its own 15-second timeout.

**The Node floor is written in five places** (package.json and four docs), with nothing keeping them in step. The tests already keep `VERSION` and `package.json` in step; the same kind of test fits.

**Releases test on one Node version** while CI tests three: `release.yml` repeats CI's `npm test` instead of running CI.

## Steps

1. **One request function, on `node:http(s)`.** A `request(url, { method, headers, body })` in a new `src/http.mjs` (it does network work, so not `helpers.mjs`) sends the `user-agent`, `accept: */*` unless the caller passes `accept: null`, and `accept-encoding: gzip, deflate`, with one 15-second `AbortSignal` timeout. It decodes gzip and deflate with `zlib`, and refuses any other encoding: no text, and `error: 'refused: <encoding> body'`. It returns `{ status, headers, text }` with `headers` as a `Headers` object, so every check that calls `r.headers.get()` is unchanged.
   - `get()` keeps its hop loop, `isSafe` and `toBase`, and calls `request()` instead of `fetch`.
   - `postNoAccept()` is deleted. M4 calls `get(path, { method: 'POST', body, headers: { accept: null, 'content-type': 'application/json' } })`.
   - `hostHops` calls `get(url, { redirect: 'manual' })` and reads `location` from its headers.
   - `fetch` no longer appears in `src/`. *Harm prevented:* a hostile site reaching a decoder bug on whatever Node the user runs. Not a runtime version check: that would need updating after every Node release.
   - **Tests** (`test/http.test.mjs`, against a local `node:http` server): a Brotli body is refused with its status kept; gzip and deflate decode; `accept: null` sends no `Accept`; the timeout ends a stalled response.
   - AGENTS.md's layout lists `src/http.mjs`.
2. **Runtime floor: Node 26.** The project runs on Node 26 only (the user's decision, 2026-10-21): 26 becomes LTS on 2026-10-28 and is supported to 2029-04-30. `engines` to `>=26`; README, STANDARD.md, AGENTS.md and the `src/audit.mjs` header say "Node 26 or later, with current security releases". `engines` only warns, so the CLI exits with a clear message on an older major (a major check, which a security release never changes). A test, beside the `VERSION` one, checks that each doc's "Node N or later" matches `engines`.
3. **CI and release.** CI runs on 26. `ci.yml` also runs `on: workflow_call`, and `release.yml` runs it as a first job (`uses: ./.github/workflows/ci.yml`) and publishes only after it passes, dropping its own `npm test`. `npm@12` in the publish step; the example workflow on 26.
4. **Dependabot.** `.github/dependabot.yml` with the `github-actions` ecosystem, weekly. It's the one place versions can drift unseen, and the release job holds `id-token: write`.
5. **Spec and library notes.** N6's source to the 2026-07-28 spec; "(checked on 1.32.1)" on the SDK v1 gotcha. The Next.js 16.4 and zod-to-openapi v9 checks need a project that runs them: ask animalhouse's and drifts' agents, and change the gotchas only with what they find.
6. **CHANGELOG** (2.0.0): Node 26 or later; the audit's requests go through `node:http(s)` and refuse Brotli and unknown encodings; releases run CI first.
7. `npm test` on Node 26.12.1, then run the CLI on animalhouse.ai, inbed.ai, drifts.bot, achurch.ai, geeksinthewoods.com and sat-chit-ananda.com and read the output. Scores should match the last run.

**Done when** `fetch` doesn't appear in `src/`, no file names Node 20 as supported, a release can't publish without CI passing, and Dependabot is configured.
