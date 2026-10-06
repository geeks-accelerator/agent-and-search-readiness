# Changelog

## 1.2.1 (2026-10-06)

Principle 7 told skills to have the agent confirm with its person before registering, publishing or rotating a key, and S1 required it of every skill that publishes. That gates the core loop: an agent following it can't finish on its own, and a skill limited to explicit requests isn't used when it would help. No scoring changes.

- **Principle 7 is now "Tell agents the consequences, then let them act."** Skills, tool descriptions and responses say what becomes public, what can't be undone and what costs money. MCP annotations carry the same facts, and approval policy belongs to the client and whoever runs the agent.
- **New principle 10, "Caution has a cost, so count it."** Confirmation steps, ask-first lines, narrow triggers and disclaimers cost installs, engagement and organic discovery. Name the harm before adding a restriction, keep "only when asked" for destructive actions, and undo a change that lowers T5 or the come-back measure. Principles 8 and 9 keep their numbers.
- **S1:** trigger on the job, specifically enough not to fire on unrelated requests, and say what lasting actions do, with no ask-first gates on the core loop. ClawHub's scan flagged drifts' first plugin for broad triggers ("explore, travel"); animalhouse's plugin, with job-specific triggers and no gates on the core loop, scanned clean. The scorecard's S1 review line says the same. botsmatter had already declined the old rule. If your skills have ask-first lines or explicit-only triggers from the old wording, take them out of the core loop; republishing is the owner's call.
- **T5:** record every place the site told the agent to ask a person first. The runner's report now asks for them (`STOPS`).
- **Examples that fit any project:** the T5 goal, A7, A8's aliases, N2 and W3 no longer use one project's terms. The principles list now says the first six (not seven) came from all six projects.
- **docs/adopting.md:** a third switch-over rule: don't add caution the standard doesn't ask for.

## 1.2.0 (2026-10-06)

From drifts.bot's switch-over, the third project to adopt the standard. One new warning (D4), no new failures. It also ships 1.1.0, which wasn't published to npm.

- **`--base <url>` scores a build before it ships:** a local server or a preview deployment, as the domain. The site's URLs are requested from the base and reported under the domain; a private address is allowed there because you chose it, while everything else the site links to still has to be public. D10 (DNS) and W2's host redirects are skipped.
- **D4 follows llms.txt's links.** It samples up to 10 of the site's own links and warns about missing pages (404 or 410), server errors and no answer. Endpoints that want a key (401, 403) are fine, and templates like `{id}` are skipped. A warning lowers the required score until fixed, but doesn't change the exit code.
- **D10 asks public resolvers first** (1.1.1.1, then 8.8.8.8, then the system's), and its failures say that DNS answers stay cached until their TTL runs out.
- **The status page names the pinned command** (`npx readiness-audit@1 --matrix ...`), as §14 says to run it.
- **T6 takes structured numbers** in `recorded.json` (period; clicks, impressions, CTR, position, indexed, not indexed, crawled but not indexed; for Google and Bing), and the status page shows them. A free-text `result` still works.
- **The T5 runner** takes `--attempts`, `--model`, `--max-turns` and `--pause`, runs each attempt in an empty folder with no user settings or MCP servers (and `--bare` when `ANTHROPIC_API_KEY` is set), gives the agent a random test name, and asks for doc mismatches as well as errors.
- **STANDARD.md:**
  - A9, A10: a limit on key checks answers 429, never 401, and counts only failures; a database error is 503; cache verified keys when the hash is slow; one auth helper for every route.
  - T1, T3: logs outlive a deploy; page through platform logs.
  - T5: keep test accounts off public pages, keep the agent fresh, budget the runs, report doc mismatches.
  - T6: record fields, not prose; it takes a person with console access.
  - §12 gotchas: Next.js drops a `Vary` set in middleware, proxy or `next.config` on App Router pages (tested on 14.2 and 16.3); `robots.ts` can't output `Content-Signal`; Redocly needs `security: []` on public operations; zod-to-openapi v7 with Zod 3 needed `extendZodWithOpenApi`; container logs vanish on deploy.
- **docs/recipes.md:** one auth helper for every route, and test accounts kept off public pages.
- **AGENTS.md:** a new warning is a minor version; a new failure is a major one.

## 1.1.0 (2026-10-06, not published to npm; shipped in 1.2.0)

From inbed.ai's switch-over, the second project to adopt the standard. Nothing gets stricter.

- **D8 (markdown for agents) moves from recommended to next level.** It had no stated reason, our logs can't show `Accept: text/markdown` traffic (Railway's HTTP logs keep the user agent but not `Accept`), and principle 3 says a scanner check alone makes an item recommended at most. It now says why to build it and when (log the `Accept` header to find out), starts with the homepage and docs, and says Cloudflare Pro is optional. The status page gains a "Next level passed" row.
- **`--compare <file>`** lists what changed since a previous run (a status page from `--matrix`, or a saved `--json` report): better, worse, newly checked, no longer checked, and level changes. A score's denominator grows as items start to apply, so totals alone mislead.
- **A1 explains two cases.** A field whose description sits inside `anyOf` or `oneOf` (what Zod emits for `.nullable()` when `.describe()` comes first) is still missing a description, and the reason now says so and how to fix it. Operations whose description only repeats the summary are noted on the result line, without failing it.
- **The Score line carries the date,** so pasted results keep it.
- **STANDARD.md:**
  - D1: CDN features such as Cloudflare's managed robots.txt prepend their own group.
  - W3: in Next.js, a `loading.tsx` above a detail page makes missing pages answer 200.
  - A1: put descriptions on the field itself, and say when to use each operation.
  - A6: point out unreplaced placeholders such as `{{AGENT_ID}}`.
  - S1 and S2: index the skills the site serves, not every listing; an index makes S1 apply.
  - D10: the AID auth values, with an `a=apikey` example.
  - D5: the template gives llms.txt the type sites actually send (`text/plain`).
  - T5: choose a goal the agent can finish alone.
  - §13: keep the status page in the project's private repo when there is one.
- **New docs/recipes.md:** a `/.well-known` catch-all for D7 and D11, `GET /api` that sends browsers to the docs, `did_you_mean` by edit distance against the OpenAPI paths, unreplaced placeholders, and markdown routes without a CDN plan.

## 1.0.1 (2026-10-05)

Fixes from the first full switch-over (animalhouse.ai, 10 to 19 of 19 required).

- **S1 no longer fails skill URLs that don't end in `<name>/SKILL.md`.** It read the folder from the URL's second-to-last segment, so an index pointing at `/skills/<name>` failed every name ("folder is skills"). A name is now checked against its folder only when the URL shows one, and always against its index entry's name.
- **S1 samples only SKILL.md entries.** It read `archive` entries as text and failed their names and descriptions.
- **S1 resolves relative skill URLs against the index**, not the site root (RFC 3986).
- **A CDN-cached copy is named.** When robots.txt, the sitemap, llms.txt or security.txt fails and came from a CDN cache, the reason says how old the copy is, since a recent change may not show yet. Cloudflare caches robots.txt by default.
- **STANDARD.md:** D1 says to purge robots.txt from the CDN after a change. D8 notes that Next.js 14.2 replaces `Vary` on App Router pages, so `Accept` goes on at the edge.

## 1.0.0 (2026-10-05)

First public release.

- **The standard (STANDARD.md):** items in eight groups: discovery (D), web search (W), API (A), MCP (M), skills (S), engagement (E), measurement and tests (T), next level (N). Each has an ID, a level (required, recommended, only if true, next level) and the reason for its level.
- **The scorecard (`readiness-audit`):** 32 checks in one read-only pass: 19 required, 11 recommended and 2 next-level. It samples up to 20 sitemap pages for search and up to 5 skill files, prints `--json`, and builds a status page across several sites with `--matrix`, including recorded T5 and T6 results from `--recorded`.
- **Safe to point at any site:** it follows redirects itself and refuses private, local and non-http addresses at every hop, so a site's sitemap, share images, skills, catalog or DNS record can't send it to `localhost` or a cloud metadata address. It keeps to about six requests at a time.
- **The agent usability test (T5):** a procedure, a runner for Claude Code, and a results format (docs/usability-test.md).
- **Repo:** CI on Node 20, 22 and 24; a release workflow that publishes to npm through trusted publishing; contributing and security guides; issue templates.
