# Plan: sample every kind of page, and check what was missed

Written 2026-10-21, from animalhouse's review of why the scorecard passed W1, W5 and W6 while its static pages had 11 descriptions over 160 characters, 14 pages showing the homepage's X card, and a homepage that jumped from h1 to h3. Revised the same day after an audit of the code. It ships inside 2.0.0.

**Status (2026-10-21):** steps 1 to 5 and step 6's docs and real-site runs are done and committed in 2.0.0. Still open: publishing 2.0.0, and telling each project's agent to move to `@2` with its new failures.

## The problem

The audit samples 20 pages spread evenly through the sitemap. On a site that is mostly generated pages, that sample barely touches the static pages, and the static pages are where layouts leak metadata and copy goes stale. animalhouse's sitemap is about 710 URLs, 98% of them creature, agent and species pages, so 20 evenly spaced picks averaged under one static page.

2.0.0 adds up to six pages one path segment deep. That's a guess at "static page", and it misses static pages two segments deep (`/docs/mcp`, `/agents/[name]`).

## How this plan is built

- **Most sites, not one.** The audit runs on many sites, so each addition has to fit most of them. A check that only works with one project's data, or flags normal pages on ordinary sites, goes to review or to "Considered and left out".
- **Greenfield: no gating.** No flags, carve-outs or second code paths. A replaced function is deleted, not kept beside its successor.
- **One way to do each thing.** Where the audit does the same job twice, this change merges them before adding to them (below).

| Suggestion from the review | Most sites? | Where it goes |
|---|---|---|
| Sample by page type | Yes: most sites are a few static pages plus generated templates | Step 2, scored |
| Skipped heading levels | Yes, and cheap | Step 3, W6 warning |
| Each page's own metadata, tested in code | Yes | Step 4, §11 guard test |
| Facts in copy from one source | Yes | Step 4, widens "No stale claims" |
| Top queries checked against their pages | Only sites that record Search Console data by hand | Step 5, T6 review practice, not scored |
| Score brand-only and fused anchors | No: false positives on ordinary links (`GitHub`) and CamelCase names | Step 5, W7 stays in review; fused anchors become a §12 gotcha |
| Publish 2.0.0 | n/a | Step 6 |

## What the code audit found

**Bugs this change has to fix anyway:**
- **D2 reads the wrong dates on a sitemap index.** It counts `<lastmod>` in `/sitemap.xml` itself, which on an index are the sub-sitemaps' dates, not the pages'. The W block expands the index separately, and only its first three sub-sitemaps.
- **Heading parsing drops `<header>`.** `missingSections()` strips `nav`, `header`, `footer` and `aside` before reading headings. Many pages put their title `h1` inside `<article><header>`, so reusing that stripping for W6 as planned would report "no h1" on correct pages, and D8 already misses those titles. Strip `nav`, `footer` and `aside`, and screen-reader-only headings; keep `header`.

**Duplicates to merge:**

| Job | Where it's done now | One version |
|---|---|---|
| Read a sitemap | `locs()` in the W block; a separate `<lastmod>` regex in D2 | `sitemapEntries(xml)` in `helpers.mjs`: `[{ loc, lastmod }]` |
| Normalize a URL for comparison | `norm()` in the W block; `bare()` in D4 | `norm()` moved to `helpers.mjs` |
| Decode entities and collapse spaces | `decode()` in the W block; `text()` inside `missingSections()` | `decodeText()` in `helpers.mjs` |
| Read headings | an h1 count regex in `parsePage`; a heading regex and stripping in `missingSections()` | `headings(html)` in `helpers.mjs`: `[{ level, text }]`, chrome removed |
| Path depth | three inline `split('/').filter(Boolean).length` (W3's probe, W4's breadcrumbs, `shallowPages()`) | `pathDepth(url)` in `helpers.mjs` |
| "a, b, c, +N more" | `list()` twice (S1, W), and inline in D1, D4 (twice), A1 and D8 | `list(xs)` in `helpers.mjs`, used everywhere |
| Fetch sub-sitemaps | a sequential `for` loop | `mapLimit`, like every other fetch |

## 1. Merge the duplicates

Do this first, with no change in behavior except the two bug fixes, so step 2 builds on one version of each.
- Move each function in the table to `helpers.mjs` with a test, and replace every use. `missingSections()` uses `headings()` and `decodeText()`.
- Read the sitemap once, before D2: expand an index (every sub-sitemap, up to ten, through `mapLimit`), keep the site's own URLs, and hand the same entries to D2 and the W checks. D2 then counts the pages' `lastmod` dates.
- **Done when** `npm test` passes, the six sites in step 6 score as before, except D2 on sites with a sitemap index and D8 where a heading sat in `<header>`, and `grep` finds no second copy of any merged function.

## 2. Sample by page type

- **Group URLs by template:** the first path segment plus the depth. `/creatures/a/b` and `/creatures/c/d` share `/creatures/*/*`, `/agent/x` is `/agent/*`, every one-segment page (`/about`) is `/*`, and `/` is its own group. Grouping by the whole parent path would make each creature's owner its own group and turn hundreds of generated pages into "static" ones.
- **Small groups are static pages: take them all.** A group of 20 or fewer URLs. **Large groups are templates: take three,** with `spread()`. A site with usernames at the root (`/*` in the thousands) gets three of those, like any template.
- **Cap at 40 pages.** Templates get their three first, then static pages, shortest paths first.
- **One sample line.** Build the sample's description once (`40 pages: 25 static, 5 templates; capped, 9 static pages not read`) and use it in every W pass line, where each now writes its own "N sampled pages".
- **Templates feed the checks that want them.** W3's missing-item probe goes under each template (up to three), not under the first page that happens to be two segments deep, which may be a static page. W4's breadcrumb rule applies to template pages.
- **Reuses:** `spread()`, `pathDepth()` and `norm()` from step 1. A pure `samplePages(urls)` in `helpers.mjs` returns `{ pages, templates, skipped }`, named like `sampleSkillEntries()`. It replaces the inline spread and `shallowPages()`, which is deleted with its test. W5's homepage fallback stays, for sitemaps without `/`.
- **Cost:** up to 40 page fetches instead of 26, at the same four at a time.
- **Tests:** a sitemap shaped like animalhouse's (13 static pages, three large templates, one small two-segment group) samples all 13, three per template and the whole small group; usernames at the root sample three; the cap holds and `skipped` counts what it left out.
- **Done when** animalhouse.ai's run samples all its static pages, and W1, W5 and W6 report the problems the review found by hand.

## 3. Skipped heading levels (W6)

- **What:** warn when headings skip a level going down (h1 then h3). Going back up (h3 then h2) is fine.
- **Why a warning:** screen readers and machine parsers read heading levels as structure, and W3C's headings tutorial says to avoid skipping ranks. Google doesn't rank on heading order. W6 already warns, rather than fails, for several h1s, the same kind of issue.
- **Left out:** "long pages with no h2". It needs a threshold for "long" that would be arbitrary.
- **Reuses:** `parsePage` keeps `headings(html)` from step 1. The h1 count and the skip check both read it.
- **STANDARD.md:** W6 gains the rule and its reason; §16 cites the W3C tutorial, read on the day.
- **Done when** a test covers skip, no skip and going back up, and animalhouse.ai's homepage gets the warning.

## 4. Guard tests (§11)

- **Every page's own metadata:** a test in the project that walks every route and checks each one has its own title, description and share card, with descriptions within W1's lengths. It's the only check that sees every page, and it catches layout copy a page inherits before it ships (animalhouse's `metadata.test.ts`). W5's text points to it.
- **Facts from one source:** widen the existing "No stale claims" bullet from discovery files to page copy and skill files. A count or a timing comes from the code or data it describes, or isn't stated. *Harm prevented:* copy that contradicts the product, which agents act on. S1 points to it.
- **Done when** both are in §11, and W5 and S1 point to them.

## 5. Review practices

- **Queries against pages (T6):** record the top queries with their landing pages, and in the monthly review ask whether each page answers its query in its title, h1 and opening text. Evidence: animalhouse's homepage ranked for "tamagotchi ai" without the words on the page. Not scored: the data is entered by hand, and matching query words against a title invites keyword stuffing.
  - **Reuses:** T6's existing fields in `recorded.json` gain `queries: [{ query, page, clicks, impressions }]`; `formatRecorded()` shows the count ("5 top queries recorded"), not the list, so the status page stays one line per site.
- **Fused anchors (§12 gotcha):** inline elements with no space between them merge into one word for crawlers and screen readers ("Drifts Bot" and "Travel" read as "Drifts BotTravel"). Check the rendered text, not the markup.
- **W7 stays in review.** The scorecard can't know which links point to siblings, and outbound links named by brand are often right.

## 6. Release 2.0.0

- Update README's sampling line, STANDARD.md's W section and the 2.0.0 CHANGELOG entry: the sample is by page type, up to 40 pages, and it can fail checks on pages it never reached before. Delete the CHANGELOG's line about six shallow pages rather than describing the change from it.
- `npm test`, then run the CLI on animalhouse.ai, inbed.ai, drifts.bot, achurch.ai, geeksinthewoods.com and sat-chit-ananda.com, and read the output.
- Publish: push, then a GitHub release tagged `v2.0.0`; the Release workflow publishes to npm. Tag `v2.0.0` only: the 1.3.0 commit was never meant to ship on its own.
- Tell each project's agent to move its pin from `readiness-audit@1` to `@2`, and send it its new failures.
