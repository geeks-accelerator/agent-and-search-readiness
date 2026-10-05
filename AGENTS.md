# Working on agent-and-search-readiness

This repo publishes the Agent and Search Readiness Standard (STANDARD.md) and its scorecard, the `readiness-audit` CLI on npm.

## Layout

- `STANDARD.md`: the standard. Every item has an ID (D, W, A, M, S, E, T, N plus a number), a level, and a row in the checklist (§15).
- `src/audit.mjs`: the checks, as a library (`audit`, `score`, `matrix`).
- `bin/readiness-audit.mjs`: the command-line tool.
- `test/`: guard tests. `npm test` runs them.

## Rules

- **No dependencies.** Node 18 or later, built-ins only.
- **Read-only.** A check may GET anything and may POST only requests that create nothing on the audited site (an MCP initialize, server/discover, tools/list, an empty POST to `/`). Never register, write or log in.
- **Every check has an ID that exists in the STANDARD.md checklist.** The tests fail otherwise. A new check needs its item described in STANDARD.md first.
- **An item belongs in the standard when most projects should do it,** and its level has a stated reason: working agents rely on it, it keeps declarations true, or it's baseline hygiene. A practice from one project goes in "Considered and left out", with the reason.
- **Claims cite primary sources** (specs, official docs) in §16, with a date. Mark drafts as drafts.
- **Writing:** plain, direct sentences. No em dashes.

## Releasing

1. Change `version` in `package.json` and `VERSION` in `src/audit.mjs` together (a test checks they match).
2. Add a CHANGELOG entry. A new required check, or a check that gets stricter, is a major version: projects pin `readiness-audit@1`, and a new failure shouldn't reach them unannounced.
3. `npm test`, then run the CLI against two or three real sites and read the output.
4. `npm whoami`, then `npm publish`.
