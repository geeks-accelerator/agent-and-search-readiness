# Plan: prove the score means something

Written 2026-10-21, from an adopting agent's review of the standard, and revised the same day after an audit of the code.

**Status (2026-10-21):** steps 0, 2, 3, 5, 6 and 7's code and docs are done and committed in 2.0.0, not yet released. Still open: step 1's paid T5 runs (the runner and the record format are ready), step 4 (needs each project's logs), and telling each project's agent about its new failures.

## The problem

A full score shows a site is set up correctly. It doesn't yet show that agents do better on that site. The standard's testable claims are T5 (a fresh agent finishes a real task) and T6 (search numbers), and neither has a recorded result on the site the reviewer adopted it on. Until one does, a score is a description, not evidence.

The review also found that the default run misleads sites with no public API, and proposed eight additions.

## How this plan is built

- **Greenfield: no gating.** No flags, profiles or carve-outs that keep a change narrow to dodge a version bump. When a change can newly fail a site, take the major version.
- **One release.** Everything that changes scoring ships together as 2.0.0, including the unreleased 1.3.0 work. Adopters move their pin once.
- **Extend what exists.** Each step names the code it builds on. A new function goes in `src/helpers.mjs` with a test only when no existing one fits.

## Order

0. Fold 1.3.0 into the shared sample.
1. Run T5 on animalhouse.ai, and record it as fields.
2. Detect the API the way the audit detects MCP, and drop `--no-api`.
3. Add `--logs` to the CLI.
4. Re-measure discovery traffic with it.
5. Add the four strong candidates, with scorecard checks where the audit already has the data.
6. Settle the smaller candidates.
7. Release 2.0.0.

Step 1 doesn't depend on code and can start now. Steps 0, 2, 3 and 5 touch different parts of `src/audit.mjs` and can go in any order. Step 4 needs step 3.

## 0. Fold 1.3.0 into the shared sample

1.3.0 (committed, not pushed) reads up to six shallow pages for W5's share-text check only, and makes that check a warning. Both were choices to avoid a major version. Undo both:

- **Reuses:** `shallowPages()` and `readPage` already exist. Build `pick` from the spread sample plus the shallow pages, deduped by `norm`, and remove `extra`. W1 to W6 all score the same pages, so the homepage, `/about` and `/privacy` get every page check.
- **Share text fails W5,** like a duplicate title fails W1: the harm is the same (a page shows another page's text).
- **CHANGELOG:** replace the 1.3.0 entry with the 2.0.0 one (step 7). The commit stays; nothing was published.
- **Done when** `npm test` passes and animalhouse.ai fails W5 for share text.

## 1. Run T5 on animalhouse.ai

- **Reuses:** `examples/usability-test.sh` (already isolated, turn-limited and named per attempt), and `recorded.json` with `formatRecorded()`, which already renders T6 as fields.
- **Record T5 as fields,** as 1.2.0 did for T6: `{ attempts, first_try, model, max_turns, median_calls, cost_usd, stops, date }`. Extend `formatRecorded()` and its test; The fields replace free-text `result`; convert any project's existing T5 entry when it moves to 2.0.0.
- **The runner prints a summary** after the last attempt: each attempt's `RESULT` line, turns and cost, read from the JSON `claude -p` already writes, with `node -e` (no dependencies). Scoring success, errors and stops still takes reading the report (docs/usability-test.md, "Score it").
- **Cost:** docs/usability-test.md records one unbounded attempt at drifts costing $6.85 and 132 turns. With a turn limit of about 40 and a mid-size model, budget $10 to $20 for five attempts. Confirm the model and the limit before running, and keep both fixed for later months.
- **Comparison:** run the same goal against a `--base` preview of a commit from before animalhouse's switch-over, with the same model and limit. A conforming site alone shows the task is possible; the pair shows whether conforming made it easier. Do both in the first run, or the first result can't answer the review.
- **Done when** the status page shows T5 for animalhouse.ai with model, turn limit and first-try rate, and the comparison is written up in §10 with its date.

## 2. Detect the API

The audit already detects MCP: `answersMcp()` sets `hosted`, the M checks skip when nothing answers, D12 warns when files imply an endpoint that doesn't answer, and the report carries `hosted_mcp`. The API gets the same treatment, which replaces `--no-api`.

- **Reuses:** the responses the audit already fetches (`openapi`, `apiIndex`, `docsMd`, `llms`, the home `Link` header parsed in D5) and the API-link regex S1 uses on skills (`noApi` in the S1 check). Move that regex to `helpers.mjs` so S1 and the detector share it.
- **The rule:** the A checks run when an API answers (`/openapi.json` is an OpenAPI document, or `/api` answers JSON) or is declared (a `service-desc` link, an API link in llms.txt, an API catalog, a D10 record with `p=openapi`). Claims get checked: a declared API that doesn't answer fails A1. With neither, the A checks skip with "no public API found at /openapi.json or /api, and none declared".
- **Report and status page:** `has_api` next to `hosted_mcp`, and a "Public API" row next to "Hosted MCP endpoint" in `matrix()`.
- **Remove `--no-api`** from the CLI, its help, `audit()`'s options and every doc that shows it. D5 uses `has_api` where it used `hasApi`.
- **Tests:** the detection rule as a pure helper over the fetched responses, with cases for answering, declared only, and neither.
- **Done when** a content site with no API scores without flags, and a site with an OpenAPI link in llms.txt but no API fails A1.

## 3. `--logs`

- **What:** `readiness-audit --logs <file>` reads an exported access log and prints, per discovery path, the requests and the client families that made them. No network and no tokens: the project exports its own log.
- **Reuses:** the CLI's mode pattern (`--matrix`), so no subcommand parser. The paths come from the audit's own fetch list: move it to a shared `DISCOVERY_PATHS` constant that both use, so they can't drift. The named-crawler list is `AI_BOTS`, moved to `helpers.mjs`; the client families are §2's table.
- **Formats:** combined log format and JSON lines, detected per line. JSON lines covers Cloudflare Logpush and Railway's export; the field names to read (`ClientRequestPath`, `ClientRequestUserAgent`, and their equivalents) go in a small map with a test per host.
- **Classification** is step 5's traffic rule, written once in `helpers.mjs` and used here.
- **Privacy:** it prints counts and client families, never addresses. Same-address matching (did a reader of llms.txt also call the API) is counted inside the run and reported as a number.
- **Done when** tests cover both formats and the classifier, and a run on a real export reproduces §2's animalhouse counts.

## 4. Re-measure discovery traffic

- **What:** each project's agent runs `--logs` on a month of its own logs and sends the output here. This repo receives counts, never logs or tokens.
- **What could change:** an item whose stated reason is traffic keeps its level only if the traffic still holds. D4's reason is traffic; if the readers are only directories, the reason says so, and the level may change. Record the result in §2 with dates, whichever way it goes.
- **Done when** §2 has a dated second measurement from at least two sites, and each D item's reason matches it.

## 5. Standard additions

Each gets its text, a reason and the harm it prevents in STANDARD.md. Where the audit already fetches what a check needs, the check comes with it.

- **The sitemap equals the route registry** (§11, T4). A guard test fails when a routed, indexable page is missing from the sitemap, or a sitemap URL isn't routed. Harm prevented: pages search never finds. Add a recipe to `docs/recipes.md`, the existing home for copyable tests. No scorecard check: from outside, the audit can't see routes the sitemap leaves out.
- **Markdown copies match their pages** (§11, T4). A guard test compares each copy's headings with its HTML page. Harm prevented: agents reading markdown get a different site than people do. **Scorecard:** D8 already fetches `/` as HTML and as markdown; compare their headings and fail D8 when sections are missing.
- **Retiring a page** (W3). A 301 to the nearest live page, removed from the sitemap, llms.txt and every other discovery file, and a test that it still redirects. Harm prevented: a discovery file that sends agents through a redirect or to a 404. **Scorecard:** W3 already fails sitemap URLs that redirect. D4's link sample already follows each link, so compare `r.url` with the link and report links that redirect, at D4's level.
- **Classifying traffic** (T3, §10). Filter known junk crawlers first and rely on verified bots. Count an unidentified or headless client as an agent only when something backs it up, such as the same address calling the API: §2 shows an agent tool fetching with a browser user agent, so "never" would be wrong. Harm prevented: readiness decisions made on noise. The rule's code is step 3's classifier.

Cite primary sources in §16 for search claims (Google's guidance on redirects for W3).

## 6. Smaller candidates

| Candidate | Decision |
|---|---|
| Page weight | Measure it rather than record it. `readPage` already has each page's HTML: report median HTML size in W6's detail and in the JSON report, not scored. D8's detail already gives `x-markdown-tokens`. |
| Visible date matches `lastmod` | Extend the sitemap parse (`locs()`) to keep each URL's `lastmod`, and compare it with the JSON-LD `dateModified` that `readPage` already parses. A W4 failure on a mismatch, if Google's docs confirm it compares the two. Otherwise leave out. |
| In-page anchors resolve | Leave out: a broken `#anchor` costs little. Add to "Considered and left out" with that reason. |
| Favicon versioning and 16 px legibility | Leave out. D3 already asks for a favicon set, and legibility is design, not readiness. |
| Prerendering, view transitions, theming | Leave out, as the reviewer says. |

## 7. Release 2.0.0

- `package.json` and `VERSION`; the CLI's pinned command follows the major version on its own.
- Move every `readiness-audit@1` to `@2`: README.md, STANDARD.md, AGENTS.md, CONTRIBUTING.md, docs/adopting.md, docs/usability-test.md and examples/github-action.yml.
- **CHANGELOG** lists every check that can newly fail (W1 to W6 on shallow pages, W5 share text, A1 on a declared API, D8 headings, D4 redirects, W4 dates if added) and what each project should do about it.
- Run the CLI against animalhouse.ai, inbed.ai, drifts.bot and achurch.ai, read the output, and send each project's agent its new failures.

## Also

- **Ask the reviewer about DNS.** They said the `_agent` record went from valid to retired. D10 still recommends one AID record, so either their copy was behind or their record named a service they don't run. Find out which before changing anything.
- **inbed.ai** fails the share-text check today (`/profiles` and five more show the homepage's card on X). Tell its agent now; it doesn't need to wait for 2.0.0.
