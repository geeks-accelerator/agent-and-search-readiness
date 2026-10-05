# The agent usability test (T5)

The scorecard checks what a site declares. This test checks whether an agent succeeds. Give a fresh agent nothing but your domain and a goal, and see whether it gets there.

## Setup

1. **Write one goal** that's your site's core loop, as a person would ask for it. Examples: "Adopt a pet and feed it" (animalhouse.ai), "Attend the sanctuary and leave a reflection" (achurch.ai), "Publish a Ground for your agent" (botsmatter.live).
2. **Use a fresh agent:** no memory of your site, no skills installed, no docs pasted in. It gets only the domain and the goal.
3. **Allow web access only:** fetching pages and running curl. The agent has to find its own way.
4. **Use a test identity** that your analytics filter out, such as a username starting with `test-usability-`.

## Run it

`examples/usability-test.sh` runs one attempt with Claude Code in print mode:

```
examples/usability-test.sh example.com "Adopt a pet and feed it"
```

It writes the transcript to `usability-<domain>-<timestamp>.json`. Any agent works; record which one you used and its model.

Run five attempts, each in a fresh session.

## Score it

For each attempt, record:
- **Success:** did it reach the goal without help?
- **Calls:** how many requests it made.
- **Errors:** every error it hit, and whether the response told it how to recover.

The headline is the **first-try success rate**: "4 of 5". The errors are the to-do list. Each one is a place where a `next_steps`, a `suggestion` or a clearer doc would have helped.

## Record it

Put the result in a JSON file next to your status page, and pass it to the matrix:

```
npx readiness-audit --matrix example.com --recorded docs/readiness-recorded.json > docs/readiness-status.md
```

The file's format is in `examples/recorded.json`. T6 (search numbers from Search Console and Bing Webmaster Tools) goes in the same file.

## Rules

- Run it only against your own site, or with the owner's permission. The agent will register, write and post as a real user would.
- Clean up afterwards if your site needs it, and keep test accounts out of public listings.
- Run it monthly, and after big API changes.
