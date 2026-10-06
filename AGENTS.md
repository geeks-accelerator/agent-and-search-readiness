# Working on agent-and-search-readiness

This repo publishes the Agent and Search Readiness Standard (STANDARD.md) and its scorecard, the `readiness-audit` CLI on npm.

## Layout

- `STANDARD.md`: the standard. Every item has an ID (D, W, A, M, S, E, T, N plus a number), a level, and a row in the checklist (§15).
- `src/audit.mjs`: the checks, as a library (`audit`, `score`, `matrix`).
- `src/helpers.mjs`: pure helpers the checks share, tested without a network. Internal: the package exports only `src/audit.mjs`.
- `bin/readiness-audit.mjs`: the command-line tool.
- `test/`: guard tests. `npm test` runs them.
- `docs/adopting.md`: the switch-over steps a project's agent follows. `docs/usability-test.md`: the T5 procedure.

## Rules

- **No dependencies.** Node 20 or later, built-ins only.
- **Read-only.** A check may GET anything and may POST only requests that create nothing on the audited site (an MCP initialize, server/discover, tools/list, an empty POST to `/`). Never register, write or log in.
- **Every check has an ID that exists in the STANDARD.md checklist.** The tests fail otherwise. A new check needs its item described in STANDARD.md first.
- **An item belongs in the standard when most projects should do it,** and its level has a stated reason: working agents rely on it, it keeps declarations true, or it's baseline hygiene. A practice from one project goes in "Considered and left out", with the reason.
- **Claims cite primary sources** (specs, official docs) in §16, with a date. Mark drafts as drafts.
- **Examples get copied.** Agents adopting the standard turn its examples into their projects' skills, copy and tests. A rule's example is generic or a `[placeholder]`; a project's name appears only with its evidence ("at animalhouse, ..."). Keep concrete values for real formats (headers, paths, schemas) and for dated evidence. For any other example, ask whether removing it loses information or only concreteness.
- **Every restriction names the harm it prevents** (principle 10). A restriction added because it feels safe spreads to every project that copies the wording.
- **Describe the current rule.** How a rule changed goes in CHANGELOG.md and the commit message. Naming a removed rule in the standard or the docs brings it back.
- **Writing:** plain, direct sentences. No em dashes.

## Releasing

1. Change `version` in `package.json` and `VERSION` in `src/audit.mjs` together (a test checks they match).
2. Add a CHANGELOG entry. A new required check, or a check that can newly fail, is a major version: projects pin `readiness-audit@1`, and a new failure shouldn't reach them unannounced. A new warning is a minor version: it doesn't change the exit code, but it can lower a score, so the changelog says so.
3. `npm test`, then run the CLI against two or three real sites and read the output.
4. Commit, push, and publish a GitHub release tagged `v<version>`. The Release workflow checks the tag against package.json, runs the tests, and publishes to npm through trusted publishing (no token).

The very first publish has to be manual (`npm whoami`, then `npm publish --access public`), because npm's trusted publisher is set on the package's settings page, which exists only after the first publish. Then add the trusted publisher on npmjs.com: repository geeks-accelerator/agent-and-search-readiness, workflow `release.yml`.
