# Changelog

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
