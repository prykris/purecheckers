# Client addresses and public rate limits

`server/middleware/clientAddress.js` is the shared resolver for IP-based limits. Bot discovery, invitation preflight, preview routes and anonymous puzzle attempts use it. Authenticated puzzle attempts use the server-validated account ID instead. Express's `trust proxy` setting is not enabled, and no route independently parses forwarded headers.

## Deployment modes

- `CLIENT_IP_SOURCE=socket` is the default. Only the connection's remote address is used; `X-Real-IP`, `X-Forwarded-For`, `Forwarded` and Express's derived `req.ip` cannot override it. Use this for local or direct hosting.
- `CLIENT_IP_SOURCE=railway` uses one valid `X-Real-IP` supplied by Railway's HTTP edge. Enable this only when the application port has no public path bypassing that edge. Do not expose the same port through Railway TCP Proxy or another untrusted ingress. Missing, duplicate/list-valued, port-bearing and malformed values fall back to the connection peer, never another header.
- Other values fail at startup. There is no automatic trust based solely on a header's presence or an assumed proxy-hop count.

Railway's [network specifications](https://docs.railway.com/networking/public-networking/specs-and-limits) identify `X-Real-IP` as its client-address header. In a [provider staff response](https://station.railway.com/questions/need-authoritative-railway-client-ip-p-b7a7b4bd), Railway confirms that its HTTP proxy always sets and overwrites the header and that the HTTP origin is not directly accessible. That is the contract used by the explicit mode; recheck it if ingress changes. An additional CDN in front may cause the reported address to identify that CDN rather than its end user. Do not compensate by trusting arbitrary client headers.

This avoids broad `trust proxy=true`, which also changes Express's interpretation of host/protocol and requires a different verified header contract; see [Express's proxy documentation](https://expressjs.com/en/guide/behind-proxies/).

IPv6 spellings are canonicalized, and IPv4-mapped IPv6 addresses share an identity with their IPv4 spelling. Ports, IPv6 scope identifiers and address lists are not accepted as client identities. This prevents spelling changes from resetting a bucket; it does not prevent a client that actually controls multiple addresses from using those addresses.

## Bounded resource use

Each limiter stores at most 10,000 client entries and one shared overflow bucket. New identities share that bucket when capacity is full; rotating identities cannot allocate unlimited entries or evict an existing client's active limit. Idle entries are swept, and token refill uses a monotonic clock. Authenticated puzzle identities use the same bounded limiter implementation.

This remains a single-process limit. It does not coordinate replicas or provide a substitute for edge protection, authentication or the server's command validation.

## Verification and rollout

Six focused tests cover direct-header spoof attempts, separate Railway clients, ignored forwarded-header changes, canonical aliases, malformed/duplicate values, shared overflow behavior and idle recovery. Together with the actual room, puzzle, bot-account and preview API tests, all 37 tests across five files passed. Evidence: `.generated/tests-client-address.log`.

No Railway variables or networking settings were changed. During the separately authorized deployment:

1. Confirm the app port is exposed only through Railway HTTP networking; inspect additional proxies and TCP exposure.
2. Set `CLIENT_IP_SOURCE=railway` and retain a single replica. Local/direct environments keep `socket`.
3. Verify two independent client connections receive independent buckets, while changing supplied `X-Real-IP` and forwarded headers through the public edge cannot change the server's resolved identity. Use temporary restricted diagnostics in staging; do not add a public address/debug endpoint or log credentials.
4. Remove diagnostics after the check. Recheck identity if ingress changes.

Local simulated-proxy tests establish application behavior, not Railway's live edge behavior. That rollout check remains externally gated.
