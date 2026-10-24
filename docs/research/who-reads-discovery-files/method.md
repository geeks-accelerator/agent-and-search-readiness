# Method: who requests agent discovery files

The queries and the classifier behind [the paper](../who-reads-discovery-files.md), so the numbers can be checked and the study repeated on any Cloudflare zone, Free plan included. Version 1, 2026-10-24.

## Access

Cloudflare's GraphQL Analytics API, `https://api.cloudflare.com/client/v4/graphql` with an API token (Account Analytics: Read), or `/api/v4/graphql` from a signed-in dashboard session, which is how this study read it. Every query is read-only.

On the Free plan (checked 2026-10-24 on these zones), `httpRequestsAdaptiveGroups` allowed a 30-day span per query, data 31 days back, and 10,000 rows per query. It exposes `clientRequestPath`, `userAgent`, `verifiedBotCategory`, `edgeResponseStatus`, `edgeResponseContentTypeName`, `clientIP` and `clientRequestHTTPHost`, among others; it refuses `clientRequestAcceptContentTypes` and the other `Accept` fields, and has no bot score.

## Window

`datetime_geq: "2026-10-17T00:00:00Z"`, `datetime_lt: "2026-10-24T00:00:00Z"`, for each of the account's 56 zones.

## Queries

All use the same shape, with `$z` the zone ID and `$f` the filter:

```graphql
query($z: string, $f: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject) {
  viewer { zones(filter: { zoneTag: $z }) {
    httpRequestsAdaptiveGroups(limit: LIMIT, orderBy: [count_DESC], filter: $f) {
      count
      dimensions { DIMENSIONS }
    }
  } }
}
```

| Query | Dimensions | Filter (besides the window) | Limit |
|---|---|---|---|
| Totals | `verifiedBotCategory` | none | 100 |
| Discovery requests | `clientRequestPath userAgent verifiedBotCategory edgeResponseStatus edgeResponseContentTypeName` | `OR` of: `clientRequestPath` equal to each of `/llms.txt`, `/llms-full.txt`, `/robots.txt`, `/sitemap.xml`, `/openapi.json`, `/api`, `/mcp`, `/auth.md`, `/docs/api.md`, `/agents.json`, `/ai-plugin.json`, `/sse`, `/api/mcp`; `clientRequestPath_like` `/.well-known/%`, `%.md`, `/mcp/%` | 10,000 |
| Markdown responses | `clientRequestPath userAgent verifiedBotCategory` | `edgeResponseContentTypeName: "md"` | 2,000 |
| Readers, for overlap | `clientIP clientRequestPath userAgent` | `OR` of `clientRequestPath` equal to `/llms.txt`, `/llms-full.txt`, `/openapi.json`, `/.well-known/agent-card.json`, `/docs/api.md`, `/.well-known/agent-skills/index.json`, `/.well-known/mcp/server-card.json`, `/mcp/server-card`, `/auth.md` | 10,000 |
| Successful calls, for overlap | `clientIP userAgent` | `edgeResponseStatus_geq: 200`, `edgeResponseStatus_lt: 300`, `OR` of `clientRequestPath_like: "/api/%"` and `clientRequestPath: "/mcp"` | 10,000 |

No query returned its row limit. ACME challenge paths (`/.well-known/acme-challenge/...`) were dropped from the discovery rows.

## Exclusions

Rows whose user agent matches `/readiness-audit|security-pranks-audit/i` (this project's audit and its sister's) were removed from every count except the week's total: 3,564 requests. For the overlap, rows matching the audit-tool pattern below were removed from both sides too.

## Reader classes

Each request falls in exactly one class, checked in this order:

| Class | Rule |
|---|---|
| Legacy AI categories (`verifiedAI`) | `verifiedBotCategory` is `AI Crawler`, `AI Search` or `AI Assistant` |
| Other verified bots (`verifiedOther`) | any other non-empty `verifiedBotCategory` |
| Crawler names, not verified (`namedUnverified`) | no verified category, and the user agent matches `/gptbot\|oai-searchbot\|chatgpt-user\|claudebot\|claude-user\|claude-searchbot\|perplexitybot\|perplexity-user\|google-extended\|applebot-extended\|meta-webindexer\|meta-externalagent\|bytespider\|ccbot\|amazonbot\|deepseekbot\|grokbot\|kimibot\|duckassistbot\|mistralai-user\|exasearchbot\|cohere-ai\|qwen\|chatglm\|hunyuan\|youbot\|diffbot\|petalbot\|googlebot\|bingbot\|applebot\|duckduckbot\|yandexbot\|baiduspider/i` |
| Directories (`directories`) | `/agenstrybot\|brickbluebot\|mcpharbor\|agenttrustbot\|taifoonharvester\|mcphub-probe\|invokerankbot\|proofbench\|thepluginstorebot\|protogrid-probe\|glidemcpindex\|smithery\|glama\|pulsemcp\|mcp\.so\|llms\.?txt\|mcpbeat\|rokmcp\|agentrank\|clono\|mcp-health/i` |
| Other audit tools (`auditTools`) | `/isitagentready\|agentprobe\|agent-tools\.cloud\|lumar\|ahrefs\|semrush\|screaming frog\|sitebulb\|seojuice/i` |
| Scripts (`scripts`) | `/^(curl\|wget\|python\|node\|undici\|axios\|go-http\|okhttp\|java\/\|deno\|bun\/)\|claude-code\|cursor\|opencode\|codex/i` |
| Browser user agents (`browsers`) | starts with `Mozilla/` and contains none of `bot`, `crawl`, `spider` |
| Other | everything else, empty user agents included |

These are user-agent patterns, not identities: only the two verified classes rest on more than the name a client sends. A browser user agent can be a person, an agent tool (several send a browser's), or a scanner pretending.

## Derived measures

- **Sites asked, sites serving:** zones with any row for the path; zones where some row for it had a 2xx status.
- **Markdown by negotiation:** markdown-response rows whose path ends in neither `.md` nor `.txt`.
- **Same-week address overlap:** on each zone with at least one successful call (16 zones), the set of reader addresses per file, intersected with the set of addresses with a successful call, both without audit tools; set sizes summed across zones. All address comparisons ran in the dashboard page; addresses were never written down.

## Repeating it

Change the window, run the same queries per zone, and apply the same classes. Two things to add next time: Cloudflare's confidence fields on adaptive counts, for the small numbers, and a second window that doesn't overlap the sister study's.
