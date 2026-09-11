# Release decisions — 11 September 2026

The owner answered the six outstanding questions. This record supersedes earlier pending-decision notes; do not ask these questions again.

| Area | Accepted decision |
| --- | --- |
| Profile challenges | Support invitations even when the recipient has no room. Use the existing authoritative room/session protocol, explicit acceptance and expiry. |
| Themes | Retain paid themes. Profile offers the basic theme and owned themes through the same equipment selection as Shop. |
| Feedback | No email system. Use the existing GitHub Issues destination, verified enabled and public on 11 September with `gh repo view`. No report or message was sent. |
| Licence | Do not make the project open source. Add no open-source licence; omit open-source claims and exclude licence-dependent distribution venues. Repository visibility was already public and is unchanged. |
| Puzzle operations | Owner delegated the choice: separate Railway scheduled service at 02:00 UTC daily, manual review of run logs/status, first publication on the release's UTC date. The owner monitors operations; no email or paid monitoring integration is required. |
| Hosting | $10/month total budget, monitored by the owner. Retain one web replica and the existing database; no paid upgrade or additional always-running service. Measure available capacity rather than promise a player count. |

The one-coin reward for the first eligible solve of today's UTC puzzle remains approved. Archive puzzles award no coins.

## Implementation and acceptance

Challenges are private, free rooms with a five-minute expiry and at most five pending invitations per recipient. Only the sender is initially a member. Recipient snapshots expose their invitations; reconnect restores them from the existing room records. Acceptance uses `room:join`; both players then ready up. Decline, sender cancellation and unaccepted expiry close the room and release membership. Bots, guests, private profiles and self-challenges are not eligible recipients. A recipient can continue an existing activity; accepting requires being idle.

Themes and skins are read together by `/api/shop/appearance`. The accepted theme drives CSS and board rendering. The browser-only theme store is removed. Account replacement clears appearance, and refresh/reconnect loads current equipment. Basic-theme reset uses the existing equipment receipt/journal and clears only the THEME slot. Prices and inventory are retained.

Feedback is linked from FAQ, the marketing footer, Profile and README. It requires a GitHub account and is public. The repository's current public visibility is recorded separately from its licence policy.

`railway-puzzles.json` defines the publisher build/start/schedule. Configure only the publisher service to use that file; the web service must keep its existing startup. The chosen schedule is configuration prepared for deployment, not an enabled production service. Before enabling it, import the reviewed buffer beginning on the actual release date, check today plus 30 future dates and run maintenance once. See [puzzle operations](../puzzle-operations.md).

Railway's Hobby subscription currently starts at $5/month with $5 usage included; total consumption can exceed the owner's $10 budget. Do not infer a bill from resource limits. Inspect the existing account's usage before enabling the publisher and let the owner monitor actual spending. [Railway pricing](https://docs.railway.com/pricing/plans), checked 11 September 2026.

## Focused manual checks

Local verification: **1,108 tests across 104 files pass** (`.generated/tests-owner-decisions-final.log`), including the real socket invitation/reconnect/accept/readiness flow, concurrent recipient limits, expiration/decline notices, restoration and theme ownership/reset. `npm run build` passes, including Prisma generation (`.generated/build-owner-decisions-npm.log`). The first full test run exposed an existing batching test whose database-created jobs were not always due against the process clock; its fixture now uses the persisted job deadlines. No settlement behavior was changed. Browser acceptance and production activation are not claimed by these results.

1. From one registered player's public profile, send a challenge from another account. Accept it in the recipient's Play page, ready both players and play. Repeat with decline, sender cancellation and expiry; neither account should stay trapped in a room. Reload the recipient before accepting.
2. Equip an owned theme in Profile, then change/reset it in Shop. Check the page and board, reload and switch accounts. Unowned themes must require purchase; an old interrupted selection must not undo a newer one.

Remaining implementation, release and hosting verification are engineering tasks in [remaining work](remaining-work.md). Outbound launch posts still require separate authorization.
