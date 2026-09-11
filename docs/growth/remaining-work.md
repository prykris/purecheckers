# Remaining roadmap work

This is the current work queue, consolidated on 11 September 2026. Historical implementation checkpoints record evidence; they are not additional task lists. The full scope remains [plans 01–06 and 04a](00-overview.md), with detailed requirements in the [requirement audit](requirement-audit.md). The application is not yet cleared for release.

## Completed: current Linux verification

The clean Linux run found an early matchmaking timer wakeup and a stale puzzle-verifier version expectation. Both are corrected. All **1,095 tests**, the production build and the real bot/reconnect/duplicate-command/replay/native-preview smoke pass. [Linux verification](../linux-verification.md) records the source hashes, runtime, migrations and limits. This local result does not establish Railway capacity or replacement behavior.

## 1. Apply the accepted release decisions

All six questions are resolved in [owner decisions](owner-decisions.md): expiring profile invitations, paid/owned themes, GitHub Issues feedback, no open-source licence, a daily Railway puzzle job and a $10/month total budget with owner monitoring. Invitations, unified theme selection and feedback links are implemented locally. Finish their focused acceptance checks; no further product-policy answer is required.

The one-coin daily puzzle reward is already approved and implemented. Do not ask for that decision again.

## 2. Close the remaining requirement comparisons

Finish plan 02's literal primary-query/title/description comparison and comprehensive outline/source coverage. The twelve articles, legal diagrams, body-length ranges, contextual links, actual FAQ comparison and local metadata rendering now have evidence. Those checks do not prove every outlined topic or wording requirement.

Complete the final requirement-by-requirement comparison for plans 04/04a and 06, using the current implementation rather than old checkpoint descriptions. In particular, reconcile the accepted interaction matrix, public-profile challenge behavior and sharing/prompt lifecycle requirements. Preserve the documented 04a decisions where they supersede the original 04 proposal. Fix actual gaps; do not add parallel state owners or infer completeness from the test count.

## 3. Run one consolidated browser acceptance pass

Use the [first-session checks](../first-session-verification.md), [puzzle checks](../puzzles.md#manual-acceptance), [sharing checks](../share-previews.md) and [launch checks](launch-readiness.md#concise-owner-acceptance-pass) as one pass, recording the candidate and devices used. Cover:

- Guest bot entry, bot-first response, human/nearby/configured-room entry and cancellation.
- Navigation and Back/Forward, reconnect/reload, opponent departure, result actions and rematch consent.
- Upgrade-form ownership, mobile keyboard/focus, narrow layouts, animations and reduced motion.
- Puzzle solving/reveal/retry and UTC rollover, privacy, native share/copy, and prompt behavior across tabs.

Use disposable local/staging accounts for failure injection. Browser acceptance is still needed even after the server tests pass.

## 4. Validate the actual hosting and publication setup

Work within the owner's $10/month total budget and existing host resources. Measure supported concurrency, latency, event-loop delay, CPU, memory and database errors under sustained play and controlled replacement. Verify the single-owner deployment contract and recovery on that host. Do not ask the owner to select technical thresholds or a speculative player count.

Use the selected Railway publisher at 02:00 UTC daily with manual owner monitoring. Import the reviewed buffer starting on the actual release's UTC date and verify today plus thirty future dates. The local artifact's dates are not a deployed schedule. Follow the [publishing runbook](../puzzle-operations.md); imports must continue to reject conflicting published content.

## 5. Prepare and verify the release

Review the complete candidate diff and migrations, record the commit and reproducible build, and perform the separately authorized Railway rollout. Verify the deployed sitemap, article/puzzle metadata, private-route exclusions, images and actual client/server recovery behavior. Run platform preview checks and GA4 DebugView/Realtime checks on that deployed candidate. Record evidence in [launch readiness](launch-readiness.md), not just an intention to deploy.

## 6. Finish launch preparation and measurement setup

Verify the published README/assets and advertised claims against the release. Finalize the owner-facing launch drafts and current venue-rule review, feedback access and reply availability. Record the Search Console/GA4 report locations and the relative measurement windows from the plans. Future impressions, indexing and retention targets are measurements to collect after release, not results that can be asserted now.

Sending posts, emails or submissions remains a separate authorization. HN prose must remain owner-written under the recorded venue policy. This queue does not authorize outreach or reinterpret launch preparation as completed distribution.
