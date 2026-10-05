# Adopting the standard: instructions for a project's agent

To switch a project over, give its coding agent one line:

> Adopt the Agent and Search Readiness Standard in this repo by following https://github.com/geeks-accelerator/agent-and-search-readiness/blob/main/docs/adopting.md

Everything below is for that agent. animalhouse.ai switched over first and went from 10 to 19 of 19 required checks. Do the same for your project.

1. **Score the live site:** `npx readiness-audit@1 <your-domain>`. It's read-only; run it only against your own sites. Exit code 1 means a required check failed.

2. **Switch over the docs (one commit):**
   - Replace your repo's old agent-discovery or readiness playbook with the short pointer stub in [STANDARD.md §14](../STANDARD.md#14-adopting-the-standard-in-a-repo). Keep your project-specific notes there, including your T5 goal: the one task a fresh agent should manage on its own (animalhouse's is "Adopt a pet and feed it").
   - Delete any local audit script and old status doc that the scorecard now covers. Keep checks that are truly project-specific as tests.
   - Generate the status page: `npx readiness-audit@1 --matrix <your-domain> > docs/readiness-status.md`. If your repo is private, don't put it on a public web page.
   - Add one rule to your CLAUDE.md or AGENTS.md: after changing discovery files, page metadata or the API, run the scorecard and regenerate docs/readiness-status.md.

3. **Fix what it reports,** required checks first, then recommended. STANDARD.md has the guidance for each ID. Two rules:
   - **Only declare what's true (D12).** No A2A card without an A2A endpoint, no OAuth server metadata without an OAuth server, no MCP server card that isn't the v1 schema. Answer with an honest JSON 404 that points to what you do serve.
   - **Decline in writing (principle 9).** If an item doesn't fit your project, list it under "Declined items" in the stub with the reason. Never fake a pass.

4. **Verify and ship:** build and test, deploy, re-run the scorecard against production, regenerate the status page, commit.

5. **Ask the owner before publishing anything:** npm, the MCP Registry, Smithery, ClawHub, DNS, CDN settings, database migrations. On ClawHub, publish each skill only from the account that owns it.

T5 (the agent usability test) and T6 (search numbers) are required, but they're recorded by hand: see [usability-test.md](usability-test.md). Leave them "not recorded" until you have real results.

## Lessons from animalhouse

- Cloudflare caches robots.txt for about two hours. If a robots.txt fix still fails, check whether the scorecard says it read a cached copy, then wait or purge it.
- Next.js 14.2 overwrites `Vary` on App Router pages, so D8 needs a CDN rule or a written decline.
- A sitemap URL that 404s (W3) can come from a lookup that assumes names are unique, or a LIKE match where `_` matches any character.
- Skills: each SKILL.md's `name` must be its folder slug. Serve the files at `/.well-known/agent-skills/<name>/SKILL.md`, and compute the digest from the bytes you serve.

When you're done, report the score before and after, and anything you declined.
