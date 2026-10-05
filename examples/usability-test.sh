#!/usr/bin/env bash
# One attempt of the agent usability test (T5) with Claude Code in print mode.
# Usage: examples/usability-test.sh <domain> "<goal>"
# Run it only against your own site: the agent registers and acts like a real user.
set -euo pipefail
domain="${1:?usage: $0 <domain> \"<goal>\"}"
goal="${2:?usage: $0 <domain> \"<goal>\"}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="usability-${domain}-${stamp}.json"

prompt="You are an AI agent with no prior knowledge of https://${domain}. Using only that site and what it tells you, do this: ${goal}.
Find your own way: read the site, its docs and its API. If you need an account or a name, use one that starts with test-usability-.
When you finish or give up, end with a report:
RESULT: SUCCESS or FAILURE
CALLS: the requests you made, in order
ERRORS: every error you hit, and whether the response told you how to recover"

claude -p "$prompt" --allowedTools "WebFetch" "Bash(curl:*)" --output-format json > "$out"
echo "Saved $out"
