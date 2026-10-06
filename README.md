# Agent and Search Readiness

[![CI](https://github.com/geeks-accelerator/agent-and-search-readiness/actions/workflows/ci.yml/badge.svg)](https://github.com/geeks-accelerator/agent-and-search-readiness/actions/workflows/ci.yml)

A standard and a scorecard for making a site findable and usable by AI agents and by search engines.

AI agents find a site through discovery files, MCP registries, skills and search. People find it through Google, Bing and the AI answer engines built on them. Both then need the first call to work, and a reason to come back. This repo holds:

- **[STANDARD.md](STANDARD.md):** what to build, item by item, each with an ID, a level and the reason it's at that level. It covers discovery files, search, the API, MCP servers, skills, engagement, measurement and tests.
- **`readiness-audit`:** a command-line scorecard that checks a live site against everything the standard can verify from outside, about 30 checks in one pass.

## Score a site

```
npx readiness-audit example.com
```

It needs Node 20 or later and has no dependencies. It only reads: GET requests, plus a few POSTs that create nothing (an MCP `initialize`, `server/discover` and `tools/list`, and an empty POST to `/`). It keeps to about six requests at a time, and it won't follow a link the site supplies (in its sitemap, share images, skills, catalog or DNS record) to a private or local address, at any redirect. It prints a pass, warning or failure for each check, with the reason, and exits with code 1 when a required check fails, so it can gate a deploy.

```
readiness-audit <domain> [--mcp /path] [--no-mcp] [--no-api] [--json] [--compare previous] [--base url]
readiness-audit --matrix <domain> <domain> ... [--recorded results.json]
```

| Option | What it does |
|---|---|
| `--mcp /path` | where your hosted MCP endpoint lives (default `/mcp`) |
| `--no-mcp` | skip the hosted MCP checks |
| `--no-api` | skip the API checks, for a site with no public API |
| `--json` | print the results as JSON |
| `--compare file` | list what changed since a previous run: a status page from `--matrix` or a saved `--json` report |
| `--base url` | score a local or preview build as the domain before you deploy (`--base http://localhost:3000`); DNS and host redirects are skipped |
| `--matrix` | score several sites and print a markdown status page |
| `--recorded file` | with `--matrix`, add your recorded T5 and T6 results (format: [examples/recorded.json](examples/recorded.json)) |

From a clone, run `node bin/readiness-audit.mjs example.com`.

To check fixes before they ship, score a local build: `npx readiness-audit@1 example.com --base http://localhost:3000`. The site's own URLs (from its sitemap, llms.txt, skills and catalog) are requested from the base and reported under the domain. A private address is allowed for `--base` because you chose it; anything else the site links to still has to be public.

## What it checks, and what it can't

The scorecard covers what's visible from outside. It checks:
- robots.txt, the sitemap and llms.txt;
- security.txt and the honesty of the A2A path;
- false declarations;
- a sample of up to 20 pages for titles, canonical URLs, indexability, structured data, link previews and page structure;
- the OpenAPI document and the API's error answers;
- the hosted MCP edge and the MCP tools;
- a sample of skill files: spec names and descriptions, and links to llms.txt and the API reference;
- markdown negotiation, the AI catalog, the DNS AID record, the API catalog, auth.md and the skills index.

It can't see whether `next_steps` guide well, whether input is forgiving, whether skills ask before acting in public, or whether you have tests. The standard marks those items "review" or "test". The agent usability test (T5) measures what all of it is for: whether a fresh agent, given only your domain and a goal, succeeds. [docs/usability-test.md](docs/usability-test.md) has the procedure and a runner. A high score is not the goal.

## Use it in your project

Point to [STANDARD.md](STANDARD.md) from your repo instead of copying it (§14 has a short stub), and pin the scorecard to a major version: `npx readiness-audit@1 <domain>`. To run it on a schedule in GitHub Actions, see [examples/github-action.yml](examples/github-action.yml).

To switch a project over, point its coding agent at [docs/adopting.md](docs/adopting.md): step-by-step instructions, with lessons from the first project that did it.

## Where it comes from

Six projects wrote down what they do for agents and search: [animalhouse.ai](https://animalhouse.ai), [inbed.ai](https://inbed.ai), [magnifica.family](https://magnifica.family), [drifts.bot](https://drifts.bot), [achurch.ai](https://achurch.ai) and [botsmatter.live](https://botsmatter.live). The standard merges their notes and settles where they disagreed, using the specs and production request logs. It was revised after each project's own agent reviewed it.

An item is in the standard when most projects should do it, not because one project happens to. Specs that are still drafts are marked as such, with dates. If you find something wrong or out of date, open an issue or a pull request.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). To report a security problem, see [SECURITY.md](SECURITY.md).

## License

MIT
