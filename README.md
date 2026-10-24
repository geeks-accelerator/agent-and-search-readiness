# Agent and Search Readiness

[![CI](https://github.com/geeks-accelerator/agent-and-search-readiness/actions/workflows/ci.yml/badge.svg)](https://github.com/geeks-accelerator/agent-and-search-readiness/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/readiness-audit)](https://www.npmjs.com/package/readiness-audit)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**Score any site's readiness for AI agents and search:** llms.txt, robots.txt rules for AI crawlers, the sitemap, structured data, link previews, OpenAPI, MCP servers, agent skills and the A2A path. A standard built from production request logs, and a command-line audit that checks a live site against it. Read-only, no account, no API key.

```
npx readiness-audit example.com
```

```
Agent and search readiness: animalhouse.ai  (readiness-audit v2.1.0)

Required
  PASS  D1   robots.txt                           1 group with consistent rules, Sitemap listed
  PASS  D4   llms.txt and llms-full.txt           llms.txt 16.2 KB, llms-full.txt 65 KB; 10 sampled links resolve
  PASS  D12  No false declarations                no OAuth, A2A, plugin or server-card claims without the service
  PASS  W1   Titles and descriptions              27 sampled pages (18 static, 3 templates), all with their own
  WARN  W5   Link previews                        og:image size or alt text not declared on /hall, /about, +11 more
  WARN  W6   Page structure                       heading levels skipped on /agent/[name] (h1 to h3)
  PASS  A1   OpenAPI 3.1                          OpenAPI 3.1.0; all 17 operations and their request fields described
  PASS  M4   Hosted MCP edge                      both eras, JSON for every Accept, browsers redirected
  ...
Score on 2026-10-23: required 17 of 19, recommended 10 of 10, next level 1 of 3
```

This repo holds:

- **[STANDARD.md](STANDARD.md):** what to build, item by item, each with an ID, a level and the reason it's at that level. It covers discovery files, search (SEO, and the AI answer engines that GEO and AEO are about), the API, MCP servers, skills, engagement, measurement and tests.
- **[Who reads the discovery files](docs/research/who-reads-discovery-files.md):** a week of traffic across 56 domains on Cloudflare, with charts. The AI crawlers read robots.txt and the sitemap, not llms.txt; bots asked for markdown 12,601 times; directories read the agent cards; and on sites with an API, some readers of llms.txt and openapi.json went on to call it.
- **`readiness-audit`:** the scorecard. It checks a live site against everything the standard can verify from outside, about 30 checks in one pass, and lists what it can't see for you to review.

## Why this one

- **Built from evidence.** Each item says why it's there: production request logs (which agents fetch which files, and which ones go on to call the API), the specs, and Google's and Bing's own documentation, cited with dates. Items that only scanners look for are recommended at most.
- **It checks that declarations are true.** An A2A card that isn't a valid A2A card fails D11; OAuth metadata with no token endpoint, or a catalog entry typed as something it isn't, fails D12. Declining an item in writing is fine; faking a pass isn't.
- **It fits the site.** The API checks run only when a site has or declares an API, and the MCP checks only when one answers. Pages are sampled by type: every static page, and three pages of each generated template.
- **Before and after you ship.** `--base http://localhost:3000` scores a local or preview build; `--compare` lists what changed since the last run; the exit code gates a deploy.
- **The real test is an agent.** The standard's T5 gives a fresh agent only your domain and a goal, and records whether it succeeds. The scorecard is the setup for that, not the goal.

## How it fits with other tools

| Tool | What it does | Use it with this |
|---|---|---|
| [Is Your Site Agent-Ready?](https://isitagentready.com/) (Cloudflare) | A web scan for llms.txt, MCP, agent skills and other agent-facing standards | For a quick look in the browser. This runs in your terminal and CI, scores local builds, and checks search as well as agents |
| llms.txt validators | Check that one file is well formed | This checks llms.txt and samples its links, as one of about 30 checks |
| [security-pranks-audit](https://github.com/geeks-accelerator/agent-security-pranks) | The sister project: checks that a site answers `.env`, `.git` and other secret-hunting probes safely | This welcomes agents and checks what they read; that checks what the scanners get. Same shape, run both |
| [specification.website](https://specification.website) | A sourced website specification: HTML, accessibility, security, SEO, agent readiness | A spec for the whole site, accessibility and security included. This one focuses on agents and search, and comes with a scorer |

## Score a site

It needs Node 26 or later, with current security releases, and has no dependencies. It only reads: GET requests, plus a few POSTs that create nothing (an MCP `initialize`, `server/discover` and `tools/list`, and an empty POST to `/`). It keeps to about six requests at a time, and it won't follow a link the site supplies (in its sitemap, share images, skills, catalog or DNS record) to a private or local address, at any redirect. It asks for gzip and decodes it itself; a body in an encoding it didn't ask for, such as Brotli, is reported rather than read, so a site can't reach a decoder bug on the machine running the audit. It prints a pass, warning or failure for each check, with the reason, and exits with code 1 when a required check fails, so it can gate a deploy.

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

The API checks run when `/openapi.json` or `/api` answers, or when the site declares an API (a `service-desc` link, an API catalog, an API link in llms.txt). A declared API that doesn't answer fails them. A site with neither skips them, the way a site with no hosted MCP endpoint skips the MCP checks.

From a clone, run `node bin/readiness-audit.mjs example.com`.

To check fixes before they ship, score a local build: `npx readiness-audit@2 example.com --base http://localhost:3000`. The site's own URLs (from its sitemap, llms.txt, skills and catalog) are requested from the base and reported under the domain. A private address is allowed for `--base` because you chose it; anything else the site links to still has to be public.

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

To switch a project over, point its coding agent at [docs/adopting.md](docs/adopting.md): step-by-step instructions, with lessons from the first project that did it.

## Where it comes from

Six projects wrote down what they do for agents and search: [animalhouse.ai](https://animalhouse.ai), [inbed.ai](https://inbed.ai), [magnifica.family](https://magnifica.family), [drifts.bot](https://drifts.bot), [achurch.ai](https://achurch.ai) and [botsmatter.live](https://botsmatter.live). The standard merges their notes and settles where they disagreed, using the specs and production request logs. It was revised after each project's own agent reviewed it.

An item is in the standard when most projects should do it, not because one project happens to. Specs that are still drafts are marked as such, with dates. If you find something wrong or out of date, open an issue or a pull request.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). To report a security problem, see [SECURITY.md](SECURITY.md).

## License

MIT
