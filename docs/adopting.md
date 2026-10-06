# Adopting the standard: instructions for a project's agent

To switch a project over, give its coding agent one line:

> Adopt the Agent and Search Readiness Standard in this repo by following https://github.com/geeks-accelerator/agent-and-search-readiness/blob/main/docs/adopting.md

Everything below is for that agent. animalhouse.ai switched over first and went from 10 to 19 of 19 required checks; inbed.ai followed. Do the same for your project.

1. **Score the live site:** `npx readiness-audit@1 <your-domain>`. It's read-only; run it only against your own sites. Exit code 1 means a required check failed.

2. **Switch over the docs (one commit):**
   - Replace your repo's old agent-discovery or readiness playbook with the short pointer stub in [STANDARD.md §14](../STANDARD.md#14-adopting-the-standard-in-a-repo). Keep your project-specific notes there, including your T5 goal: the one task a fresh agent should manage on its own (examples in [usability-test.md](usability-test.md#setup)). Choose a goal the agent can finish alone, without another party having to act.
   - Delete any local audit script and old status doc that the scorecard now covers. Keep checks that are truly project-specific as tests.
   - Generate the status page: `npx readiness-audit@1 --matrix <your-domain> > docs/readiness-status.md`. Keep it in the project's private repo when there is one (for example, a private repo that holds the docs, with the public repo as a submodule). A project with only a public repo keeps it there.
   - Add one rule to your CLAUDE.md or AGENTS.md: after changing discovery files, page metadata or the API, run the scorecard and regenerate docs/readiness-status.md.

3. **Fix what it reports,** required checks first, then recommended. STANDARD.md has the guidance for each ID. Three rules:
   - **Only declare what's true (D12).** No A2A card without an A2A endpoint, no OAuth server metadata without an OAuth server, no MCP server card that isn't the v1 schema. Answer with an honest JSON 404 that points to what you do serve.
   - **Decline in writing (principle 9).** If an item doesn't fit your project, list it under "Declined items" in the stub with the reason. Never fake a pass.
   - **Don't add caution the standard doesn't ask for (principle 10).** State consequences as facts (principle 7): what's public, what can't be undone, what costs money. No ask-first lines on the core loop, no triggers limited to requests that name the product, no disclaimers. If the project's skills have them from S1's old wording, take them out of the core loop and leave republishing to the owner (step 5).

4. **Verify and ship:** build and test, and score the local build before you deploy: `npx readiness-audit@1 <your-domain> --base http://localhost:<port>`. After the deploy, run `npx readiness-audit@1 <your-domain> --compare docs/readiness-status.md` against production to see what changed, regenerate the status page, and commit. The required count can grow as items start to apply (publishing a skills index makes S1 apply), so compare item by item, not just the totals.

5. **Ask the owner before publishing anything:** npm, the MCP Registry, Smithery, ClawHub, DNS, CDN settings, database migrations. On ClawHub, publish each skill only from the account that owns it.

T5 (the agent usability test) and T6 (search numbers) are required, but they're recorded by hand: see [usability-test.md](usability-test.md). Leave them "not recorded" until you have real results. For T5, keep its test accounts off public pages, set a model and a turn limit, and make sure the agent knows nothing about you. T6 needs a person with Search Console access.

## Lessons from the projects that switched over

- Cloudflare caches robots.txt for about two hours. If a robots.txt fix still fails, check whether the scorecard says it read a cached copy, then wait or purge it. Its managed robots.txt feature adds a group of its own at the top: leave it off.
- D8 (markdown for agents) is next level: build it once your logs show agents asking. On Next.js 14.2 the HTML can't carry `Vary: Accept` without a CDN rule.
- A sitemap URL that 404s (W3) can come from a lookup that assumes names are unique, or a LIKE match where `_` matches any character. In Next.js, a `loading.tsx` above a detail page makes missing pages answer 200 (inbed).
- Field descriptions that Zod emits inside `anyOf` count as missing (A1): call `.describe()` last, after `.nullable()`.
- Skills: each SKILL.md's `name` must be its folder slug. Index the skills your site serves, not every ClawHub listing. Serve the files at `/.well-known/agent-skills/<name>/SKILL.md`, and compute the digest from the bytes you serve.

- Answer a failed key check with 401 only when the key is wrong: a rate limit is 429 and a database error is 503 (A9, A10). Otherwise agents with good keys register again.
- Keep logs somewhere a deploy can't wipe them, or the monthly review (T3) has nothing to read.

Working patterns for several items (a `/.well-known` catch-all, `GET /api` for browsers, `did_you_mean`, unreplaced placeholders, one auth helper, test accounts, markdown routes) are in [recipes.md](recipes.md).

When you're done, report the `--compare` output (what changed), the score before and after, and anything you declined.
