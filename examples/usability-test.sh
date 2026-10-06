#!/usr/bin/env bash
# The agent usability test (T5) with Claude Code in print mode: a fresh agent gets only
# a domain and a goal. Run it only against your own site: the agent registers and acts
# like a real user.
#
# Usage: examples/usability-test.sh <domain> "<goal>" [--attempts 5] [--model sonnet]
#                                     [--max-turns 60] [--pause 120]
#
# Keep --model and --max-turns the same from month to month so the results compare.
# --pause waits between attempts, because sign-up limits usually count per IP address.
#
# Freshness: each attempt runs in an empty temporary folder, with no MCP servers and no
# user settings. With ANTHROPIC_API_KEY set it also uses --bare, which reads no login,
# memory or CLAUDE.md at all. Without it, Claude Code still tells the agent which
# account is signed in, so the prompt fixes the test name and says not to use personal
# details.
set -euo pipefail
usage="usage: $0 <domain> \"<goal>\" [--attempts N] [--model M] [--max-turns N] [--pause S]"
domain="${1:?$usage}"
goal="${2:?$usage}"
shift 2
attempts=1 model=sonnet max_turns=60 pause=120
while [ $# -gt 0 ]; do
  case "$1" in
    --attempts) attempts="$2"; shift 2 ;;
    --model) model="$2"; shift 2 ;;
    --max-turns) max_turns="$2"; shift 2 ;;
    --pause) pause="$2"; shift 2 ;;
    *) echo "$usage" >&2; exit 2 ;;
  esac
done

isolation=(--setting-sources project --strict-mcp-config)
[ -n "${ANTHROPIC_API_KEY:-}" ] && isolation+=(--bare)

for i in $(seq 1 "$attempts"); do
  name="test-usability-$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 6)"
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  out="$PWD/usability-${domain}-${stamp}-${i}.json"
  prompt="You are an AI agent with no prior knowledge of https://${domain}. Using only that site and what it tells you, do this: ${goal}.
Find your own way: read the site, its docs and its API. If you need an account or a name, use exactly: ${name}. Don't use any personal details from your environment.
When you finish or give up, end with a report:
RESULT: SUCCESS or FAILURE
CALLS: the requests you made, in order
ERRORS: every error you hit, and whether the response told you how to recover
MISMATCHES: every place where the docs and what the site actually did disagree"

  workdir="$(mktemp -d)" # an empty folder: no project files, CLAUDE.md or memory
  (cd "$workdir" && claude -p "$prompt" --model "$model" --max-turns "$max_turns" "${isolation[@]}" \
    --allowedTools "WebFetch" "Bash(curl:*)" --output-format json) > "$out" || true
  rm -rf "$workdir"
  echo "Attempt $i of $attempts as $name: $out"
  if [ "$i" -lt "$attempts" ]; then sleep "$pause"; fi
done
