# Agent and Search Readiness

[![CI](https://github.com/geeks-accelerator/agent-and-search-readiness/actions/workflows/ci.yml/badge.svg)](https://github.com/geeks-accelerator/agent-and-search-readiness/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/readiness-audit)](https://www.npmjs.com/package/readiness-audit)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**Score any site's readiness for AI agents and search:** llms.txt, robots.txt rules for AI crawlers, the sitemap, structured data, link previews, OpenAPI, MCP servers, agent skills and the A2A path. A standard built from production request logs, and a command-line audit that checks a live site against it. Read-only, no account, no API key.

## Quick start

```
npx readiness-audit example.com
```

It needs Node 22.23.4, 24.22.1 or 26.12.1, or later on the same line (each supported line's current security release), and has no dependencies.

```
Agent and search readiness: animalhouse.ai  (readiness-audit v2.3.0)

Required
  PASS  D1   robots.txt                           1 group with consistent rules, Sitemap listed
  PASS  D4   llms.txt and llms-full.txt           llms.txt 16.2 KB, llms-full.txt 65 KB; 10 sampled links resolve
  PASS  D12  No false declarations                no OAuth, A2A, plugin or server-card claims without the service
  PASS  W1   Titles and descriptions              27 sampled pages (18 static, 3 templates), all with their own
  WARN  W6   Page structure                       heading levels skipped on /agent/[name] (h1 to h3)
  PASS  M4   Hosted MCP edge                      both eras, JSON for every Accept, browsers redirected
  ...
Recommended
  PASS  D7   JSON 404s and a JSON 405 on POST /   JSON 404 for unknown well-known paths, JSON 405 for POST / (Allow: GET, HEAD, OPTIONS)
  WARN  D8   Markdown for agents                  Vary: Accept missing on the HTML response
  ...
Score on 2026-10-24: required 17 of 19, recommended 10 of 11, next level 1 of 2
```

To switch a project over, give its coding agent one line:

> Adopt the Agent and Search Readiness Standard in this repo by following https://github.com/geeks-accelerator/agent-and-search-readiness/blob/main/docs/adopting.md

The agent reads the page when it runs. To have it follow the text you reviewed, put the latest release tag in place of `main` (`blob/v<version>/docs/adopting.md`, from the [releases page](https://github.com/geeks-accelerator/agent-and-search-readiness/releases)).

## Why this exists

What agents and crawlers actually ask a site for, from production logs:

- **The AI crawlers read robots.txt and the sitemap, not llms.txt.** In a week across 56 domains on Cloudflare, bots in Cloudflare's AI categories requested robots.txt 3,644 times and the sitemap 2,232 times, and llms.txt 49 times. llms.txt still matters to other readers: directories, tools, scripts and search bots requested it on every site ([research]({R})).
- **Directories crawl the well-known files; working agents call the API.** At animalhouse.ai, 4 of the 28 addresses that read llms.txt called the API ([§2](STANDARD.md#2-what-the-traffic-says)). Across the 16 sites with an API, 13% of llms.txt readers also got a successful API answer that week.
- **Bots ask for markdown.** 12,601 requests asked for markdown at ordinary page URLs that week, 92% of them from one search engine's crawler (Exa's).
- **A hosted MCP endpoint gets found within hours.** Seven MCP directory crawlers connected to animalhouse.ai's in its first two hours, and 14 browser visits reached it in the same two hours ([§2](STANDARD.md#2-what-the-traffic-says)).
- **No single file reaches every kind of agent.** Directories want the well-known files, scripts want llms.txt and the API, agent tools want clean pages, and search indexes want everything a search engine wants. The standard covers each, at a level its evidence supports.

## This repo holds

- **[STANDARD.md](STANDARD.md):** what to build, item by item, each with an ID, a level and the reason it's at that level. It covers discovery files, search (SEO, and the AI answer engines that GEO and AEO are about), the API, MCP servers, skills, engagement, measurement and tests.
- **[Who requests agent discovery files?]({R}):** the week across 56 domains, with charts, its queries and its classifier.
- **`readiness-audit`:** the scorecard. It checks a live site against everything the standard can verify from outside, about 30 checks in one pass, and lists what it can't see for you to review.

## Why this one

- **Built from evidence.** Each item says why it's there: production request logs, the specs, and Google's and Bing's own documentation, cited with dates. Items that only scanners look for are recommended at most.
- **It checks that declarations are true.** An A2A card that isn't a valid A2A card fails D11; OAuth metadata with no token endpoint, or a catalog entry typed as something it isn't, fails D12. Declining an item in writing is fine; faking a pass isn't.
- **It fits the site.** The API checks run only when a site has or declares an API, and the MCP checks only when one answers. Pages are sampled by type: every static page, and three pages of each generated template.
- **Before and after you ship.** `--base http://localhost:3000` scores a local or preview build; `--compare` lists what changed since the last run; the exit code gates a deploy.
- **The real test is an agent.** The standard's T5 gives a fresh agent only your domain and a goal, and records whether it succeeds. The scorecard is the setup for that, not the goal.

## How it fits with other tools

| Tool | What it does | Use it with this |
|---|---|---|
| [Is Your Site Agent-Ready?](https://isitagentready.com/) (Cloudflare) | A web scan for llms.txt, MCP, agent skills and other agent-facing standards | For a quick look in the browser. This runs in your terminal and CI, scores local builds, and checks search as well as agents |
| [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview) | Audits one page's performance, accessibility, best practices and SEO in a browser | Use it page by page, for Core Web Vitals (W8). This checks a site's discovery files and samples its pages |
| [Rich Results Test](https://search.google.com/test/rich-results) (Google) | Checks a page's structured data against Google's rich result rules | This lists which pages to run through it, with a link for each (W4) |
| llms.txt validators | Check that one file is well formed | This checks llms.txt and samples its links, as one of about 30 checks |
| [security-pranks-audit](https://github.com/geeks-accelerator/agent-security-pranks) | The sister project: checks that a site answers `.env`, `.git` and other secret-hunting probes safely | This welcomes agents and checks what they read; that checks what the scanners get. Same shape, run both |
| [specification.website](https://specification.website) | A sourced website specification: HTML, accessibility, security, SEO, agent readiness | A spec for the whole site, accessibility and security included. This one focuses on agents and search, and comes with a scorer |

## Score a site

```
readiness-audit <domain> [--mcp /path] [--no-mcp] [--json] [--compare previous] [--base url]
readiness-audit --matrix <domain> <domain> ... [--recorded results.json]
readiness-audit --logs <access-log> [--json]
```

| Option | What it does |
|---|---|
| `--mcp /path` | where your hosted MCP endpoint lives (default `/mcp`) |
| `--no-mcp` | skip the hosted MCP checks |
| `--json` | print the results as JSON |
| `--compare file` | list what changed since a previous run: a status page from `--matrix` or a saved `--json` report |
| `--base url` | score a local or preview build as the domain before you deploy (`--base http://localhost:3000`); DNS and host redirects are skipped |
| `--matrix` | score several sites and print a markdown status page |
| `--recorded file` | with `--matrix`, add your recorded T5 and T6 results (format: [examples/recorded.json](examples/recorded.json)) |
| `--logs file` | count requests for the discovery files in an exported access log (combined log format, or JSON lines from Cloudflare, Vercel or Railway), by client family. It prints counts, never addresses |

It prints a pass, warning or failure for each check, with the reason, and exits with code 1 when a required check fails, so it can gate a deploy. The API checks run when `/openapi.json` or `/api` answers, or when the site declares an API (a `service-desc` link, an API catalog, an API link in llms.txt). A declared API that doesn't answer fails them. A site with neither skips them, the way a site with no hosted MCP endpoint skips the MCP checks.

To check fixes before they ship, score a local build: `npx readiness-audit@2 example.com --base http://localhost:3000`. The site's own URLs (from its sitemap, llms.txt, skills and catalog) are requested from the base and reported under the domain. From a clone, run `node bin/readiness-audit.mjs example.com`.

### Safe to run

- **It only reads:** GET requests, plus a few POSTs that create nothing (an MCP `initialize`, `server/discover` and `tools/list`, and an empty POST to `/`), about six at a time.
- **It stays on public addresses.** It won't follow a link the site supplies (in its sitemap, share images, skills, catalog or DNS record) to a private or local address, at any redirect. `--base` may be local, because you chose it.
- **A hostile site can't reach a decoder bug.** It asks for gzip and decodes it itself; a body in an encoding it didn't ask for, such as Brotli, is reported rather than read, and every body is capped at 16 MB.
- **Run it only against sites you run,** or with the owner's permission. [SECURITY.md](SECURITY.md) has the details and how to report a problem.

## What it checks, and what it can't

The scorecard covers what's visible from outside. It checks:
- robots.txt, the sitemap and llms.txt;
- security.txt and the honesty of the A2A path;
- false declarations;
- up to 40 pages for titles, canonical URLs, indexability, structured data, link previews and page structure: every static page, and three pages of each generated template (a group of more than 20 URLs with the same first segment and depth);
- the OpenAPI document and the API's error answers;
- the hosted MCP edge and the MCP tools;
- a sample of skill files: spec names and descriptions, and links to llms.txt and the API reference;
- markdown negotiation, the AI catalog, the DNS AID record, the API catalog, auth.md and the skills index.

It also lists the pages to run through Google's Rich Results Test (W4), with a link that opens each one in the test: the homepage, one page of each template with rich-result markup, and any page that adds a rich-result feature. The scorecard checks that markup parses; Google's test checks each rich result's required properties.

It can't see whether `next_steps` guide well, whether input is forgiving, whether an agent can follow your skills through the core loop, or whether you have tests. The standard marks those items "review" or "test". The agent usability test (T5) measures what all of it is for: whether a fresh agent, given only your domain and a goal, succeeds. [docs/usability-test.md](docs/usability-test.md) has the procedure and a runner. A high score is not the goal.

## Use it in your project

Point to [STANDARD.md](STANDARD.md) from your repo instead of copying it (§14 has a short stub), and pin the scorecard to a major version: `npx readiness-audit@2 <domain>`. To run it on a schedule in GitHub Actions, see [examples/github-action.yml](examples/github-action.yml).

To switch a project over, give its coding agent the one-line prompt in [Quick start](#quick-start). [docs/adopting.md](docs/adopting.md) has the step-by-step instructions it follows, with lessons from the first projects that did it.

## Where it comes from

Six projects wrote down what they do for agents and search: [animalhouse.ai](https://animalhouse.ai), [inbed.ai](https://inbed.ai), [magnifica.family](https://magnifica.family), [drifts.bot](https://drifts.bot), [achurch.ai](https://achurch.ai) and [botsmatter.live](https://botsmatter.live). The standard merges their notes and settles where they disagreed, using the specs and production request logs. It was revised after each project's own agent reviewed it.

An item is in the standard when most projects should do it, not because one project happens to. Specs that are still drafts are marked as such, with dates. If you find something wrong or out of date, open an issue or a pull request.

## Next step

Score your site with `npx readiness-audit your-domain`, read what it reports against [STANDARD.md](STANDARD.md), and when you're ready to switch a project over, give its coding agent the one-line prompt in [Quick start](#quick-start).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). To report a security problem, see [SECURITY.md](SECURITY.md).

## License

MIT
