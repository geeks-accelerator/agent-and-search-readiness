# Contributing

The standard gets better when a project finds a better practice and sends it back. Issues and pull requests are welcome.

## What belongs in the standard

- **Most projects should do it.** A practice that suits one or two projects goes in a "Considered and left out" list, with the reason.
- **Its level has a stated reason:** working agents rely on it, it keeps what a site declares true, or it's baseline hygiene (an RFC-backed file that costs almost nothing). Something only scanners look for is recommended at most.
- **It rests on evidence:** request logs, search numbers, a measured before and after, or a primary source (a spec or official documentation) cited in §16 with a date. Drafts are marked as drafts.

## Changing a check

1. Describe the item in STANDARD.md first: its ID, level, reason and "done when", plus its row in the checklist (§15). The tests fail if the scorecard runs a check the checklist doesn't list.
2. Implement it in `src/audit.mjs`, with any logic worth testing on its own as a pure function in `src/helpers.mjs` (tested in `test/helpers.test.mjs`). Checks stay read-only: GET anything, POST only requests that create nothing. No dependencies.
3. Add or update a test in `test/`, and watch it fail before you make it pass.
4. Run `npm test`, then run the CLI against two or three real sites and read the output for false results.
5. Add a CHANGELOG entry. A new required check, or a stricter one, is a major version, because projects pin `readiness-audit@1`.

## Writing

Plain, direct sentences. Say what to do and why. No em dashes.
