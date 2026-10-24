# Changelog

## 2.2.0 (2026-10-24)

From a review of the sister project, [agent-security-pranks](https://github.com/geeks-accelerator/agent-security-pranks), and its research. Two new warnings (D7's `Allow`, and D8 at the recommended level), no new failures. A warning lowers the recommended score until fixed, but doesn't change the exit code.

- **D7 warns about a 405 with no `Allow` header.** RFC 9110 requires it on every 405, and it tells a client what does work. All six sites the standard came from already send it.
- **Response bodies are capped at 16 MB,** before and after decoding, so a site that answers with a gzip bomb or an endless stream can't exhaust the memory of the machine running the audit. Over the cap, the check sees the status and no body, as with a refused encoding, and D4 reports an oversized llms-full.txt by its size.
- **`--logs` counts requests under crawler names that asked for secret files** (`.env`, `.git`, keys, dumps), per family, and says the families are the names clients send, not verified. The JSON report has `crawler_names_on_secret_probes`.
- **D8 (markdown for agents) is recommended,** up from next level, so a site without it now warns at the recommended level and its recommended score can drop. The evidence: in a week across 56 domains, Cloudflare-verified bots asked for markdown 12,601 times on the sites that serve it, 92% of them Exa's search crawler.
- **`--logs` names other audit tools** (Semrush, Ahrefs, agentprobe, agent-tools.cloud, Lumar, SEOJuice and the sister project's audit) as their own family.
- **New research: [Who reads the discovery files](docs/research/who-reads-discovery-files.md),** a week across 56 domains on Cloudflare: who requested each discovery file, verified or not, which files sites are asked for without serving them, and how many readers went on to call the API. STANDARD.md §2 cites it; D4's reason now names who reads llms.txt; D7 and D11 cover the pre-1.0 path `/.well-known/agent.json`; T3 counts audits apart from agents.
- **STANDARD.md:** §2 adds that a crawler's name is a claim: in a week across one owner's 56 domains, none of about 448k vulnerability probes came from a verified bot, and one scanner used about 20 AI-crawler names. T3 counts a crawler by its verified status. D7 asks for `Allow`. §16 cites the research and RFC 9110 §15.5.6. docs/recipes.md shows `Allow` on the 405.
- **README:** a row for the sister project in "How it fits with other tools".
- **README:** opens with what the audit checks, in the words people search for, a real run's output, "Why this one", and how it fits with other tools. Badges for the npm version and license.
- **package.json:** the description leads with what the audit scores; keywords add aeo, ai-seo, ai-visibility, generative-engine-optimization, robots-txt, ai-crawlers, seo-audit, website-audit, agent-ready, llms-txt-validator and cli. Both reach npm with the next release.

## 2.1.0 (2026-10-23)

From a project's agent that checked pages in Google's Rich Results Test by hand. The standard asked for it ("accepts a sample") without saying which pages, and the scorecard never mentioned it. No scoring changes.

- **The scorecard lists the pages to run through Google's Rich Results Test,** each with a link that opens it in the test: the homepage, one page of each template with rich-result markup, and any other page that adds a rich-result feature. Pages from one template share their markup, so one tests them all. The CLI prints them under W4 in "check these yourself", the JSON report has `rich_results_test`, and the status page has a section for them. The rich-result types are those in Google's search gallery (updated 2026-10-16).
- **STANDARD.md:** W4 says which pages to test and when (after a change to a template's markup), when to use the Schema Markup Validator instead, and that valid means eligible, not shown. Its done-when is no errors on the listed pages. T6's monthly review checks Search Console's rich result reports, which cover every indexed page. §16 cites the search gallery, both testing tools, the reports and the URL Inspection API.

## 2.0.0 (2026-10-21)

From an adopting agent's review: a full score showed a site was set up correctly, not that agents did better on it, and the default run graded content sites on an API they don't have. This release makes the score fit the site, checks more of what agents and link previews actually read, and gives T5 and the traffic numbers a recorded form. Pin `readiness-audit@2`.

**Checks that can newly fail** (why this is a major version):
- **W1 to W6 sample by page type.** URLs are grouped by template (the first path segment plus the depth): every static page is read (groups of 20 or fewer), and three pages of each generated template, up to 40 pages. Each W line says what it read, and when the cap left static pages out. A sample spread evenly through the sitemap had read under one static page on sites that are mostly generated pages, and the static pages are where layouts leak metadata. Any existing W rule can now fail on them. At animalhouse this found 11 descriptions over 160 characters and 11 pages showing the homepage's X card that 1.2.1 had passed. W3's missing-item probe goes under each template, and W4's breadcrumbs are judged on template pages.
- **D2 reads the pages' dates on a sitemap index.** It counted the sub-sitemaps' own `lastmod` dates. The sitemap is now read once, every sub-sitemap up to ten (the W checks read three), and D2 and the W checks share it.
- **W5 fails when a page's share card shows another page's text.** It reads what each platform shows: on X, `twitter:title` and `twitter:description`, falling back to `og:`; on Facebook and LinkedIn, `og:`. Shared text counts against a page when it isn't the page's own (its `<title>` or meta description), and belongs to the homepage when it matches no page. Next.js merges metadata shallowly, so a page that sets `openGraph` but not `twitter` keeps the root layout's Twitter title and description. animalhouse found this by sharing links, after W5 had passed; inbed.ai has it too.
- **The API checks run whenever a site has or declares an API,** and `--no-api` is gone. They run when `/openapi.json` or `/api` answers, or a `service-desc` link, an API catalog or llms.txt names an API; a declared API that doesn't answer fails A1. A site with neither skips them, as a site with no hosted MCP endpoint skips the MCP checks. Drop `--no-api` from your commands; an unknown flag is ignored.
- **Node 26 or later.** Node 20 reached end of life on 2026-04-30, and Node's 2026-10-21 security release fixed a Brotli decoder bug that could run code (CVE-2026-111497) and two TLS hostname bypasses. Use 26.12.1 or later. The CLI exits with a message on an older major, since `engines` only warns.

**New warnings:**
- **W6** warns when heading levels skip going down (an `h1` followed by an `h3`).
- **D4** reports llms.txt links that redirect: link the destination.
- **D5 asks for `service-desc` and `api-catalog` only on a site with an API.** A site with none needs only `describedby`, since a `service-desc` naming an OpenAPI document would declare one.
- **D8** compares the first page llms.txt links that serves markdown with its markdown copy, and warns about sections the copy lacks; the pass line says when no linked page serves markdown. The homepage's markdown may be llms.txt, so it isn't compared.

**New:**
- **`--logs <file>`** counts requests for the discovery files in an exported access log (combined log format, or JSON lines from Cloudflare Logpush, Vercel or Railway), by client family, and how many readers of each file also called the API. It prints counts, never addresses, and names the audit's own requests as their own family. Its paths are the audit's own list, so the two can't drift.
- **The report and status page** say whether a site has a public API (`has_api`, a "Public API" row), and the report gives the sampled pages' median HTML size (`html_kb_median`, also in W6's line). Size isn't scored.
- **T5 is recorded as fields:** `attempts`, `first_try`, `model`, `max_turns`, `median_calls`, `stops`, `cost_usd`, `date`. Convert a free-text T5 `result`.
- **The T5 runner** ends with each attempt's `RESULT`, turns and cost, and a T5 entry to finish by hand. It also no longer exits silently before the first attempt: under `pipefail`, the random test name's `tr` ended on SIGPIPE, which stopped the script.
- **Every request goes through `node:http(s)`, not `fetch`.** `fetch` decodes a Brotli body even when the request didn't ask for one, so an audited site could hand any body to the decoder. The audit asks for gzip or deflate, decodes those itself, and refuses any other encoding. W3 fails a sampled page whose body it refused, once, rather than every W check reporting its tags missing. One function now sends every request, with one user agent and one 15-second timeout.
- **Releases run CI first,** on Node 26, and npm is pinned to major 12 in the publish step. Dependabot watches the GitHub Actions weekly.

**STANDARD.md:**
- W3: retiring a page (a permanent redirect to what replaced it, out of every discovery file in the same change, a test that it keeps redirecting).
- W4: a visible date matches the structured one (Google's publication-dates guidance).
- W5: every page's card shows its own title and description; the homepage's copy belongs on the homepage, not the root layout. §12's `twitter:title` gotcha names the Next.js cause.
- W6: heading levels don't skip (W3C's headings tutorial); the median HTML size, reported and not scored.
- D8: a page's markdown copy has the page's sections.
- §11: guard tests for the sitemap against the routes ([recipe](docs/recipes.md#the-sitemap-equals-the-routes-t4-w3)), markdown copies against their pages, retired URLs, and every page's own metadata; "No stale claims" covers page copy and skill files, and S1 points to it.
- T6: record the top queries with their landing pages (`queries` in `recorded.json`), reviewed by hand, not scored.
- §12: inline elements with no space between them fuse into one word.
- T3: classify traffic before counting it; a browser, headless or unidentified client counts as an agent only when something backs it up, such as calling the API.
- W7: anchors say what the target is in searched-for words, not the brand name alone, with the brand in plain text beside them, and are true of the page they open. From animalhouse, where an agent linked sibling sites by brand name.
- E6: link siblings in context with W7's anchors; never sitewide or on a partner page, which Google's spam policies call link schemes.
- Considered and left out: in-page anchors, favicon versioning, prerendering and view transitions.
- §12: the SDK v1 gotcha was re-checked on 1.32.1. §16: N6 cites the 2026-07-28 spec.
- §16: Next.js metadata merging, Google on redirects and on publication dates.

## 1.2.1 (2026-10-06)

Principle 7 told skills to have the agent confirm with its person before registering, publishing or rotating a key, and S1 required it of every skill that publishes. That gates the core loop: an agent following it can't finish on its own, and a skill limited to explicit requests isn't used when it would help. No scoring changes.

- **Principle 7 is now "Tell agents the consequences, then let them act."** Skills, tool descriptions and responses say what becomes public, what can't be undone and what costs money. MCP annotations carry the same facts, and approval policy belongs to the client and whoever runs the agent.
- **New principle 10, "Caution has a cost, so count it."** Confirmation steps, ask-first lines, narrow triggers and disclaimers cost installs, engagement and organic discovery. Name the harm before adding a restriction, keep "only when asked" for destructive actions, and undo a change that lowers T5 or the come-back measure. Principles 8 and 9 keep their numbers.
- **S1:** trigger on the job, specifically enough not to fire on unrelated requests, and say what lasting actions do, with no ask-first gates on the core loop. ClawHub's scan flagged drifts' first plugin for broad triggers ("explore, travel"); animalhouse's plugin, with job-specific triggers and no gates on the core loop, scanned clean. The scorecard's S1 review line says the same. botsmatter had already declined the old rule. If your skills have ask-first lines or explicit-only triggers from the old wording, take them out of the core loop; republishing is the owner's call.
- **T5:** record every point where the agent couldn't go on by itself (`STOPS` in the runner's report). The runner's prompt no longer tells the agent to read the docs and the API, since finding them is part of what T5 measures, so earlier results aren't directly comparable. Record the full model ID: an alias like `sonnet` moves to each new release.
- **Fewer examples to copy.** Agents adopting the standard turn its examples into their own skills and copy, so rules teach with a generic example, a `[placeholder]` template or a check question, and name a project only as evidence: W1's title pattern, T2's come-back measure, the T5 goal, A8's placeholders (taken from your own docs, not a fixed list), A11, E2's mechanics (now attributed), E6 (applies when you run related sites), S3 (no skill counts; ClawHub flags near-identical skills as template spam) and §12's timestamp gotcha. S1 gains two check questions. README and §13 no longer list skills that act without asking as a gap. ClawHub observations get a dated row in §16.
- **docs/recipes.md:** route handlers take `params` as a promise (Next.js 15 and later), and Next.js 16 calls middleware `proxy.ts`.
- **AGENTS.md:** examples get copied; every restriction names the harm it prevents; the standard describes the current rule, and history goes here and in commits.
- **Examples that fit any project:** the T5 goal, A7, A8's aliases, N2 and W3 no longer use one project's terms. The principles list now says the first six (not seven) came from all six projects.
- **docs/adopting.md:** a third switch-over rule, that every restriction names the harm it prevents; step 5 says why it asks first; the intro no longer leads with a score.

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
