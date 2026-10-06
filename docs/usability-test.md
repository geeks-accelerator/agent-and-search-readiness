# The agent usability test (T5)

The scorecard checks what a site declares. This test checks whether an agent succeeds. Give a fresh agent nothing but your domain and a goal, and see whether it gets there.

## Setup

1. **Write one goal** that's your site's core loop, as a person would ask for it. Examples: "Adopt a pet and feed it" (animalhouse.ai), "Attend the sanctuary and leave a reflection" (achurch.ai), "Publish a Ground for your agent" (botsmatter.live). Choose a goal the agent can finish alone: one that needs someone else to act (a match on a dating site needs the other side to like back) can't be completed in one run.
2. **Use a fresh agent:** no memory of your site, no skills installed, no docs pasted in, and none of your own details. It gets only the domain and the goal.
3. **Allow web access only:** fetching pages and running curl. The agent has to find its own way.
4. **Use a test identity** that your analytics filter out, such as a username starting with `test-usability-`.

## Run it

`examples/usability-test.sh` runs the attempts with Claude Code in print mode:

```
examples/usability-test.sh <your-domain> "<your goal>" --attempts 5 --model sonnet --max-turns 60
```

It writes one transcript per attempt to `usability-<domain>-<timestamp>-<n>.json`. Any agent works; record which one you used, its model and its turn limit.

- **Fresh for real.** Each attempt runs in an empty temporary folder with no MCP servers and no user settings, and the prompt gives a random test name (`test-usability-` plus six characters). Claude Code still tells the agent which account is signed in, unless `ANTHROPIC_API_KEY` is set: then the runner adds `--bare`, which reads no login, memory or CLAUDE.md. drifts' first run, before this, named its test account after the operator.
- **Budget.** Without limits, one attempt on a large model took drifts 7 minutes, 132 turns and $6.85, so five attempts a month cost about $35 per site. Choose a model and a turn limit, and keep both the same each month so the results compare.
- **Pause between attempts** (`--pause`, default two minutes): sign-up limits usually count per IP address, and five registrations in a row can hit one.
- **Steps that make the agent wait** (drifts locks its second step for five minutes) need a goal the agent can reach within that wait, or a turn limit that covers it.

## Score it

For each attempt, record:
- **Success:** did it reach the goal without help?
- **Calls:** how many requests it made.
- **Errors:** every error it hit, and whether the response told it how to recover.
- **Stops:** every place the site, its docs or a skill told the agent to ask a person first. An agent running unattended has no one to ask, so each one is a place the core loop stalls (principle 10).
- **Doc mismatches:** places where the docs promised something the site didn't do (drifts' docs promised `reflection_saved: true`; the response didn't include it). These are often the best findings, and response schemas with a contract test (N7) catch them for good.

The headline is the **first-try success rate**: "4 of 5". The errors are the to-do list. Each one is a place where a `next_steps`, a `suggestion` or a clearer doc would have helped.

## Record it

Put the result in a JSON file next to your status page, and pass it to the matrix:

```
npx readiness-audit@1 --matrix example.com --recorded docs/readiness-recorded.json > docs/readiness-status.md
```

The file's format is in `examples/recorded.json`. T6 (search numbers from Search Console and Bing Webmaster Tools) goes in the same file, as fields (clicks, impressions, CTR, position, indexed and not indexed, for Google and Bing) so months compare. Reading those numbers takes a person, or a browser session, with access to both consoles.

## Rules

- Run it only against your own site, or with the owner's permission. The agent will register, write and post as a real user would.
- Clean up afterwards if your site needs it, and keep test accounts out of public listings, search, counts and the sitemap ([recipe](recipes.md#test-accounts-out-of-public-pages-t5-w3)).
- Run it monthly, and after big API changes.
