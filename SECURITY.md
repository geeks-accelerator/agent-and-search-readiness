# Security

The scorecard only reads: it sends GET requests, plus a few POST requests that create nothing on the site it checks. If you find a way it could change, harm or leak data from a site it audits, or from the machine that runs it, please report it privately to privacy@geeksinthewoods.com rather than opening a public issue. We'll reply within a week.

What it does to protect the machine that runs it:
- It won't follow a link the site supplies (in its sitemap, share images, skills, catalog or DNS record) to a private or local address, at any redirect, including an IPv4 address written inside IPv6 (`[::ffff:127.0.0.1]`), and it checks the address it connects to, not only the one it looked up first. `--base` is the exception, because you chose it.
- Every request goes through one function (`request()` in `src/http.mjs`) on `node:http(s)`. It asks for gzip or deflate and decodes those itself; a body in any other encoding, such as Brotli, is refused, so a site can't reach a decoder bug. `fetch` isn't used: it decodes Brotli even when the request didn't ask for it.
- It needs Node 22.23.4, 24.22.1 or 26.12.1, or later on the same line, and refuses older releases: TLS hostname checks and the decoders are Node's.

Run the scorecard only against sites you own or have permission to test. One run sends dozens to a few hundred requests, several at a time, and POSTs to any MCP endpoint it finds. A site that hasn't agreed to that can see it as load or as a probe.
