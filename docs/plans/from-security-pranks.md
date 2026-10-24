# Plan: what the sister project found that applies here

Written 2026-10-24, from a review of [agent-security-pranks](https://github.com/geeks-accelerator/agent-security-pranks) and its research. Status: done in 2.2.0. Ships as 2.2.0 with one new warning (D7).

## 1. Cap response bodies

- **Why:** `request()` buffers any body and decodes gzip with no limit, so a site answering with a gzip bomb could exhaust the memory of the machine running the audit. The sister project's `request()`, which started from this one, caps bodies before and after decoding.
- **What:** a `maxBytes` option, default 16 MB: large enough for a big llms-full.txt (drifts' is 200 KB; documentation sites can reach several MB), small enough to be safe. Over the cap, reading stops and the connection closes; the answer keeps its status and gets `tooBig` and an error, like a refused encoding. Decoding uses zlib's `maxOutputLength`.
- **Where it shows:** W3 already reports a sampled page whose body the audit couldn't read. D4 reports an llms-full.txt over the cap by its size rather than as 0 KB.
- **Tests:** in `test/http.test.mjs`, a raw body and a gzip bomb over a small cap.

## 2. `--logs`: crawler names on probe paths

- **Why:** across one owner's 56 domains in a week (October 16 to 23, 2026), none of 448k probes came from a verified bot, and one scanner sent 308k requests under about 20 AI-crawler names. `--logs` classifies by user agent alone, so it would count that scanner as AI crawlers.
- **What:** count requests under a crawler family's name (AI crawlers, assistants, search crawlers, directories) that asked for a secret-hunting path (`.env`, `.git`, `.aws`, `wp-admin`, `.php` and the like), per family, and print them as names that aren't the crawlers they claim. The family headings say the names are claimed, not verified.
- **Reuses:** `family()` and the tally; the probe patterns are the research's published list.

## 3. STANDARD.md

- §2: the impostor finding, cited with its date.
- T3: a crawler's name is a claim; count it as that crawler only when the CDN's verified flag, the vendor's published addresses or reverse DNS confirms it.
- D7: the 405 carries `Allow` (RFC 9110 §15.5.6 says an origin server must send it).
- §16: the research and RFC 9110's 405 section.

## 4. D7 checks `Allow`

A JSON 405 without `Allow` is a warning at D7's recommended level. The fixture sends `Allow: GET, HEAD`, and the recipe shows it.

## 5. README

A row in "How it fits with other tools" for security-pranks-audit: the sister project, for the probes this audit doesn't send.

**Done when** the tests cover the cap, the crawler-name count and the `Allow` check; the six sites score as before; and the changelog says D7 can newly warn.
