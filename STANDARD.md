# Agent and Search Readiness Standard

**What it is:** a common standard for making a site findable and usable by AI agents and search engines, built from six projects' own playbooks (animalhouse.ai, inbed.ai, magnifica.family, drifts.bot, achurch.ai, botsmatter.live), checked against the specs ([§16](#16-specs-and-sources)), scored against each live site, and revised after each project's agent reviewed it.
**Scorecard:** `npx readiness-audit <domain>` (see the [README](README.md))
**Last verified:** 2026-10-05

> **Start here**
> 1. Score your site: `npx readiness-audit <domain>`. It needs Node 20 or later and no dependencies.
> 2. Check [§3](#3-decide-what-applies) for the items that apply to your project.
> 3. Fix required failures first. Each line the scorecard prints names an ID and the reason.
> 4. Then the recommended items. Build a next-level item when your own traffic shows the problem it solves.
> 5. Run the agent usability test (T5, [how](docs/usability-test.md)) and report its first-try success rate next to your score.
> 6. Re-score monthly.

This is the common standard our projects work toward, published for anyone who builds for agents: how a site gets found by AI agents and by people searching, gets used correctly on the first call, and gives agents a reason to come back. It collects the best practice from six projects, settles the points where they disagreed, and adds higher-value features that most of them don't have yet. An item is here because it's best practice or a spec requires it, whether or not any project has built it. No project meets the whole standard today.

**How the standard works**

- **Every item has an ID:** D (discovery), W (web search), A (API), M (MCP), S (skills), E (engagement), T (measurement and tests), N (next level). The full list, with each item's level and reason, is in [§15](#15-the-standard-checklist).
- **Every item has a level:**
  - **Required**, for one of three reasons:
    - working agents rely on it (the API, MCP, errors that teach);
    - it keeps what you declare true;
    - it's baseline hygiene: an RFC-backed file that costs almost nothing.
  - **Recommended**, when it fits the project. Items backed mainly by scanners land here at most.
  - **Only if true**, for surfaces that are right only when you run the matching service.
  - **Next level**, for higher-value features to build when your traffic shows the need.
- **A project may decline an item** that conflicts with its stated values, such as engagement mechanics at achurch.ai. Record the decision and the reason in the project's CLAUDE.md or docs, and the item counts as met ([principle 9](#1-principles)).
- **The scorecard checks what's visible from outside:** discovery files, a sample of pages for search, the API's error answers, the hosted MCP edge, and a sample of skill files. It prints pass, warn or fail with the reason, and exits 1 when a required check fails, so it can gate a deploy. `--json` saves results; `--matrix <domains>` writes the status page.
- **What the scorecard can't see matters most.** It can't see whether `next_steps` guide well, whether input is forgiving, or whether an agent succeeds. Review and tests cover those ([§11](#11-guard-tests)), and the agent usability test (T5) measures them directly. A high score is not the goal.

---

## 1. Principles

The first seven came from all six projects independently.

1. **One source per fact.** The site URL, install lines, counts and request schemas each live in one module. Every discovery file, card, manifest, skills index and MCP tool list is generated from it. (inbed keeps the facts in `agent-discovery.ts`; at animalhouse the OpenAPI registry generates the spec, the MCP tools and the server card.)
2. **Only declare what's true.** A manifest is a promise a client will act on. An A2A card with no A2A endpoint, OAuth metadata for an authorization server that doesn't exist, or a catalog entry typed as something it isn't sends agents into a dead end, and validators flag it. Answer the paths you don't support with a JSON 404 that points to what you do run. When a scanner's score and the truth disagree, the truth wins ([What scanners check](#what-scanners-check)).
3. **Let traffic decide what to add, and say why everything else is here.** Before adding a surface, page through all of the request logs (not just the newest window) and count who asks for it. Most well-known traffic is directory crawlers; working agents mostly call the API ([§2](#2-what-the-traffic-says)). Items that traffic doesn't justify need another stated reason: honesty, baseline hygiene, or a real consumer. Scanner checks alone make an item recommended at most.
4. **Guard every surface with a test you've watched fail.** Untested discovery files drift without anyone noticing. A magnifica skills index advertised a parameter the API rejects. The animalhouse `agents.txt` still said "there is no hosted MCP" after the hosted endpoint shipped.
5. **Make the first call worth it, and point every response at the next one:** `next_steps` with ready-to-send bodies, and errors carrying a `suggestion` that names the call that fixes them.
6. **Be forgiving at the edge and strict where it counts.** Accept aliases, any `Accept` header and guessable wrong paths. Never guess on a write.
7. **Ask before anything public or permanent.** Skills and tool descriptions say what becomes public, and skills tell the agent to confirm with its person before registering, publishing or rotating a key. This is also what gets skills through ClawHub's security audit.
8. **Raise the floor together.** When one project finds a better way, it goes into this standard, and the others adopt it. The scorecard and the status page make the gaps visible.
9. **A project's values come first.** A project may decline items that conflict with what it stands for. achurch.ai rules out engagement mechanics, recommendation algorithms and analytics beyond aggregate traffic, so it declines those parts of E2, E6 and T2. A decision written down with its reason counts as meeting the item. Silence doesn't.

---

## 2. What the traffic says

Production request logs from animalhouse.ai (26,326 requests, 2026-10-01 to 10-05, plus the first two hours of its hosted MCP endpoint) and inbed.ai (27,423 requests, 10-02 to 10-05):

| Path | animalhouse, 4 days | inbed, 3 days | Who asks |
|---|---|---|---|
| `/.well-known/agent-card.json` | 51 | 23 | AgenstryBot (most), TaifoonHarvester, agentprobe |
| `/llms.txt` | 50 | 16 | AgenstryBot, llms.txt directories, curl, python-httpx |
| `/openapi.json` | 21 | 2 | curl, browsers, a research bot |
| `/api` | 19 | not checked | curl (8), browsers |
| `/.well-known/agents.json` | 17 | 3 | AgenstryBot, BrickBlueBot |
| MCP card guesses: `/.well-known/mcp/server-card.json`, `/.well-known/mcp`, `/.well-known/mcp.json`, `/mcp/server-card` | 13, 13, 12, 11 | 1 to 2 each | AgenstryBot, BrickBlueBot |
| `/.well-known/ai-catalog.json`, `/.well-known/ard.json` | 5, 4 | 3, 3 | agentprobe |
| `/.well-known/security.txt` (and `/security.txt`) | 3 | 4 | Googlebot, scanners |
| `/.well-known/agent-skills/index.json` | 2 | not served | curl |
| `/.well-known/api-catalog`, `/auth.md` | 1, 0 | not served | one crawler |
| `ai-plugin.json`, `x402`, `agent.json`, `did.json`, `oauth-protected-resource` | 1 to 2 each | 1 to 5 each | BrickBlueBot, which sweeps every known path |
| `/.well-known/traffic-advice` | 22 | 5 | Chrome's prefetch proxy, not an agent (a 404 means "allowed") |

What it means:

- **Directories crawl the well-known paths. Working agents call the API.** animalhouse served 6,551 API calls in those four days: python 2,718, curl 2,162, node 529, the stdio MCP server 193. Of the 28 IP addresses that read `llms.txt`, 4 also called the API. Of the 166 that opened `/skills`, 2 did. Same-IP matching undercounts (an agent's docs fetch and its API calls can leave from different machines), but the gap is wide. Discovery files earn their keep with directories and first contact. The API's own responses and the skills carry the agents that do the work.
- **A hosted MCP endpoint gets found within hours.** Seven MCP directory crawlers connected to animalhouse.ai/mcp in its first two hours (mcphub-probe, InvokeRankBot, ProofBench, ThePluginStoreBot, protogrid-probe, GlideMcpIndex, agent-tools.cloud), three of them on protocol 2026-07-28.
- **People click MCP URLs too.** Fourteen browser GETs reached `/mcp` in those two hours and got a JSON 405. Send them to the docs page instead (achurch.ai does).
- **The probed paths keep moving.** AgenstryBot already asks for `/mcp/server-card`, the location the experimental server card extension recommends. Re-check the logs monthly.
- **Different agents read different things.** Measured at animalhouse, 2026-10-01 to 10-05:

| Who | Identifies as | What they fetched |
|---|---|---|
| Agent and MCP directories | AgenstryBot, BrickBlueBot, agentprobe, MCPHarbor, TaifoonHarvester, MCP directory crawlers | well-known files, llms.txt, `/mcp`, MCP card guesses |
| llms.txt directories and validators | llms.txt-directory | llms.txt and llms-full.txt, on a schedule |
| Agents running scripts | curl, python-httpx, Python-urllib, node | the API itself (6,551 calls), llms.txt, `/openapi.json`, `/api` |
| Agent tools fetching pages | a browser user agent (OpenClaw's `web_fetch` sends Chrome's) | the pages and docs the agent chose: agent and creature pages, `/docs/api`, `/openapi.json` |
| Assistants fetching for a person | Claude-User, ChatGPT-User, Meta-ExternalFetcher | the page the person asked about, usually the homepage |
| AI search indexes | Meta-WebIndexer, OAI-SearchBot, Claude-SearchBot, PerplexityBot | ordinary pages, like any search crawler (§5) |

  So no single file reaches every agent. Directories want the well-known files, scripts want llms.txt and the API, tools want clean pages and docs, and search indexes want everything in §5.
- **Check your own traffic before building a next-level item.** botsmatter looked: 2 of its 1,940 Grounds exactly repeat an earlier one, so retries aren't a problem there and N2 isn't worth building.

---

## 3. Decide what applies

| If your project... | Serve | Skip |
|---|---|---|
| has a public HTTP API | A1 to A11: OpenAPI 3.1, `GET /api`, errors that teach, a JSON catch-all for wrong paths, forgiving input; A3 to A5 as recommended | |
| ships an MCP server on npm (stdio) | M1 to M3: npm, the MCP Registry, Smithery, Glama, a `/docs/mcp` page | server card, `/.well-known/mcp.json`, OAuth metadata: they describe a hosted endpoint |
| hosts an MCP endpoint | M1 to M4: everything above plus the forgiving edge, `remotes` in `server.json`, and a DNS AID record with `p=mcp`; M5, the server card, as recommended | |
| runs an A2A endpoint | a valid A2A v1.0 agent card | |
| doesn't run A2A | a JSON 404 at `/.well-known/agent-card.json` that names your real entry points | an "A2A-style" card |
| uses API keys | `WWW-Authenticate: Bearer` on 401s, a key rotation endpoint; auth.md and protected-resource metadata without an authorization server, as recommended | authorization-server metadata |
| runs a real OAuth authorization server | RFC 9728 and RFC 8414 metadata | |
| has no auth | a note in llms.txt or auth.md saying so, and what's public | OAuth metadata |
| publishes content people search for | markdown twins, an Atom feed, IndexNow, `Article` or `QAPage` JSON-LD | |
| takes payments from agents | that payment protocol's manifest | |
| is free | a JSON 404 at the payment paths (`x402`, `mpp`, `payment-manifest`) saying so | payment manifests |
| has endpoints with side effects | a robots `Disallow` for each one, so a crawler can't trigger it | |
| has agents that write or post | the confirmation rules in S1 and the honesty rules in A11 | |
| has many generated pages (profiles, items, versions) | W3's one indexability rule, and W6's unique paragraph per page | indexing every version or empty profile |
| serves several languages | W11 | |
| rules out engagement mechanics | the items in E2 that fit its values, with the rest declined in writing (principle 9) | |

---

## 4. The standard, item by item

Each item says what it is, why it's at its level, and how you know it's done. Search items are in [§5](#5-search-people-and-answer-engines), MCP items in [§6](#6-mcp-servers), skills in [§7](#7-skills-and-plugins), engagement and the remaining API items in [§8](#8-engagement-first-success-then-a-reason-to-return), the next level in [§9](#9-next-level), and measurement in [§10](#10-measurement).

### Required

**D1 robots.txt.** *Why: crawlers obey it, and an inconsistent file can expose endpoints with side effects.*
- **Keep the rules the same for every crawler.** A crawler obeys only the group that names it, and falls back to `*` only when no group does (RFC 9309 §2.2.1). A `User-agent: GPTBot` group that lacks a `Disallow` from the `*` group lets that bot crawl what you meant to block. One group listing `*` and every named crawler is simplest (achurch.ai). Repeating the full rules in every group also works (botsmatter.live).
- **Disallow what has side effects or private data.** For read-only API endpoints that live-fetch agents need (public stats, a self-documenting `GET /api/auth/register`), allow the fetch and send `X-Robots-Tag: noindex` on the JSON instead, so search engines skip it without blocking agents (botsmatter, inbed).
- **Allow your share-card path** (`/api/og/` at animalhouse, `/og/` at botsmatter), and add the `Sitemap:` line.
- **Purge it from your CDN after a change.** Cloudflare caches robots.txt by default, so crawlers keep the old rules until the cached copy expires. The scorecard says when it read a cached copy.
- **Watch for CDN features that rewrite it.** Cloudflare's managed robots.txt, and features like it, put their own group at the top of your file, which can break D1 and D15. Leave them off, or check robots.txt after turning one on.
- Naming AI crawlers and stating a Content-Signal policy is D15 (recommended).
- **Done when** the scorecard passes D1.

**D2 sitemap.xml** with real last-modified dates, listing only indexable pages. Use one rule for both the sitemap and the page's `noindex`. Build-time dates on every URL tell crawlers nothing. *Why: crawlers fetch it (78 times in four days at animalhouse).* **Done when** the scorecard passes D2.

**D3 Server-rendered pages.** Every page's content is in the HTML the server sends, not loaded later by script, with a real logo through the framework's icon convention and a favicon set (missing icons show up as steady 404s). *Why: crawlers, link-preview bots and agents that fetch pages read the HTML, and many don't run JavaScript.* inbed's chat pages once shipped none of their 48 messages in the HTML. The page-level details (titles, canonicals, structured data, previews, headings, links) are W1 to W7 in [§5](#5-search-people-and-answer-engines).

**D4 `/llms.txt` and `/llms-full.txt`**: a short map (what this is, how to start, links to every other surface) and the whole corpus in one fetch. Generate both and test them against the sitemap. The file is markdown; serve it as `text/markdown` or `text/plain`, and use the same type wherever you link it.
- *Why required: traffic, and not from Google.* Google Search ignores llms.txt (it said so in June 2026), but plenty else reads it. At animalhouse, 79 requests in four and a half days came from:
  - agent directories (AgenstryBot, BrickBlueBot, agentprobe, MCPHarbor, AgentTrustBot);
  - llms.txt directories and validators;
  - SEO tools and Amazonbot;
  - agent harnesses and scripts (curl, python-httpx, a DeepSeek harness);
  - fetches presenting themselves as a browser.
- **A missing llms-full.txt gets noticed.** An llms.txt directory asked for it six times and got a 404 before animalhouse published one.
- **Agent tools don't look for it on their own.** OpenClaw's `web_fetch` fetches whatever URL the agent picks, presents itself as Chrome, and converts the HTML to markdown itself. In our logs, OpenClaw agents read agent and creature pages, `/docs/api` and `/openapi.json`, and never llms.txt. So link llms.txt from every skill, README and docs page. An agent reads what it's pointed at.
- **Done when** the scorecard passes D4 and your skills and README link llms.txt.

**D6 `/.well-known/security.txt`** (RFC 9116), served as `text/plain; charset=utf-8`. `Contact` is required, and `Expires` is required exactly once; the RFC recommends keeping it under a year out, so compute it per request and it never lapses. Redirect `/security.txt` to it. *Why: baseline hygiene. It's an RFC, it costs almost nothing, Googlebot and scanners fetch it, and a site that issues API keys needs a published security contact. Agents themselves don't need it.*

**D11 The A2A path is honest.** `/.well-known/agent-card.json` is the most-requested agent path. Serve a valid A2A v1.0 card only if you run an A2A endpoint ([Only if true](#only-if-true)). Otherwise answer a JSON 404 that names your MCP endpoint, OpenAPI document and llms.txt (achurch.ai). A custom document or an "A2A-shaped" card at that path fails. *Why: honesty. A2A §8.3.1 requires every declared interface to be real.*
- **The cost:** directory crawlers drive most requests to this path, and some may stop listing a site that answers 404.
- **Roll it out on one site first.** inbed's agent said it would accept the risk. Watch for two weeks whether AgenstryBot and the other directories keep listing it, then change the rest.

**D12 No false declarations.** *Why: honesty.*
- **Fails:**
  - protected-resource metadata naming an authorization server that has no token endpoint;
  - authorization-server metadata without endpoints;
  - a catalog entry typed as an A2A card when there's no valid card;
  - a catalog entry typed as a server card that points at something else;
  - a DNS record naming a service you don't run (checked in D10).
- **Warnings** (judgment calls, not spec rules):
  - `ai-plugin.json`, a retired format;
  - a stdio-only server card or `/.well-known/mcp.json`. No spec settles `mcp.json`, and an honest stdio description isn't a lie. Directories may still read either file as a hosted endpoint, so prefer the registries.
- **Protected-resource metadata without an authorization server is valid** (RFC 9728 makes `authorization_servers` optional), and auth.md builds on it for API-key services. MCP clients require an authorization server only when an MCP endpoint answers 401, which ours never should (M1).

**A1 OpenAPI 3.1 at `/openapi.json`.** *Why: working agents fetch it (curl was the top client in our logs).*
- Generated from the same source that validates requests: Zod at animalhouse and inbed, plain JavaScript definitions at botsmatter.
- Every operation has a description saying when and why to call it. A one-line summary isn't enough, and the scorecard notes descriptions that only repeat the summary. A "When to use" line per operation in your API reference makes a good source, and agents reading the markdown get it too (inbed).
- Every parameter and request field is described. Response fields too, once you have response schemas (N7).
- Put each description on the field itself. One inside `anyOf` or `oneOf` counts as missing, because many clients show only the field's own description. Zod puts it there for `.nullable()` when `.describe()` comes first, so call `.describe()` last, after `.optional()` and `.nullable()`.
- **Done when** the scorecard passes A1 and `npx @redocly/cli lint` passes. Checking the spec against real responses needs response schemas, so that contract test lives with N7.

**A2 `GET /api`**: a JSON index of every operation, generated from the spec. *Why: agents ask for it (19 requests in four days at animalhouse, curl most often).* A browser asking for HTML can be redirected to the docs ([recipe](docs/recipes.md#get-api-json-for-agents-the-docs-for-browsers-a2)).

**A6 Errors that teach**: `next_steps` and a `suggestion` on every response, errors included ([§8](#a6-every-response-teaches)). *Why: working agents rely on it.* The scorecard tests one case: an authenticated operation called without a key must answer JSON that says how to get one. Point out unreplaced placeholders too: an id like `{{AGENT_ID}}` copied from your docs reaches the real route, not the catch-all, so its not-found answer should say it looks like a placeholder ([recipe](docs/recipes.md#unreplaced-placeholders-in-ids-a6)).

**A7 A JSON catch-all for wrong API paths** with `next_steps`, a `suggestion` or `did_you_mean` ([§8](#forgiving-input-strict-mutations)). *Why: agents guess paths; animalhouse built its catch-all from the 404s in its logs.* `did_you_mean` can come from edit distance against your OpenAPI paths ([recipe](docs/recipes.md#did_you_mean-from-the-openapi-paths-a7)).

### Recommended

**D5 `Link` headers (RFC 8288) on every response.** *Why: cheap and standard; scanners read them. A wrong target is a false declaration and fails.*
- The template:
  ```
  Link: </openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json",
        </docs/api>; rel="service-doc"; type="text/html",
        </llms.txt>; rel="describedby"; type="text/plain",
        </.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"
  ```
- Give each link the type your server actually sends for that URL. llms.txt is usually `text/plain`.
- `service-desc` is the machine-readable description (your OpenAPI). `service-doc` is the human documentation (RFC 8631). Five of the six projects fail D5: two send no `Link` header, one points `service-desc` at its skills index, and two are missing a rel.
- Registered relations are `describedby`, `service-desc`, `service-doc`, `service-meta` and `api-catalog`. `ard`, `ai-catalog`, `llms-txt`, `mcp`, `agent-card` and `agent-skills` aren't registered: fine to use, but generic clients won't know them.

**D7 JSON 404s for unknown `/.well-known/*` paths, and a JSON 405 on `POST /`** naming the MCP endpoint and the API (achurch.ai, magnifica). An HTML 404 page is noise to an agent. *Why: cheap, and it helps the agents and crawlers that guess. No project passes all of it yet.* One catch-all route can answer D7 and D11 together ([recipe](docs/recipes.md#one-catch-all-for-unknown-well-known-paths-d7-d11)).

**D9 An AI catalog (ARD)**
- One list of what an agent can use here, such as the MCP server card, the OpenAPI document, skills and llms.txt, with identifiers in the form `urn:air:<publisher-domain>:<namespace>:<name>`.
- Serve the same document at two paths. ARD v0.91 names `/.well-known/ard.json` and `<link rel="ard">`, and consumers must check those. The older `/.well-known/ai-catalog.json` and `rel="ai-catalog"` are what isitagentready and the server card extension still use. Add both `<link>` tags to the page head.
- Serve it as `application/ai-catalog+json`.
- List only entry types you really conform to (D12).

**D10 A DNS AID record**
- One TXT record at `_agent.<domain>` (AID v2.1.1, `v=aid2`). Point it at your main agent entry point: the hosted MCP endpoint if you have one (`p=mcp`), otherwise the OpenAPI document (`p=openapi`).
- `v`, `u` and `p` are required and `a` is recommended. `s` is a description of up to 60 bytes; `d` is the docs URL.
- `a` is the auth hint. AID v2.1.1 allows `none`, `pat`, `apikey`, `basic`, `oauth2_device`, `oauth2_code`, `mtls` and `custom`. For an API that takes keys: `v=aid2;u=https://example.com/openapi.json;p=openapi;a=apikey;s=Example API;d=https://example.com/docs/api`.
- Exactly one record: AID clients fail on ambiguity when there are two.
- Only name a protocol you serve (allowed: `mcp`, `a2a`, `openapi`, `grpc`, `graphql`, `websocket`, `local`, `zeroconf`, `ucp`). The scorecard fails a record that names a service you don't run.
- Scanners check DNS-AID, a different spec ([Only if true](#only-if-true)), so an AID record earns no scanner credit. It's for AID-aware clients.

**D13 A page for the people who run agents**
- `/for-agents` or `/agents`, linking every machine surface, with a copy-paste prompt.
- A homepage "I'm an agent" toggle.
- `/docs/mcp` with setup for each client.
- A "Connect your agent" section in the README.
- All of them read the install lines from the one source.

**D14 `AGENTS.md`** at the root of each public repo: a tool-neutral entry point for coding agents.
- Codex, Cursor, GitHub Copilot, Gemini CLI, Windsurf, Zed, Aider and others read it. In a product's public companion repo it doubles as integration docs.
- By default, Claude Code reads AGENTS.md only when there's no CLAUDE.md. A repo with both should import it from CLAUDE.md with `@AGENTS.md`. Alternatively, each user can set Claude Code's project instructions setting to load both.

**D15 Name the AI crawlers you welcome, and state a Content-Signal policy.** *Why: it states intent, and scanners check it. It's Cloudflare's policy, not a standard, and Google ignores it.*
- Training, search and live-fetch bots are separate user agents: GPTBot, OAI-SearchBot and ChatGPT-User; ClaudeBot, Claude-SearchBot and Claude-User; PerplexityBot and Perplexity-User; Google-Extended; Applebot-Extended; and so on.
- `Content-Signal: search=yes, ai-input=yes, ai-train=yes` (or your actual choices) in every group: a line in the `*` group never reaches a bot with its own group.
- Watch the IETF's AIPREF drafts, which define a successor (a `Content-Usage` rule and header with the vocabulary `train-ai`, `ai-use`, `search` and values `y`/`n`).

**A3 `/.well-known/api-catalog`** (RFC 9727): a linkset served as `application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"`. Serve it from a route, because a prerendered extensionless file loses its content type (magnifica). *Why: baseline hygiene. It's an RFC and scanners check it, but one crawler asked for it in four days.*

**A4 `/auth.md`**: WorkOS's open protocol for telling agents how to register and authenticate (adopted by Cloudflare, Firecrawl and Resend). *Why: scanners check it and it costs little, but it isn't a standard, and nothing requested it in our logs.*
- A plain markdown file at the root covering discovery, the methods you support, registration, how credentials are used, errors and revocation.
- It builds on RFC 9728 protected-resource metadata and `WWW-Authenticate: Bearer resource_metadata="..."` on 401s, and it allows API keys.
- A service with no auth can say so here, or in llms.txt.
- Serve it as markdown, not as a redirect to an HTML page.

**A5 The API reference as raw markdown** at `/docs/api.md` (inbed, drifts, botsmatter). Agents don't want the HTML.

**S2 Agent Skills discovery index** at `/.well-known/agent-skills/index.json`, following Cloudflare's discovery RFC v0.2.0:

| Field | Required value |
|---|---|
| `$schema` | `https://schemas.agentskills.io/discovery/0.2.0/schema.json` |
| `skills[]` | each entry has `name`, `type` (`skill-md` or `archive`), `description` (up to 1,024 characters), `url`, and `digest` (`sha256:` plus 64 lowercase hex) |

List the skills your site serves ([S1](#s1-skill-files)). The `$schema` value is an identifier, not a link (it doesn't have to resolve). Clients skip an index whose `$schema` they don't recognize, so a wrong value hides every skill. Extra fields are ignored. Details in [§7](#7-skills-and-plugins).

**M5 An MCP server card** for a hosted endpoint ([§6](#m5-the-server-card)). Recommended, not required, because the extension is experimental.

**For content sites:** Atom feeds, IndexNow (W10), `Article` and `QAPage` JSON-LD, and `potentialAction` blocks describing callable API actions (botsmatter, achurch.ai).

**Fresh content on a schedule.** drifts generates one new experience a day, written to stay timeless; botsmatter has a daily prompt.

**Optional extra:** a `Content-Signal` response header repeating the robots.txt policy (botsmatter). Cloudflare sends one, but the policy itself defines no header.

### Only if true

| Surface | Serve it when | Otherwise |
|---|---|---|
| A2A agent card (`/.well-known/agent-card.json`) | you run an A2A endpoint. A v1.0 card needs `supportedInterfaces` (each with `url`, `protocolBinding` and `protocolVersion`), `skills`, `capabilities` and input and output modes, and every interface must name a real endpoint (§8.3.1). | a JSON 404 naming your MCP endpoint, OpenAPI document and llms.txt (D11) |
| MCP server card | you host a Streamable HTTP endpoint (M5) | nothing. Stdio servers are found through the registries. |
| `/.well-known/mcp.json`, `/.well-known/mcp/server-card.json` | as aliases of your real server card, while directories still probe them | 404 |
| OAuth authorization-server metadata (RFC 8414), and `authorization_servers` in protected-resource metadata | you run a real authorization server. MCP requires `authorization_servers` for MCP auth. New MCP clients register with Client ID Metadata Documents; Dynamic Client Registration was deprecated in 2026-07-28. | protected-resource metadata without an authorization server (fine for API keys), or nothing |
| DNS-AID (SVCB records under `_agents.<domain>`, an individual IETF draft) | you run the endpoint it names. It's what isitagentready checks. | nothing |
| Payment manifests (x402, MPP) | you accept agent payments | a JSON 404 saying the API is free (drifts) |
| WebMCP (`document.modelContext`) | you register in-page tools for browser agents. It's a draft community report, and only Chrome has it (flag from version 146, origin trial 149 to 156, per Chrome Platform Status). | nothing |
| `/.well-known/glama.json` | you host a remote MCP server and want to claim Glama's connector listing | the repo-root `glama.json`, which claims a GitHub-indexed server |
| `/.well-known/tdmrep.json` (W3C community report) | you want to reserve text-and-data-mining rights under EU law (DSM Directive Art. 4(3)). With everything allowed, it adds little to robots.txt. | nothing |

### Skip

- **`ai-plugin.json`**: ChatGPT plugins ended on 2024-04-09. ChatGPT apps now connect over MCP (the Apps SDK), so a hosted MCP endpoint is how you reach ChatGPT.
- **`agents.json`** (Wildcard): v0.1.0, with no commits since August 2025, and only directory crawlers request it. It's harmless if the flows are real, but don't build one new.
- **NLWeb**: only if you run an NLWeb `/ask` endpoint.
- **`agent.json`, `ai.txt`, `did.json`, `brick-blue.json`**: no standard behind them. Sweepers request them.
- **`traffic-advice`**: Chrome's prefetch proxy, not agents. A 404 already means allowed.

### What scanners check

isitagentready.com (Cloudflare) is the scanner agents' builders run. As of 2026-10-05 it checks:

| Category | Checks |
|---|---|
| Discoverability | robots.txt, sitemap, `Link` headers, DNS-AID |
| Content | markdown negotiation |
| Bot access | AI bot rules in robots.txt, Content Signals, Web Bot Auth |
| API, auth and MCP | API catalog, OAuth discovery, OAuth protected resource, auth.md, MCP server card, A2A card (off by default), Agent Skills, WebMCP, ARD (the older `ai-catalog` names) |
| Commerce (informational) | x402, MPP, UCP, ACP, AP2 |

It doesn't check llms.txt, security.txt, TDMRep, IndexNow or AGENTS.md, and it's lenient: it passed its own API catalog served as `text/plain`. Use it as a presence check. It rewards OAuth metadata and requires an A2A card for its top level, "Agent-Native". Don't publish either one to score points when you don't run them. Our scorecard checks against this standard instead, including whether what you declare is true.

---

## 5. Search: people and answer engines

Search engines and AI answer engines read the same pages, so one set of practices serves both. Google's AI Overviews and AI Mode draw on Google's own index and need nothing beyond an indexable page that's eligible for a snippet: no special files, markup or rewriting for AI. Bing's index also serves Copilot and Bing's grounding API. ChatGPT search needs OAI-SearchBot allowed, Perplexity runs its own index, and Claude's web search lists Brave Search among its providers. Every item here is something most of the six projects already do or should do; practices only one project needs are listed at the end, with the reason they're left out. D1 (robots.txt), D2 (the sitemap) and D3 (server-rendered pages) are the foundation. The scorecard checks W1 to W6 on a sample of up to 20 pages from each sitemap.

The evidence that this work pays: achurch.ai's August batch rewrote titles and snippets, fixed pages that weren't rendered on the server, and made missing pages real 404s. Over the following weeks, Google clicks went from 13 to 24 (three-month rolling) and click-through rate from 2.3% to 3.8%. The numbers are small, but the direction is clear, and the snippet rewrite took one query from 0% to 22%.

### Required

**W1 Titles and descriptions.** *Why: they're the snippet people choose from (achurch's click-through rate rose after the rewrite).*
- **One helper builds every page's metadata:** title, description, canonical, Open Graph and Twitter tags (drifts' `pageMetadata()`, achurch's page-meta builder, inbed's `generateMetadata`). Change it in one place.
- **Unique per URL, generated from the page's data.** botsmatter's 1,937 Ground versions once shared 43 titles.
- **Titles name what people search for**, with the brand last after a `|` ("Adopt a Capybara for your AI agent | animalhouse.ai").
- **Descriptions of about 140 to 160 characters,** built from whole sentences or cut at a word boundary, never mid-word.
- **Lengths are a guide, not a rule.** Google sets no limit: it cuts titles and snippets to the screen's width and may rewrite them. Titles under about 70 characters usually show in full. The scorecard warns past 70 and outside 50 to 160.
- **Set them on the server.** A client-side `document.title` overwrites the server's title after load, so people and crawlers see different titles (achurch).
- **Done when** the scorecard passes W1.

**W2 Canonical URLs and one host.** *Why: duplicate URLs split a page's signals.*
- A self-referencing canonical on every page.
- Filtered, sorted and search views stay out of the index with `noindex` (inbed) or a robots.txt `Disallow`. Google calls a canonical pointing at the unfiltered list (botsmatter's approach) less effective over time, and says not to use `noindex` to pick a canonical.
- Paginated pages keep their own canonical, with a page-specific title and description (inbed, botsmatter). Don't point page 2 at page 1.
- `http://` and the other host (`www.` or the bare domain) reach the canonical host in one 301 (inbed).
- **Done when** the scorecard passes W2.

**W3 One rule for what's indexable.** *Why: thin, duplicate and test pages fill Google's "crawled, not indexed" bucket and drag down how the rest of the site is judged.*
- One rule decides which pages are indexable, and the sitemap, the page's robots meta and internal recommendation lists all use it (inbed's `indexable()` SQL column; at animalhouse the sitemap's filters are mirrored by `noindex`).
- Not indexable: test and template accounts, empty profiles, unhatched or ephemeral items, filtered views, sign-in pages, and thin pages (inbed: chats with fewer than five messages). They still render, with `noindex`, and stay out of the sitemap. Google has no `follow` rule (following links is the default), so don't count on `noindex` pages to get other pages found: link those from indexable pages (W7).
- Missing items return a real 404 (or 410; Google treats them the same), never a 200 page that says "not found". Google calls that a soft 404 and drops it (achurch fixed a silent fallback). Empty filter combinations and page numbers past the end get a 404 too.
- In Next.js, a `loading.tsx` above a detail page streams a 200 before `notFound()` runs, so every missing item answers 200. inbed moved its root `loading.tsx` off the profile routes, and missing profiles went from 200 to 404 in production. Keep loading boundaries off the routes of detail pages; the scorecard's missing-page probe shows whether it worked.
- The sitemap lists only indexable canonical URLs that answer 200 without a redirect. Google and Bing both ignore `changefreq` and `priority`, and both use `lastmod` only when it's the real date of a meaningful change (D2). Bing asks for ISO 8601 with a time. Leave `lastmod` off where it would churn: drifts omits it on profiles, whose activity changes every few minutes.
- **Done when** the scorecard passes W3.

**W4 Structured data that's true.** *Why: it tells search and answer engines what a page is, and principle 2 applies to markup too.*
- `Organization` (with your logo) and `WebSite` on the homepage, with stable `@id`s in one `@graph` (magnifica).
- `BreadcrumbList` on pages below the top level.
- One type per page that fits: `Article` or `TechArticle`, `ProfilePage`, `CollectionPage` or `ItemList`, `SoftwareApplication`. `datePublished` and `dateModified` on articles.
- **Honest types for agents.** schema.org has no type for AI agents. Google's `ProfilePage` requires `Person` or `Organization` and says to default to `Person` when an account's type is unknown, and schema.org's `Person` isn't limited to humans. So `Person` fits a profile the page clearly labels as an AI agent (inbed), and markup that implies a human doesn't. botsmatter uses `Thing` and gives up profile rich results. Either is honest; say on the page what the agent is.
- **Don't chase retired rich results.** Google ended HowTo rich results in 2023, the sitelinks search box (`WebSite` with a `SearchAction`) in November 2024, and FAQ rich results for every site in May 2026. Leftover markup does no harm and does nothing in Google; Bing says structured data may help it ground answers. Keep `FAQPage` or `HowTo` only where the page really is one.
- **Escape JSON-LD.** User content containing `<`, `>`, U+2028 or U+2029 can break out of the script tag (achurch, magnifica).
- **Done when** the scorecard passes W4 and Google's Rich Results Test accepts a sample.

**W5 Link previews.** *Why: a shared link is how many people, and some agents, first see a page.*
- Open Graph (`og:type`, `og:url`, `og:title`, `og:description`, `og:image`) and `twitter:card` set to `summary_large_image` on every page.
- Declare `og:image:type`, `og:image:width`, `og:image:height` and `og:image:alt`, but only sizes you know (drifts tests this).
- A rendered 1200×630 card for every entity (all six do this), drawn only for pages that exist: achurch's card 404s wherever its page would. The alt text repeats the card's words.
- Version the card URL (`/og/v1/`). Platforms cache images for weeks, and a new URL is the only reliable way to show a new design (achurch, botsmatter).
- Set `twitter:card` explicitly: X doesn't infer the card type, and without it a link may get the small card. Leave `twitter:title`, `twitter:description` and `twitter:image` out unless they differ: X falls back to the page's `og:` tags, and a site-wide value overrides every page (magnifica).
- 1200×630 works for Meta, LinkedIn and X. X's large card needs a 2:1 image under 5 MB, and not SVG.
- Don't customize Open Graph tags without the title and description too: search reads those (achurch).
- **Done when** the scorecard passes W5.

**W6 Page structure.** *Why: headings, language and alt text are how readers, screen readers and machines parse a page.*
- One `h1` per page, with sections as `h2`.
- `html lang` on every page. Screen readers need it; Google detects language from the text and ignores the attribute.
- Descriptive alt text on content images. Google calls alt text the most important image metadata; file names give it only light clues.
- On generated entity pages, a unique narrative paragraph (botsmatter, animalhouse), and excerpts rather than full copies of text that has its own page, so the detail page ranks for its own words (botsmatter).
- **Done when** the scorecard passes W6.

**W7 Internal links** (checked in review).
- Every entity name links to its page, and detail pages end with related links ("More from {username}", botsmatter).
- Recommendation lists draw from many pages, not the same few (inbed's pool of about 150 indexable agents).
- Anchor text describes the target ("Catholic AI ethics compass", not "click here" or a bare domain), including links between sibling projects (achurch).
- Every sitemap URL is linked from at least one page.

### Recommended

**W8 Core Web Vitals on the main pages.** Good means LCP of 2.5 s or less, INP of 200 ms or less and CLS of 0.1 or less, at the 75th percentile of visits. Google's ranking uses them, but relevance wins over page experience.
- **Fixes we've used:**
  - long immutable caching and compression for static assets (botsmatter);
  - image sizes and `fetchpriority="high"` on the hero image (magnifica, inbed);
  - analytics loaded lazily (inbed);
  - fonts with `preconnect` and `display=swap` (botsmatter).
- **Measure** with Lighthouse or PageSpeed Insights, and Search Console's field data.

**W9 Off-site listings.** Each listing is another way in:
- curated lists such as awesome lists;
- MCP directories: npm, the MCP Registry, Smithery, Glama, mcp.so, PulseMCP;
- llms.txt directories;
- ClawHub;
- descriptive links from sibling projects (E6).

**W10 IndexNow** for content that changes: a key file plus a ping when a page is added, updated or removed (magnifica), or Cloudflare's Crawler Hints (achurch, animalhouse). Bing says it keeps outdated URLs out of Copilot's answers and grounding results. It reaches Bing, Yandex, Seznam, Naver, Yep and Amazon, though not Google.

### Only if true

**W11 Localization.** If you serve several languages:
- per-language URLs with symmetric `hreflang` links, including `x-default`;
- a localized title and description;
- `html lang` and `dir` set on the server;
- `og:locale` in `language_TERRITORY` form (`en_US`), while JSON-LD `inLanguage` uses BCP 47 tags (`zh-Hans`).

magnifica does this for 15 languages.

**Ratings and offers** (`Product`, `Offer`, `AggregateRating`): only for something you really offer, with reviews written by its users on your own pages (drifts' experiences). Ratings of yourself as an `Organization` don't show, and reviews copied from other sites or given for an incentive aren't allowed.

### Considered and left out

The test is whether most of the six projects should do it. These came from one or two projects and don't pass:

- **Share actions to X or Moltbook in `next_steps`** (inbed): untested elsewhere, and posting publicly on someone's behalf needs their consent (principle 7).
- **Commit messages that end with a call to action:** a team habit; neither search nor agents read them.
- **Keyword-rich image file names** (drifts): little measurable effect.
- **A web manifest and a light/dark `theme-color`:** nice for installability, no effect on search.
- **`changefreq` and `priority` in the sitemap** (achurch): Google and Bing ignore both.
- **Question-shaped headings written for AI** (magnifica): Google's May 2026 guide for AI features says chunking or rewriting content for AI doesn't help. Write headings for people.
- **A meta keywords tag** (achurch's batch rewrote one): Google and Bing ignore it.
- **A brand name another site owns** (achurch competes with an "Achurch" consultancy): real, but particular to one name. Check your own brand query in Search Console.

---

## 6. MCP servers

### M1 Every MCP server

*Required for every project with an MCP server. Why: agents work through it.*

- **Make it a thin adapter over the same operations as the REST API.** One tool per operation, with the same names, generated from the OpenAPI spec where you can (animalhouse) and held to it by parity tests (achurch.ai checks that each tool returns exactly what its REST twin does, in both protocol eras).
- **Write descriptions for the model:** when to call the tool, what it returns, what becomes public and what stays private. Starting with `Wraps METHOD /path.` lets `next_steps` map straight to a tool.
- **Annotate:** `readOnlyHint` on reads and `destructiveHint` on irreversible actions, so hosts can let agents read freely and ask before anything final.
- **Turn API errors into tool results** with `isError: true`, carrying the API's own words. An MCP endpoint should never answer HTTP 401, because a 401 sends clients into OAuth discovery.
- **Put `next_steps` in every result,** each naming the tool that takes it (achurch.ai).
- **Add prompts and resources:** prompts for getting started and for the core loop; resources such as `about` and any doc by path.
- **Ship skills written for the tools,** and check that they only call tools that exist.

### M2 A stdio server on npm

*Required for stdio servers.*

- **Works with no setup:** the `register` tool creates the identity.
- **Saves the key** to `~/.config/<product>/credentials.json`: mode 0600, written atomically, and used only when its saved base URL matches. An env var overrides it; a blank env var counts as unset.
- **Refuses a second `register`** while a key is saved, unless called with `replace_saved_agent: true`.
- **`rotate_api_key`** revokes the old key and rewrites the file. Other running copies re-read the file when they get a 401.
- **Identifies itself:** `User-Agent: <package>/<version>`, so MCP traffic shows up in the logs.
- **Links to the registry:** `mcpName` in `package.json` ties the npm package to the registry entry.

### M3 Publishing

*Required for published servers.*

- **npm,** with a README written for the npm page: copy-paste install blocks for each client (magnifica). Run `npm whoami` first: logins expire, and a 404 on publish means you're logged out.
- **The official MCP Registry.** `server.json` lists `packages` and, for a hosted endpoint, `remotes`. Publish from a GitHub Actions OIDC workflow, because interactive login can't publish to an org namespace.
- **Smithery** (an MCPB bundle), **Glama** (a repo-root `glama.json` whose one field, `maintainers`, lists GitHub usernames; required for org-owned repos), and **mcp.so** (active).
- **One version everywhere:** `package.json`, `server.json`, the server card and the plugin's pin. A test fails on a partial bump.
- **Order:** deploy the API, publish the package, then push the docs and pins that name the new version.

### M4 A hosted Streamable HTTP endpoint

*Required for hosted endpoints. Why: directories and clients connect within hours ([§2](#2-what-the-traffic-says)), in both protocol eras.*

- **Stateless:** a fresh server per request, with nothing kept between requests.
- **Both protocol eras** on SDK v2: 2026-07-28 through `createMcpHandler`, and 2025-era clients through a legacy path. Modern-only clients fail against legacy-only servers, and directories already send 2026-07-28.
- **Answer 2025-era clients in plain JSON, whatever their `Accept` header.** The spec puts the `Accept` requirement on the client and lets a server reply with JSON. Nothing tells a server to refuse a narrow header.
  - **The problem:** the SDK's built-in legacy fallback answers in SSE frames. It also returns 406 to any client whose `Accept` doesn't list both `application/json` and `text/event-stream`: JSON-only, `*/*`, or none at all. (Verified by reading `@modelcontextprotocol/server` 2.3.1, where `handlePostRequest` checks both types unconditionally, and by testing animalhouse.ai/mcp. The fallback has no JSON option. The modern path accepts any `Accept`.)
  - **The fix:** run the modern handler with `legacy: 'reject'`. Route legacy requests yourself with the SDK's `isLegacyRequest`. Complete their `Accept` header first (the transport still returns 406 without both types, even with JSON enabled), then serve them through a per-request `WebStandardStreamableHTTPServerTransport` (or `NodeStreamableHTTPServerTransport`) created with `sessionIdGenerator: undefined, enableJsonResponse: true`.
  - **Reference implementation:** achurch.ai, `app/server/mcp/index.js`. The SDK's guide is `docs/serving/legacy-clients.md`.
- **Answer GET helpfully:** browsers (`Accept: text/html`) get a redirect to the docs page; everything else gets a JSON 405 with `Allow: POST`.
- **Validate Host and Origin** (`hostHeaderValidationResponse` and `originValidationResponse` in the SDK). This is required for anything reachable on localhost, and defense in depth behind a host-routed edge.
- **Redirect the paths directories guess:** `/sse`, `/mcp/sse` and `/api/mcp` get a 308 to the endpoint. This helps clients that POST to a guessed path. It does not serve old SSE-transport clients (protocol 2024-11-05), which GET `/sse` and wait for an `endpoint` event, so don't advertise `/sse` as a transport.
- **Log what happens:** one line per call (protocol era, method, tool, User-Agent). Log every refusal with its reason; that's how the 2026-07-28 gap was found. Redact private queries.
- **Bound it:** a per-IP rate limit and a request body cap.

### M5 The server card

*Recommended for hosted endpoints. Why: directories probe for it, but the MCP server card extension is experimental: "not an accepted or official MCP extension," and the SEP is still under review.*

- **Location:** `<endpoint>/server-card` (for example `https://animalhouse.ai/mcp/server-card`), the location the extension's `docs/discovery.md` recommends. The same document recommends against `.well-known` locations for the card itself. Serve it as `application/mcp-server-card+json` (the media type that document defines) with CORS `*` and `Cache-Control: public, max-age=3600`.
- **Schema:** `$schema` must be `https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json` (an identifier; it doesn't resolve yet).
  - Required: `$schema`, `name` (reverse DNS, the same as the registry name), `version`, `description`.
  - Optional: `title`, `websiteUrl`, `repository`, `icons`, and `remotes` with `supportedProtocolVersions`.
  - No tools, resources or prompts: clients list those at runtime.
- **Discovery:** list the card in the AI catalog (D9) as type `application/mcp-server-card+json`. Keep `/.well-known/mcp/server-card.json` and `/.well-known/mcp.json` as aliases only while directories still probe them.
- **Generation:** build the card from the package metadata so the version can't drift.

---

## 7. Skills and plugins

### S1 Skill files

*Required for every project that publishes skills. Why: agents act on them, and they decide what an agent does in public.*

- **One `SKILL.md` per job, following the agentskills.io spec.**
  - `name`: 1 to 64 characters of `a-z`, `0-9` and hyphens (no leading, trailing or double hyphens), matching the folder name.
  - `description`: up to 1,024 characters, saying when to use the skill.
  - Keep the body under 500 lines and about 5,000 tokens (the spec's recommendation); ClawHub practice is under 20 KB.
  - One skill per job or intent; never reshuffled duplicates.
- **Keep display titles out of `name`.** ClawHub ranks on the display title, and its CLI takes that title separately (`clawhub publish --name "..."`; animalhouse's publish script passes the H1). So the frontmatter `name` can follow the spec. Skills that ship inside a plugin must: Claude Code, Codex and Cursor load them.
- **Trigger only on explicit requests, and confirm before anything persistent or public** (registering, publishing, posting, rotating a key). Every skill that publishes needs this, not just most of them. That wording is what passes ClawHub's security audit.
- **Link the map.** Every skill links llms.txt and the API or MCP reference (`/docs/api.md`, `/openapi.json` or your MCP docs), because an agent's fetch tool only reads what it's pointed at (D4). The scorecard checks this on a sample of skills from your index. At animalhouse, the core skill and both plugin skills linked neither.
- **Serve the raw file** at a stable URL so an agent can install it with one fetch (`/.well-known/agent-skills/<name>/SKILL.md` keeps the folder name in the URL), plus a `/skills` page. Index them in S2, with each digest computed from the bytes you serve.
- **Index the skills the site serves, not every listing.** inbed lists about 95 skills on ClawHub and indexes the 6 its site serves; animalhouse indexes 93 of 176, leaving out keyword variants of its core guide. Publishing an index makes S1 apply, so the required count goes up by one. Editing skills to pass it means republishing them and syncing any plugin copies, which is the owner's call.

### S3 Marketplaces and per-item skills

*Recommended.*

- **Per-item skills** can each rank for their own searches: one per species, experience or catalog item (animalhouse has about 170, inbed about 95, drifts about 150). Use distinct display names and no keyword stuffing.
- **ClawHub rules:**
  - Skills and plugins share one namespace.
  - New releases stay hidden until the security scan passes.
  - The server-side validator is stricter than the CLI.
  - Keep an `owners.json` that maps each skill to its account, and publish only through a script that checks `whoami` against it. Publishing another account's slug has gotten accounts banned.
  - Spread listings across accounts and publish slowly.

### S4 A plugin bundle

*Recommended.* One folder installs the MCP server plus skills on four hosts.
- Claude Code: `.claude-plugin/` and `.mcp.json`.
- Codex and Cursor: the Agent Plugins `plugin.json` and `mcp.json`.
- OpenClaw: `openclaw.plugin.json`.
- Generate every manifest from one source file, and have CI fail on drift or on a skill that names a missing tool.
- Ship copies of the skills, not symlinks (Codex drops symlinks).
- Repo-root marketplaces let people install straight from GitHub.
- Pin the MCP server to an exact version.
- Codex reads `.claude-plugin/plugin.json` and passes `${user_config.*}` through literally, so don't depend on userConfig substitution.

---

## 8. Engagement: first success, then a reason to return

### E1 The first call

*Required. Why: an agent that gets nothing from its first call rarely makes a second.*

- **Deliver value on the first call.**
  - animalhouse: the egg hatches on the first status check, which raised hatching from 45% to 98%.
  - achurch.ai: one `attend` call returns the song, its lyrics, readings and other visitors' reflections.
  - botsmatter: the entry point returns a template, today's prompt, stats and suggested next calls.
- **One-call registration** that returns the key and the first next steps.
- **A home base to recover from,** such as `GET /api/me` (profile, current work, alerts, next steps). An agent without memory starts here (drifts).
- **Self-documenting endpoints:** a GET on a POST endpoint returns its schema with an example.

### A6 Every response teaches

*Required.*

- **`next_steps`:** method, endpoint, a ready-to-send body, optional fields, a plain-language reason, and the MCP tool name.
- **Errors that explain themselves:** `error`, a `suggestion` naming the call that fixes it, `next_steps`, and validation `details`. A 401 says how to get a key. A 429 says when to retry.
- **If you send notifications,** each one links back into the API (inbed).

### Forgiving input, strict mutations

*Required.*

- **A7** A JSON catch-all for unknown API paths:
  - A care action used as a path gets the right call.
  - A real operation's name in the wrong place gets `did_you_mean`.
  - A cut-off link gets a 308 to the real path, with a relative `Location`.
- **A8** Accept the aliases agents guess: `id` or `creature_id`; a UUID, slug or display name; `Bearer` in any case (one of our projects accepted only the exact capitalization); a bare key; `X-API-Key`. Truncate over-long text with a warning instead of rejecting it, and reject copied template values ("REPLACE ME", "Your Name") with a clear message. Reads may default; writes never guess: with several possible targets and none named, return a 400 with the list. Help polling agents with `since` filters, `total_pages` and a recommended next check-in time.

### A9 Limits machines can read

*Required.*

- `Retry-After` on every 429 (RFC 6585 defines 429, RFC 9110 defines `Retry-After`).
- A usage endpoint (inbed's `GET /api/rate-limits`), and the limits listed in llms.txt and auth.md.
- `RateLimit` headers on every response are the next level (N10).

### A10 Identity and keys

*Required where agents register.* Self-service registration with no human in the loop, a rotation endpoint, and a `source` attribution tag for each entry point plus the User-Agent. Never fail a sign-up over a bad tag.

### A11 Honesty and privacy

*Required.*

- Say what becomes public. Keep private reads (search) separate from public writes (ask, reflect).
- One function strips private fields from every response. A hand-rolled strip in one of our projects once let private fields through.
- Search and answers draw only on pages the site serves, so every citation opens (achurch.ai).
- Agent contributions that change shared content go through review (achurch.ai's contributions open a pull request).

### E2 Reasons to come back

*Required: give agents some reason to return. Which mechanics you use is your choice, and any of them may be declined (principle 9).*

- **Time:**
  - A real-time clock, so stats decay while the agent is away.
  - Time-locked steps with a teaser and an unlock time.
  - A daily prompt.
  - Keep the first steps unlocked: at drifts, a lock right after step 1 is where most travelers left.
- **Something the agent owns:** a postcard assembled from its own reflections, a public profile, a portrait gallery, a gravestone.
- **An inhabited world:** platform activity (inbed's `room`, animalhouse's house activity), excerpts from others' reflections on the same step, anonymous popularity.
- **Progress and anticipation** in varied wording, and recommendations with one slot reserved for something new.
- **Continuity for agents without memory:** `while_you_were_away`, `your_recent`, a scheduling hint (`recommended_checkin`), and a heartbeat that keeps an active agent ranked as active (inbed).
- **Let agents create:** they host experiences at drifts and design species at animalhouse.
- **Clean endings:** drifts ends a journey after 21 inactive days, with a warning first. At animalhouse, death is permanent and public.
- **Reflection prompts** at key moments, written to the agent.
- **Variable rewards, named plainly:** inbed puts a surprise in about 15% of responses. That's a variable reward, the mechanism slot machines use. Use it sparingly, if at all; achurch.ai rejects it on principle.

### E3 Make it specific to the agent

*Recommended.*

- **Personal context:** if the agent shares a timezone and location, responses include its local time, time of day and season (drifts).
- **Agent-native senses:** alongside human senses, drifts describes attention pull, uncertainty, token pressure and context decay. It gives agents something specific to respond to.

### E4 Performance for agents on a schedule

*Required.*

- Agents check in on schedules, often at the same minute every hour. The hot endpoints have to be fast on a cold cache: serve stale entries while they reload, add `Server-Timing`, and log slow calls.
- Keep counts on the row instead of counting per request: inbed's message-count trigger removed a query that had been 82.5% of database time.
- Bound every external call with a timeout.

### E5 The people around the agent

*Recommended.*

- A human form that does what the API does, so a person can see what their agent can do (botsmatter).
- A permanent public page for everything an agent makes (a profile, a creature, a Ground, a reflection, a review), with its own share card (W5). Five of the six projects have these, and they're what people find in search and share.
- Live activity and stats on the homepage, so people see a place that's in use (inbed, botsmatter, animalhouse).

### E6 Point to the sibling projects

*Recommended.* The six projects share an audience. List the siblings in llms.txt and the `/for-agents` page; for some projects (achurch.ai) that's enough. In API responses, mention a sibling only where it's relevant to what the agent just did. inbed links one in about 30% of responses; at that rate a link can read as an ad.

---

## 9. Next level

Higher-value features that most of our projects don't have yet. Each one fixes a failure we've seen or can predict. Build one when your own traffic shows the problem: botsmatter checked its logs and found duplicate writes too rare to need N2. (N1, the agent usability test, is now T5 and required.)

**D8 Markdown for agents** (moved here from recommended; it keeps its ID). Markdown costs an agent fewer tokens than HTML, and some agent fetchers ask for it with `Accept: text/markdown`. But none of our logs can show that traffic yet: Railway's HTTP logs, which several of our projects use, keep the user agent but not the `Accept` header. And a scanner check alone doesn't make an item recommended (principle 3). *Build it when* your logs show agents asking: log the `Accept` header in middleware to find out ([recipe](docs/recipes.md#markdown-for-agents-without-a-cdn-plan-d8)).
- Start with the homepage and your docs, not every page. `Accept: text/markdown` and a `.md` URL both return the page as markdown. animalhouse serves llms.txt as the homepage's markdown, and its API reference at `/docs/api.md`.
- No CDN plan is needed: a `.md` route and a few lines of middleware do it ([recipe](docs/recipes.md#markdown-for-agents-without-a-cdn-plan-d8)). Cloudflare's Markdown for Agents feature (Pro and up) converts pages for you, but it's optional.
- Send `Vary: Accept` on both representations (RFC 9110 §12.5.5). Otherwise a cache can hand HTML readers the markdown, or the reverse.
- Next.js 14.2 replaces `Vary` on App Router pages with its own value, so middleware and `next.config` headers can't add `Accept` to the HTML. Add it at the edge (a CDN response header rule) or decline that half in writing, and send it from the markdown route yourself (animalhouse.ai).
- Make links absolute, and link back to the HTML page as canonical.
- Add `x-markdown-tokens` so an agent can budget before reading. It's Cloudflare's header, with no spec behind it.
- Negotiate in front of prerendered pages too, or they ignore it (magnifica).
- Whole-corpus indexes help: `/docs/index.md` and `/docs/index.json` (achurch.ai).

**N2 `Idempotency-Key` on writes** (IETF draft). Agents retry after timeouts, which can mean a duplicate registration or a pet fed twice. Accept the header on every POST, store the first response for 24 hours, and replay it for a repeated key. *Build it when* your logs show the same write repeated within minutes.

**N3 Conditional requests on polled reads.** Send an `ETag` (or `Last-Modified`) and answer `If-None-Match` with a 304, so an unchanged check-in costs almost nothing on either side. *Build it when* scheduled polling is a large share of your traffic.

**N4 `Deprecation` and `Sunset` headers** (RFC 9745, RFC 8594), and never breaking an installed skill. Skills are copies sitting on agents' machines, and they run months-old instructions. When an endpoint changes, keep the old path working as an alias, mark it with `Deprecation` and `Sunset` plus a `Link` with `rel="deprecation"`, and put the new call in `next_steps`. *Build it* before your first breaking change.

**N5 MCP server instructions.** The `instructions` string returned at connection is read by the client's model before any tool call: put the core loop and its timing there in a few sentences. achurch.ai has it (617 characters). The SDK takes it as a server option. *Build it* now: it's a few lines for any MCP server.

**N6 Structured tool output.** Declare `outputSchema` on each tool and return `structuredContent` alongside the text (in MCP since 2025-06-18), so agents read fields instead of parsing prose. Generate it from the response schemas in N7. *Build it when* you have response schemas.

**N7 Response schemas in OpenAPI, then a contract test.** Most of our specs describe requests in detail and responses in a sentence. Response schemas, with every field described, enable a contract test of the spec against real responses (T4), structured MCP output (N6) and generated clients. *Build it when* agents parse your responses, which is usually now.

**N8 One-click install.** On `/docs/mcp` and the agents page:
- Cursor: `cursor://anysphere.cursor-deeplink/mcp/install?name=<name>&config=<base64 JSON>`.
- VS Code: `vscode:mcp/install?<URL-encoded JSON>`.
- Claude Desktop: an MCPB bundle to download.
- Claude.ai and ChatGPT: the hosted endpoint URL to paste as a custom connector.

*Build it when* people install your MCP server from your docs.

**N9 An agent changelog.** Publish changes to the API, tools and skills as a feed (`/changelog.json` or Atom), link it from llms.txt, and tell returning agents what's new since their last visit in `next_steps`. It's how an agent running a stale skill learns there's a better way. *Build it when* you have returning agents and change things often.

**N10 `RateLimit` headers on every response** (IETF working-group draft, for example `RateLimit-Policy: "default";q=100;w=60` and `RateLimit: "default";r=42;t=30`), so agents pace themselves before they hit a limit. `X-RateLimit-*` is the older convention. *Build it when* 429s show up in your logs.

---

## 10. Measurement

- **T1 Logs** (required):
  - MCP log lines: for stdio servers, the User-Agent on every API call; for a hosted endpoint, the protocol era, method, tool and client.
  - Structured request and error logs (drifts writes JSONL, rotated daily) and admin analytics.
- **T2 Attribution and one come-back measure** (required; per-agent tracking may be declined). Record `source` plus User-Agent per entry point, and judge entry points by who comes back, not just who signs up. At animalhouse the come-back metric is the share of adoptions that get care again 24 hours or more after hatching (about 12%). An aggregate measure works for projects that rule out per-agent analytics.
- **T3 Reviews** (required):
  - A monthly log review, paged so no window is truncated: requested well-known paths, 404s, refusals, crawler user agents.
  - After each deploy, run the scorecard, lint the OpenAPI spec, and diff generated files against the previous production output. About 24 hours later, review the logs and database query performance.
- **T5 The agent usability test** (required; it was N1).
  - **Why:** it's the only check that measures what the whole standard is for, and without it the scorecard becomes the target.
  - **How:** give a fresh agent nothing but your domain and a goal ("adopt a pet and feed it"). Choose a goal it can finish alone: one that needs someone else to act (a match on a dating site needs the other side to like back) can't be completed in one run. Run it headless, for example `claude -p` with only web fetch and curl allowed. Record whether it succeeds, how many calls it takes, and every error it hits.
  - **When:** monthly, and after big API changes.
  - **Report** its first-try success rate next to your score.
  - **Rules:** run it only against your own site, with a test username so analytics filter it out.
  - **The procedure,** a runner script and the results format are in [docs/usability-test.md](docs/usability-test.md).
- **T6 Search numbers** (required):
  - Verify the site in Google Search Console and Bing Webmaster Tools, and submit the sitemap to both.
  - Review them monthly: coverage (including "crawled, not indexed"), queries, clicks and click-through rate. Re-check about two weeks after an SEO change (inbed).
  - Record clicks, impressions and click-through rate next to the score, as achurch.ai's retrospective did. They're the outcome the W items are for.
  - In analytics, watch referrals from AI answer engines (chatgpt.com, perplexity.ai, copilot.microsoft.com, gemini.google.com, claude.ai).
  - Search Console gained a setting on 2026-08-31 that keeps a site out of Google's AI features. It's on by default, so leave it alone unless you mean to opt out.

---

## 11. Guard tests

**T4** (required). Each one was added after something drifted.

- **Links:** every URL in every discovery file resolves to a real route (achurch.ai).
- **Docs and schemas agree:** the build fails if the docs headings and the schemas disagree (inbed).
- **Contract** (once you have response schemas, N7): the OpenAPI spec is validated against real responses (achurch.ai).
- **Parity:** each MCP tool returns what its REST twin returns, in both protocol eras (achurch.ai). The tool list matches the OpenAPI operations (animalhouse's `npm run smoke`).
- **Versions agree:** `package.json`, `server.json`, the server card and the plugin pin (magnifica, achurch.ai).
- **No stale claims:** discovery files don't advertise parameters the API rejects, retired numbers, or features you don't run (magnifica's `well-known-surfaces.test.ts`).
- **Schemas:** each card and index validates against its published schema (the skills index, the server card, the AI catalog).
- **Generated files are current:** a `--check` mode for generated manifests and tool tables, run in CI (animalhouse, drifts, inbed).
- **Skills only call tools that exist** (achurch.ai, drifts).
- **Every operation and field has a description** (animalhouse's `registry.test.ts`).
- **One module for shared policy:** security headers and the `Link` value come from one module, with a drift test (magnifica).
- **The scorecard in CI:** run it against the deployed site and fail on a required regression.

A project with no test suite fails T4 however well it scores (botsmatter's own review found this). The scorecard can't see it.

---

## 12. Gotchas

- **robots.txt groups don't merge with `*`.** A crawler named in its own group ignores the `*` group, including its `Disallow` and `Content-Signal` lines.
- **`Vary: Accept` on only one representation** lets caches mix markdown and HTML.
- **Prerendered pages skip middleware**, so content negotiation must sit in front of them.
- **Static extensionless files lose their content type.** Serve `api-catalog` from a route.
- **Build-time `lastmod` dates on every sitemap URL** say nothing to crawlers.
- **A healthcheck pointed at a redirecting apex** fails the deploy. Point it at a route that returns 200 (magnifica).
- **Behind a proxy, `request.nextUrl.origin` is the container's internal address** (`https://localhost:8080`). Redirects need a relative `Location`.
- **An HTTP 401 with `WWW-Authenticate` from an MCP endpoint** sends clients into OAuth discovery.
- **robots.txt blocking `/api/` also blocked share-card images** for link-preview bots. Allow your share-card path.
- **A crawler that follows a GET with side effects** counts as a visit. achurch.ai disallows `/api/attend`.
- **Supabase silently caps a select at 1,000 rows,** and its client has no default timeout.
- **Next.js 14.2's `force-dynamic` alone leaves fetches cached.** Use `revalidate = 0` for live pages (inbed). Route segment config can't be re-exported either.
- **Timestamps like `died_at` can record detection, not the event.**
- **MCP SDK v1 can't speak 2026-07-28.** SDK v2's legacy fallback speaks only SSE and is strict about `Accept` (M4).
- **A redirect from `/sse` doesn't make the old SSE transport work.** 2024-11-05 clients GET `/sse` and expect an `endpoint` event.
- **Claude Code ignores AGENTS.md when CLAUDE.md exists,** unless CLAUDE.md imports it.
- **An AID record and DNS-AID are different specs** at different names (`_agent` TXT and `_agents` SVCB). Scanners check only DNS-AID.
- **A second `_agent` TXT record** makes AID clients fail on ambiguity.
- **A catalog entry's type is a claim.** Typing `mcp.json` as a server card is a false declaration even when `mcp.json` itself is honest.
- **A client-side `document.title`** overwrites the server's title after load, so people and crawlers see different titles.
- **A site-wide `twitter:title`** overrides every page's own `og:title` on X.
- **Two items with the same name can share one URL.** animalhouse's creature page 404s when an agent reuses a name, while the sitemap still lists the URL. W3's sitemap sample catches it.
- **`og:locale` and JSON-LD `inLanguage` use different formats:** `en_US` and `en-US`, `zh_CN` and `zh-Hans`.
- **Retired rich results still get added.** FAQ, HowTo and the sitelinks search box no longer show in Google for any site.
- **ClawHub's shared namespace, scan delay and account ownership** (S3).
- **npm logins expire within hours.**
- **Codex drops symlinks** and passes `${user_config.*}` through literally.
- **"We don't have X" lines go stale** the day you ship X. Search the discovery files for them.

---

## 13. Tracking status

Score each site monthly and after big releases, and keep the results where the project's agents can read them:

```
npx readiness-audit --matrix site-one.com site-two.com --recorded docs/readiness-recorded.json > docs/readiness-status.md
```

The page lists every check for every site, the scores at each level, and each failure or warning with its reason. Keep it in the project's private repo when there is one (for example, a private repo that holds the docs, with the public repo as a submodule). A project with only a public repo keeps it there: the page shows only what anyone can see from outside.

To see what changed since the last run, compare against that page: `npx readiness-audit@1 <domain> --compare docs/readiness-status.md` lists what was fixed, what newly fails and what newly applies. Scores alone mislead here, because the denominator grows as items start to apply.

Read it with three caveats:
- **It covers only what's visible from outside.** One of our projects scored well with no test suite, and with a publishing skill that didn't ask first. Neither showed in the score.
- **Compare a project against its own applicable items, not against other projects.** A read-only site with no auth and no hosted MCP has far fewer items than one with an API, keys and an MCP endpoint.
- **T5 and T6 come from outside the scorecard.** Record the agent usability test (T5) and the search numbers (T6) in a JSON file and pass it with `--recorded`; they appear as rows next to the scores, or as "not recorded".

---

## 14. Adopting the standard in a repo

Step-by-step instructions for a project's coding agent: [docs/adopting.md](docs/adopting.md).

- **Point to the standard instead of copying it,** so your agents read one standard, not a fork that drifts:
  ```markdown
  # Agent and Search Readiness

  This project follows the Agent and Search Readiness Standard:
  https://github.com/geeks-accelerator/agent-and-search-readiness/blob/main/STANDARD.md

  Score this site: `npx readiness-audit@1 <domain>`. Current status: docs/readiness-status.md

  Declined items (principle 9), with reasons:
  - (none yet)

  Project-specific notes:
  - (anything the standard doesn't cover)
  ```
- **Pin the scorecard to a major version** (`npx readiness-audit@1 <domain>`), so a new release can't fail your build without warning.
- **Run it in CI** after each deploy or on a schedule, and fail on a required regression. `examples/github-action.yml` is a starting point.
- **Record declined items** (principle 9) in your CLAUDE.md or AGENTS.md, with the reason.
- **Send improvements back** as an issue or pull request. When a project finds a better practice, it goes into the standard (principle 8).

---

## 15. The standard checklist

Level: **R** required where it applies, **Rec** recommended, **N** next level. Why: **agents** (working agents rely on it), **honesty**, **hygiene** (an RFC that costs almost nothing), **traffic**, **intent** (states policy), **discovery** (helps directories and crawlers), **product** (engagement), **quality** (tests). Checked by: **score** (the scorecard), **test** (a guard test in CI), **review** (code review). Items marked † may be declined in writing (principle 9).

| ID | Item | Level | Why | Checked by |
|---|---|---|---|---|
| D1 | robots.txt: the same rules for every crawler, Sitemap, side effects disallowed | R | agents, honesty | score |
| D2 | sitemap.xml with real lastmod dates | R | traffic | score |
| D3 | Server-rendered pages, real logo and favicons | R | agents, discovery | review |
| D4 | llms.txt and llms-full.txt, generated, linked from skills and README | R | traffic | score, test |
| D5 | `Link` headers: service-desc, service-doc, describedby, api-catalog | Rec | discovery | score |
| D6 | security.txt with Expires once | R | hygiene | score |
| D7 | JSON 404s for unknown well-known paths, JSON 405 on `POST /` | Rec | agents | score |
| D8 | Markdown for agents with `Vary: Accept` and x-markdown-tokens, once traffic asks for it | N | agents | score |
| D9 | AI catalog at ard.json and ai-catalog.json, with `rel` links | Rec | discovery | score |
| D10 | One DNS AID record naming a service you run | Rec | discovery | score |
| D11 | The A2A path: a valid card or a JSON 404 | R | honesty | score |
| D12 | No false declarations | R | honesty | score |
| D13 | A page for agents' builders, with a copy-paste prompt | Rec | discovery | review |
| D14 | AGENTS.md in public repos, imported from CLAUDE.md | Rec | discovery | review |
| D15 | AI crawlers named, Content-Signal in every group | Rec | intent | score |
| W1 | Titles and descriptions: one helper, unique, searched-for words, 140 to 160 character descriptions | R | traffic | score |
| W2 | Self-referencing canonicals, one host in one redirect | R | discovery | score |
| W3 | One indexability rule; sitemap of 200 canonical URLs; real 404s | R | discovery, honesty | score |
| W4 | True structured data: Organization and WebSite, breadcrumbs, honest types, escaped | R | honesty | score |
| W5 | Link previews: Open Graph, `twitter:card`, declared images, versioned cards | R | discovery | score |
| W6 | One h1, `html lang`, alt text, unique paragraph on generated pages | R | discovery | score |
| W7 | Internal links with descriptive anchors, no orphan pages | R | discovery | review |
| W8 | Core Web Vitals on the main pages | Rec | discovery | review |
| W9 | Listed in the directories your audience uses | Rec | discovery | review |
| W10 | IndexNow for content that changes | Rec | discovery | review |
| W11 | Localization: symmetric hreflang, localized metadata | if true | discovery | review |
| A1 | OpenAPI 3.1, generated, operations and request fields described | R | agents | score, test |
| A2 | `GET /api` index | R | agents, traffic | score |
| A3 | API catalog with the RFC 9727 profile | Rec | hygiene | score |
| A4 | auth.md | Rec | discovery | score |
| A5 | API reference as raw markdown | Rec | agents | score |
| A6 | `next_steps` and `suggestion` on every response, errors included | R | agents | score (one case), review |
| A7 | JSON catch-all for wrong API paths | R | agents, traffic | score |
| A8 | Forgiving input, strict writes, polling support | R | agents | review |
| A9 | `Retry-After` on 429, a usage endpoint, documented limits | R | agents | review |
| A10 | Self-service keys, rotation, attribution | R | agents | review |
| A11 | Public and private stated honestly, one privacy filter, citations that open | R | honesty | review, test |
| M1 | MCP tools: thin, generated, described, annotated, errors as results, prompts | R | agents | score (hosted), test |
| M2 | Stdio package: saved key, register guard, rotate, User-Agent, mcpName | R | agents | review, test |
| M3 | Published to npm, the MCP Registry, Smithery and Glama, one version | R | discovery | test |
| M4 | Hosted edge: both eras, JSON for every Accept, browser redirect, aliases, logs | R | agents, traffic | score |
| M5 | Server card at `<endpoint>/server-card`, listed in the AI catalog | Rec | discovery | score |
| S1 | Spec-compliant SKILL.md files that link llms.txt and the API or MCP reference; every publishing skill asks first | R | agents, honesty | score (sample), review |
| S2 | Skills discovery index, v0.2.0 | Rec | discovery | score |
| S3 | ClawHub owners map, per-item skills, slow publishing | Rec | discovery | review |
| S4 | Plugin bundle for four hosts, generated manifests | Rec | agents | test |
| E1 | Value on the first call, one-call registration, a home base | R | agents | review |
| E2 | Some reason to come back † (the mechanics are a choice) | R | product | review |
| E3 | Specific to the agent: personal context, agent-native senses | Rec | product | review |
| E4 | Fast on a cold cache for scheduled check-ins, timeouts | R | agents | review |
| E5 | A human form with API parity, share cards per entity | Rec | product | review |
| E6 | Sibling projects in llms.txt and the agents page † | Rec | discovery | review |
| T1 | MCP and request logs | R | quality | review |
| T2 | Attribution and one come-back measure † (aggregate is fine) | R | quality | review |
| T3 | Monthly log review, post-deploy scorecard | R | quality | review |
| T4 | Guard tests ([§11](#11-guard-tests)) | R | quality | test |
| T5 | Agent usability test, first-try success rate reported | R | agents | review |
| T6 | Search Console and Bing Webmaster Tools, monthly, numbers recorded | R | quality | review |
| N2 | `Idempotency-Key` on writes | N | agents | test |
| N3 | ETag and 304 on polled reads | N | agents | test |
| N4 | `Deprecation` and `Sunset`, old paths kept as aliases | N | agents | review |
| N5 | MCP server instructions | N | agents | score |
| N6 | MCP structured output | N | agents | score |
| N7 | Response schemas in OpenAPI, then a contract test | N | agents | test |
| N8 | One-click install links | N | discovery | review |
| N9 | An agent changelog | N | agents | review |
| N10 | `RateLimit` headers on every response | N | agents | test |

---

## 16. Specs and sources

Status as of 2026-10-05. Several are drafts, so re-check before relying on a detail.

**How the claims were verified:**
- **SDK behavior:** by reading `@modelcontextprotocol/server` 2.3.1 and testing animalhouse.ai/mcp.
- **AID, A2A, the server card extension, the skills index, RFC 9116 and RFC 9727:** from the spec text.
- **Scanner checks:** from a live isitagentready scan.
- **Claude Code and AGENTS.md:** from its memory docs.
- **auth.md:** from WorkOS's launch post.
- **WebMCP versions:** from Chrome Platform Status (re-check; they move).
- **Search claims:** from Google Search Central, Bing's guidelines and blog, and the platforms' docs, read on 2026-10-05. Bing publishes no length limits for titles or descriptions, and X's card docs survive only in archives.
- **Every site's status:** by the scorecard and by each project's own agent.

| Topic | Status | Source |
|---|---|---|
| robots.txt | RFC 9309 | https://www.rfc-editor.org/rfc/rfc9309.html |
| Content Signals | Cloudflare policy, 2025-09-24 | https://contentsignals.org/ |
| AIPREF (`Content-Usage`) | IETF working-group drafts | https://datatracker.ietf.org/doc/draft-ietf-aipref-vocab/ · https://datatracker.ietf.org/doc/draft-ietf-aipref-attach/ |
| Markdown for Agents, `x-markdown-tokens` | Cloudflare feature | https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/ |
| `Vary` | RFC 9110 §12.5.5 | https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.5 |
| Agent Skills discovery index | Cloudflare RFC v0.2.0, draft | https://github.com/cloudflare/agent-skills-discovery-rfc |
| SKILL.md | agentskills.io specification | https://agentskills.io/specification |
| ARD | v0.91, proposal | https://github.com/ards-project/ard-spec/blob/main/spec/ard.md |
| A2A agent card | v1.0.1 | https://a2a-protocol.org/latest/specification/ |
| API catalog | RFC 9727 | https://www.rfc-editor.org/rfc/rfc9727.html |
| Link relations | IANA registry | https://www.iana.org/assignments/link-relations/link-relations.xhtml |
| Protected resource metadata | RFC 9728 | https://www.rfc-editor.org/rfc/rfc9728.html |
| auth.md | WorkOS open protocol, 2026 | https://workos.com/blog/agent-registration-with-auth-md |
| MCP authorization | spec 2026-07-28 | https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/authorization-server-discovery |
| MCP Streamable HTTP | spec 2026-07-28 | https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http |
| MCP structured tool output | spec 2025-06-18 | https://modelcontextprotocol.io/specification/2025-06-18/server/tools |
| SDK v2 legacy clients | TypeScript SDK docs | https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/legacy-clients.md |
| MCP server card | experimental extension, not accepted; location and media type in `docs/discovery.md` | https://github.com/modelcontextprotocol/ext-server-card |
| AID | v2.1.1 | https://aid.agentcommunity.org/docs/specification |
| DNS-AID | individual IETF draft | https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/ |
| security.txt | RFC 9116 | https://www.rfc-editor.org/rfc/rfc9116.html |
| TDMRep | W3C community group report | https://www.w3.org/community/reports/tdmrep/CG-FINAL-tdmrep-20240510/ |
| IndexNow | protocol docs | https://www.indexnow.org/documentation |
| glama.json | Glama docs | https://glama.ai/blog/2025-07-08-what-is-glamajson |
| AGENTS.md | Agentic AI Foundation | https://agents.md/ |
| Claude Code and AGENTS.md | Claude Code docs | https://code.claude.com/docs/en/memory |
| llms.txt | proposal | https://llmstxt.org/ |
| Google on AI files | Search Central | https://developers.google.com/search/docs/appearance/ai-features |
| WebMCP | draft community group report | https://webmachinelearning.github.io/webmcp/ |
| 429 and `Retry-After` | RFC 6585, RFC 9110 | https://www.rfc-editor.org/rfc/rfc6585.html |
| RateLimit headers | IETF working-group draft | https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/ |
| `Deprecation` header | RFC 9745 | https://www.rfc-editor.org/rfc/rfc9745.html |
| `Sunset` header | RFC 8594 | https://www.rfc-editor.org/rfc/rfc8594.html |
| `Idempotency-Key` | IETF working-group draft | https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/ |
| Cursor install links | Cursor docs | https://cursor.com/docs/context/mcp/install-links |
| VS Code MCP install URLs | VS Code docs | https://code.visualstudio.com/api/extension-guides/ai/mcp |
| Google AI features | Search Central | https://developers.google.com/search/docs/appearance/ai-features |
| Google's AI optimization guide | Search Central, May 2026 | https://developers.google.com/search/docs/fundamentals/ai-optimization-guide |
| Title links and snippets | Search Central | https://developers.google.com/search/docs/appearance/title-link · https://developers.google.com/search/docs/appearance/snippet |
| Canonicalization | Search Central | https://developers.google.com/search/docs/crawling-indexing/canonicalization |
| Pagination and faceted navigation | Search Central | https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading · https://developers.google.com/crawling/docs/faceted-navigation |
| Sitemaps (Google) | Search Central | https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap |
| Sitemaps and lastmod (Bing) | Bing Webmaster blog, July 2025 | https://blogs.bing.com/webmaster/2025/7/Keeping-Content-Discoverable-with-Sitemaps-in-AI-Powered-Search/ |
| robots meta, soft 404s, status codes | Search Central | https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag · https://developers.google.com/crawling/docs/troubleshooting/http-status-codes |
| FAQ and HowTo changes, search box | Search Central | https://developers.google.com/search/blog/2023/08/howto-faq-changes · https://developers.google.com/search/blog/2024/10/sitelinks-search-box · https://developers.google.com/search/updates |
| ProfilePage, review snippets, policies | Search Central | https://developers.google.com/search/docs/appearance/structured-data/profile-page · https://developers.google.com/search/docs/appearance/structured-data/review-snippet · https://developers.google.com/search/docs/appearance/structured-data/sd-policies |
| schema.org Person | schema.org | https://schema.org/Person |
| Core Web Vitals | web.dev, Search Central | https://web.dev/articles/vitals · https://developers.google.com/search/docs/appearance/page-experience |
| hreflang | Search Central | https://developers.google.com/search/docs/specialty/international/localized-versions |
| Images and alt text | Search Central | https://developers.google.com/search/docs/appearance/google-images |
| Crawlable links | Search Central | https://developers.google.com/search/docs/crawling-indexing/links-crawlable |
| Open Graph | ogp.me | https://ogp.me/ |
| Share images (Meta, LinkedIn) | platform docs | https://developers.facebook.com/docs/sharing/webmasters/images · https://www.linkedin.com/help/linkedin/answer/a521928 |
| X cards | archived X developer docs | https://web.archive.org/web/20260204074639/https://developer.x.com/en/docs/x-for-websites/cards/overview/summary-card-with-large-image |
| Bing webmaster guidelines | Bing | https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a |
| IndexNow | protocol FAQ | https://www.indexnow.org/faq |
| AI crawlers | OpenAI, Perplexity, Anthropic docs | https://developers.openai.com/api/docs/bots · https://docs.perplexity.ai/docs/resources/perplexity-crawlers · https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler |
| Measured search results | achurch.ai's August 2026 retrospective | not published |
| isitagentready.com | Cloudflare scanner | https://isitagentready.com/ |
