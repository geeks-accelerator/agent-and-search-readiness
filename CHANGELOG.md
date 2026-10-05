# Changelog

## 1.0.0 (2026-10-05)

First public release.

- **The standard (STANDARD.md):** items in eight groups: discovery (D), web search (W), API (A), MCP (M), skills (S), engagement (E), measurement and tests (T), next level (N). Each has an ID, a level (required, recommended, only if true, next level) and the reason for its level.
- **The scorecard (`readiness-audit`):** 32 checks in one read-only pass: 19 required, 11 recommended and 2 next-level. It samples up to 20 sitemap pages for search and up to 5 skill files, prints `--json`, and builds a status page across several sites with `--matrix`, including recorded T5 and T6 results from `--recorded`.
- **Safe to point at any site:** it follows redirects itself and refuses private, local and non-http addresses at every hop, so a site's sitemap, share images, skills, catalog or DNS record can't send it to `localhost` or a cloud metadata address. It keeps to about six requests at a time.
- **The agent usability test (T5):** a procedure, a runner for Claude Code, and a results format (docs/usability-test.md).
- **Repo:** CI on Node 20, 22 and 24; a release workflow that publishes to npm through trusted publishing; contributing and security guides; issue templates.
