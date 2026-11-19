# Plan: what Ora's scans of our sites found

Written 2026-11-19, from Ora's scores for 17 of our sites, read through its keyless API (`GET https://ora.ai/api/score/{domain}`, and `POST /api/scan` for the 13 it hadn't scanned). Ora scoring version 3, revision 17, 138 checks per site.

**Status (2026-11-19):** steps 0 to 11 are done, in 2.7.0 (committed, not yet released). Revised the same day after an audit of the code (below). Step 9 went to A5, not D13: A5 is the API reference and already scored, so D13 stays a review item. Step 0's skills index lives in the API fixture, since S1 asks every skill to link the API or MCP reference. Real-site runs matched Ora's findings, with one deliberate difference: A1 counts an inline error schema as typed (drifts), where Ora wants a named one. Ships as 2.7.0: new warnings, no new failures.

## The sites

| Site | Ora | Site | Ora |
|---|---|---|---|
| animalhouse.ai | 77 B | inbed.ai | 57 C |
| achurch.ai | 76 B | distill.family | 51 C |
| magnifica.family | 68 C | de-amplify.com | 49 C |
| drifts.bot | 63 C | sat-chit-ananda.com | 41 D |
| botsmatter.live | 63 C | wwjd.family | 38 D |
| ollamaherd.com | 63 C | geeksinthewoods.com | 35 D |
| sitesinthewoods.com | 62 C | alaskabutter.com | 33 D |
| obviouslynot.ai | 62 C | belto.music | 31 D |
| botbook.space | 60 C | | |

The list is the org's repo homepages plus the sites STANDARD.md names. Add any site it misses before step 12.

## The problem

Ora found gaps of three kinds. Some are things STANDARD.md already asks for that the scorecard never checks, so a site passes while missing them. Some are practices most of our sites miss that have a stated reason and a primary source. The rest are Ora's own choices, several of which the standard deliberately rejects.

## How this plan is built

- **A scanner's opinion is not evidence.** Ora's tiers and point weights decide nothing here. An item comes in only with a reason the standard accepts (agents rely on it, it keeps declarations true, or it's baseline hygiene) and a primary source in §16.
- **Describe the item first.** A new check needs its STANDARD.md text and checklist row before the code (CONTRIBUTING.md, step 1).
- **Extend what exists.** Each step names the check and the data it builds on. A new pure function goes in `src/helpers.mjs` with a test.
- **Greenfield: no gating.** No flags, carve-outs or compatibility shims. Every step here is a warning, so one minor release, and the changelog says scores can drop.
- **One way to do each thing.** Where a step needs logic that already exists inside one check, step 0 moves it to `src/helpers.mjs` first and the old copy is deleted, not kept beside it. No second parser, probe or fixture path.
- **Test-first.** Each check gets a fixture page or response and an assertion that fails before the change.

## What the code audit found

An audit of the code each step touches, on 2026-11-19, against v2.6.1:

- **The page parsers are local to the W checks.** `attrs`, `tags`, `meta` and `jsonLd` are closures inside the sampled-pages block of `audit()` (`src/audit.mjs`, around line 656), so nothing before that block can use them. D9 reads `<link rel="ard">` with its own regex for that reason. Steps 5 and 9 need them on the homepage.
- **The OpenAPI document is parsed three times.** `json(openapi)` runs for `apiPresence()`, again in A1 and again in A6. A1's `deref` and its list of operations live inside A1, so A6 builds its own list. Step 7 needs both.
- **W3 already requests a missing page.** Its first probe is `/no-such-page-${rand}`, requested one at a time inside W3. Step 6 needs the same path with `Accept: text/markdown`.
- **S1 parses frontmatter inline** (`fm` and `field()` inside its `mapLimit`). Step 1 also needs the body after the frontmatter.
- **llmsLinks() keeps its link pattern private.** Step 3 needs to count the markdown links it already matches.
- **No test reaches the API checks or S1.** The fixture serves no API and no skills index, so A1 to A7, S1 and S2 skip or warn untested in `test/audit.test.mjs`, and A1's logic has no unit tests. Steps 1, 4, 7 and 9 have no test path today.
- **There's no API catalog example in the repo.** A3 describes the content type but shows no linkset, so the shape our sites share came from one project's code, not from here.
- **The D8 recipe exists** (`docs/recipes.md`, "Markdown for agents without a CDN plan"). Steps 2 and 6 extend it rather than add a recipe.

## What Ora found, and where it goes

| Finding (our sites affected) | Where it goes |
|---|---|
| Skill descriptions that don't say when to use the skill (botbook, drifts, inbed, magnifica) | Step 1, S1 warning |
| No `.md` URL for the homepage (12 of 17) | Step 2, D8 warning |
| llms.txt with bare URLs and no markdown links (animalhouse, distill, ollamaherd) | Step 3, D4 warning |
| API catalog with no `item` link (7 sites, all built from our recipe) | Step 4, A3 warning and the recipe |
| Weak or missing `sameAs`; the company's name read as the product's (inbed searched as "Geeks in the Woods, LLC") | Step 5, W4 warning and guidance |
| HTML 404 for an agent asking for markdown (14 of 17) | Step 6, D8 warning |
| No error schema on 4xx responses in OpenAPI (animalhouse, drifts, inbed) | Step 7, A1 warning |
| MCP Registry entry not tied to the site's domain (achurch, animalhouse, sitesinthewoods) | Step 8, M3 guidance |
| API docs that the homepage doesn't link (belto, sat-chit-ananda, sitesinthewoods) | Step 9, a scored check once its item is decided |
| Brand not in the top 10 for its own name (8 of 17) | Step 10, T6 review |
| WebMCP, OAuth metadata and an MCP server scored as required, and more | Step 11, "What scanners check" and "Considered and left out" |

## Order

0. Groundwork: shared parsers, one OpenAPI parse, one missing-page probe, and a fixture that reaches the API and skills checks.
1. S1: a skill's description says when to use it.
2. D8: the `.md` URL.
3. D4: llms.txt uses markdown links.
4. A3: the API catalog links to the API.
5. W4: the product's own identity.
6. D8: markdown 404s.
7. A1: typed errors in OpenAPI.
8. M3: publish under your own domain.
9. A link from the homepage to the API docs.
10. T6: search for your brand.
11. Ora in "What scanners check".
12. Release 2.7.0.

Step 0 comes first: it changes no result, and steps 1 to 9 build on it. Steps 1 to 4 implement text the standard already has, so they need only code, tests and a changelog line. Steps 5 to 9 need STANDARD.md text first. Steps 10 and 11 are docs only. After step 0, steps 1 to 9 touch different checks and can go in any order.

## 0. Groundwork

Each part is a refactor with no change to any result, so `npm test` and a real-site run before and after must match line for line. Each lands as its own commit.

- **Page parsers in helpers.** Move `attrs`, `tags`, `meta` and `jsonLd` from the W block to `src/helpers.mjs`, with tests, and delete the closures. `jsonLd()` also returns the parsed nodes it walks (`{ ld, types, nodes }`), which step 5 reads. D9 finds `<link rel="ard">` with `tags()` instead of its own regex.
- **One OpenAPI parse.** Parse `openapi` once, before `apiPresence()`. Move A1's `deref` and its operation list to helpers (`openapiDeref(spec)` and `openapiOps(spec)`), with tests; A1 and A6 both use them, and A6's own list is deleted. This also gives A1's logic its first unit tests.
- **One missing-page probe.** Move `/no-such-page-${rand}` into the up-front `mapLimit` with `wkMiss` and `apiMiss`, as `pageMiss`. W3 reads it instead of requesting it in its loop; its template probes stay where they are.
- **Skill files parsed by one helper.** `skillFile(text)` returns `{ name, description, body }`; S1 uses it and its inline `fm` and `field()` go.
- **llms.txt's link pattern exported.** `MARKDOWN_LINK` in helpers, used by `llmsLinks()` and by step 3.
- **A fixture that reaches the API and skills checks.**
  - `startFixture({ api: true })` adds `/openapi.json` (two operations, one needing a key), a JSON `/api` index, a JSON 401 that teaches, a JSON catch-all, `/.well-known/api-catalog`, auth.md, `/docs/api.md`, and a skills index with two SKILL.md files. It follows the `allow`, `delay` and `malformed` options already there. The default stays without an API, so the no-API path keeps its coverage.
  - The skills live in the API fixture, not the default: S1 asks every skill to link the API or MCP reference, so a skill on a site with neither warns by design.
  - A new end-to-end test runs with `api: true` and asserts A1 to A7, S1, S2 and D5.

## 1. S1: a skill's description says when to use it

- **Why:** STANDARD.md §7 already says the `description` says when to use the skill. An agent choosing among installed skills reads only the descriptions, so a description that names what the skill does but not when to reach for it gets passed over. The scorecard checks only that a description exists and fits in 1,024 characters.
- **What:** in the sampled SKILL.md files, warn when the description has no when-clause ("Use when", "when the user", "when you", "for when") and the body has no "When to use" heading. Report the skills by label, as the other S1 problems are.
- **Reuses:** S1's sampled `files` and `skillFile()` (step 0). The matcher is a pure helper, `saysWhenToUse({ description, body })`.
- **Tests:** helper cases (both forms pass; "Manage your pet" fails); one of the API fixture's two skills (step 0) lacks a when-clause, and the S1 assertion names it.
- **Source:** the Agent Skills spec's `description` field. Re-read it and cite it with the date.

## 2. D8: the `.md` URL

- **Why:** D8 says "`Accept: text/markdown` and a `.md` URL both return the page as markdown", and the scorecard tests only `Accept`. Agents that pick a URL themselves can't send `Accept`. The llms.txt proposal names `index.md` for URLs with no file name, so `/index.md` is the homepage's `.md` URL.
- **What:** when the homepage answers `Accept: text/markdown` with markdown, also request `/index.md`, and the `.md` twin of the page D8 already compares. Warn when either answers HTML or 404. Accept `text/markdown` or `text/plain` with a markdown body, the same as D4.
- **Reuses:** D8's `copy` loop (it already finds a page llms.txt links that serves markdown); `get()`. One pure helper, `markdownUrl(url)`, maps a page to its `.md` URL by the llms.txt proposal's rule (`/` to `/index.md`, `/about/` to `/about/index.md`, `/about` to `/about.md`), so the homepage and the compared page use one rule. `/index.md` joins the up-front `mapLimit` as `homeMdUrl`.
- **Tests:** helper cases for `markdownUrl()`; the fixture already serves markdown for `/` and `/docs/guide` by `Accept`, so it serves `/index.md` and leaves out `/docs/guide.md`, and the D8 assertion names `/docs/guide.md`.
- **Docs:** the D8 recipe in `docs/recipes.md` shows the `.md` route next to the `Accept` middleware.

## 3. D4: llms.txt uses markdown links

- **Why:** the llms.txt proposal's file lists are markdown links (`[name](url): notes`). Agents and llms.txt tools that parse the format find nothing in a file of bare URLs. `llmsLinks()` accepts bare URLs, so D4 passes them today.
- **What:** warn when llms.txt has no `[text](url)` link. Keep sampling bare URLs for the broken-link check.
- **Reuses:** `MARKDOWN_LINK` (step 0), counted on the llms.txt D4 already has.
- **Tests:** helper cases for each form; the fixture's llms.txt keeps its markdown links and passes; a unit test covers a bare-URL file.

## 4. A3: the API catalog links to the API

- **Why:** RFC 9727 §4.1 says the catalog "MUST include hyperlinks to API endpoints". Our recipe's shape (the API as the linkset anchor, with `service-desc` and `service-doc`) matches the RFC's Appendix A.1, but an anchor is context, not a hyperlink. A catalog whose context is the catalog itself and which lists each API with `item` (Appendix A.2) settles it, and that's what scanners read.
- **What:** the recipe adds a linkset context anchored at the catalog URI, with an `item` link to each API, and keeps the per-API `service-desc` and `service-doc` entries. A3 warns when no context has an `item` link.
- **Where the shape lives:** nowhere in this repo yet (code audit), so A3 gets its first example, generic per AGENTS.md (`https://example.com/api`), and it becomes the one shape adopters copy.
- **Reuses:** A3's parsed `doc`.
- **Tests:** the `api: true` fixture (step 0) serves a catalog without `item` first, so the A3 assertion fails; then with it.
- **Source:** RFC 9727 §4.1 and Appendix A, already in §16.

## 5. W4: the product's own identity

- **Why:** an agent or a search engine telling one product from another with a similar name uses the site's structured data. 16 of our 17 sites have no `sameAs`, or only one link to GitHub. inbed's only Organization is the company, so Ora searched for "Geeks in the Woods, LLC" and found nothing about inbed.
- **What, in STANDARD.md (W4):** `WebSite.name` is the product's name; the publisher `Organization` can be the company. Give `sameAs` links to the product's own profiles: its repository, its npm or PyPI package, its MCP Registry entry, its social accounts. Leave out Ora's postal `address`: for a small company it publishes someone's home address, and no agent needs it.
- **What, in the scorecard:** W4 warns when the homepage's JSON-LD has no `sameAs` on its `WebSite` or `Organization`.
- **Reuses:** `jsonLd()`'s nodes (step 0) on the homepage W4 already reads (`homeTypes`).
- **Tests:** helper cases on `@graph` and plain nodes; the fixture's `page()` gives the homepage a `sameAs`, and a unit test covers its absence.
- **Source:** Google's Organization structured data docs (`sameAs`, `logo`). Read them before writing, and cite with the date.

## 6. D8: markdown 404s

- **Why:** an agent that asked for markdown and got a 404 page in HTML reads noise, and its next step is a guess. A short markdown body naming llms.txt sends it somewhere useful. 14 of our 17 sites send HTML.
- **What:** for a page path that doesn't exist, `Accept: text/markdown` gets a 404 (still a 404) with a markdown body that links to llms.txt or the sitemap. D8 warns when the 404 is HTML. A site that serves no markdown already warns in D8, so this applies only to sites that do.
- **Reuses:** `pageMiss`'s path (step 0), requested a second time in the same up-front `mapLimit` with `Accept: text/markdown`, as `pageMissMd`.
- **Tests:** the fixture answers that request with markdown; then without it, and D8 warns.
- **Docs:** the D8 recipe gains the 404 branch.
- **Harm prevented, in the text:** the agent leaves the site for a search instead of reading what it needs from llms.txt.

## 7. A1: typed errors in OpenAPI

- **Why:** an agent writing a call from the OpenAPI document handles the failures it can see. With no schema on 4xx responses, it can't tell a validation error from a missing key without trying. A6 checks that errors teach at runtime, but nothing checks the document.
- **What, in STANDARD.md (A1):** every 4xx and 5xx response in the document has a content schema, one shared error object or RFC 9457 `application/problem+json`. A1 warns with the share of operations whose error responses have none.
- **Reuses:** `openapiOps()` and `openapiDeref()` (step 0), and A1's loop over `o.responses`, which already finds undescribed response fields. A pure helper, `untypedErrors(ops, deref)`, lists the operations whose 4xx, 5xx or `default` responses have no content schema.
- **Tests:** helper cases; the `api: true` fixture's document has one untyped 404, and the A1 assertion names it.
- **Source:** RFC 9457. Add it to §16.

## 8. M3: publish under your own domain

- **Why:** M3 says to publish to the MCP Registry from a GitHub Actions OIDC workflow, which grants only `io.github.<owner>/*` names. Those names prove who owns the repository, not that the server belongs to the site, and Ora fails achurch, animalhouse and sitesinthewoods for it. The registry also accepts reverse-DNS names (`ai.animalhouse/...`), proven by a DNS TXT record or by `/.well-known/mcp-registry-auth`, and DNS login runs in Actions with the key in a secret.
- **What:** STANDARD.md §6 and M3 recommend the domain namespace for a project with its own domain; the recipe shows the DNS login step. `io.github` stays correct for a project without a domain.
- **Before writing:** find out from the registry docs what happens to the existing `io.github` entry (whether it can be marked deprecated and point to the new name), and say so in the migration step. Name the harm the change prevents: a listing that a lookalike could also publish under its own GitHub name.
- **Not scored:** M3 is checked in tests and review.
- **Source:** the registry's authentication docs and its GitHub Actions doc, read 2026-11-19.

## 9. A link from the homepage to the API docs

- **Why:** the standard's rule for skills and READMEs is that an agent reads what it's pointed at. The homepage is where most agents start, and three of our sites with API docs don't link them from it.
- **Decide first:** which item this belongs to. D13 (a page for agents' builders) is review-only today; A5 (API reference as markdown) is about format. The likely answer is a scored part of D13 at the recommended level, which needs D13's level and text settled first.
- **What:** when the site has an API, warn when the homepage HTML links none of its docs (`/docs`, the API reference, `/openapi.json`, llms.txt's API link).
- **Reuses:** `apiPresence()`, `tags(home.text, 'a')` (step 0) and `API_LINK`, the pattern S1 already uses for skills, so "a link to the API" means one thing everywhere.
- **Tests:** the `api: true` fixture's homepage links `/docs/api`; a unit case covers a homepage without it.

## 10. T6: search for your brand

- **Why:** an agent that searches for a product and finds a lookalike first may never reach it. 8 of our 17 sites aren't in Ora's top 10 for their own name. The scorecard can't measure ranking, but the monthly review can.
- **What:** T6's monthly review adds a search for the product's name and its main use ("[product] [what it does]"), recorded with the date.

## 11. Ora in "What scanners check"

- **What:** a dated paragraph beside isitagentready's: what Ora scores, and where it disagrees with the standard.
  - Its required tier includes WebMCP, OAuth Protected Resource metadata, OAuth support and an MCP server, even for content sites. The standard says to build each one only if it's true ("Only if true"). WebMCP alone was the largest deduction on 16 of our 17 sites.
  - It grades auth.md against the WorkOS walkthrough, so a site that uses API keys loses points for not describing an OAuth flow it doesn't run.
  - It wants a `/v1` prefix; A12 says none is needed before the first breaking change.
  - It treats a developer portal, a sandbox, a CLI and an SDK as gaps for every site.
  - Its llms.txt limit of 30,000 characters has no stated source.
  - Its "agent feedback" on each page is its own scanner's summary, not an agent's.
- **Considered and left out**, each with its reason: Organization `address` and `contactPoint` (step 5), markdown frontmatter (no evidence a consumer reads it), a Contact page (no evidence an agent checks it; a site may still want one), and Ora's 30,000-character llms.txt limit.
- **§16:** Ora's methodology page and check catalog (`/api/checks`), with the date.

## 12. Release 2.7.0

1. `npm test`.
2. Run the CLI against our sites and compare with Ora's findings. Each new warning should appear where Ora found the gap: S1 on botbook, drifts, inbed and magnifica; D4 on animalhouse, distill and ollamaherd; A3 on the 7 catalogs from our recipe; D8's `.md` warning on the sites that serve markdown by `Accept` but not `/index.md`. A warning that doesn't match is a false result to fix before release.
3. CHANGELOG: one line per warning, and that each can lower a score without changing the exit code.
4. Version, README sample, commit, and the release, as AGENTS.md describes.

## Work on the sites, not in this repo

Each site's own agent does these after 2.7.0, from its scorecard:

- alaskabutter.com: no sitemap, llms.txt or JSON-LD.
- Markdown on the homepage (D8): sat-chit-ananda, sitesinthewoods, wwjd, distill, botbook, de-amplify, alaskabutter.
- An ARD catalog (D9): 11 sites.
- llms.txt over 30 KB: drifts (31 KB) and obviouslynot (51 KB). Move detail to each page's markdown copy (D8); llms.txt stays the map (D4).
- The fixes the new warnings name.
