# 05 — Backlinks and distribution (the first ten links, by hand)

Owner decision, 11 September 2026: this project will not be released under an open-source licence. Omit open-source positioning and exclude awesome-selfhosted and any other licence-dependent venue from execution. GitHub Issues is the selected feedback destination. These [accepted decisions](owner-decisions.md) supersede the original licence questions and conditional suggestions below. Outreach remains unsent.

Implementation checkpoint, 10 September 2026: the README and links log exist, ten of twelve strategy guides are implemented, and the puzzle, sharing and bot-worker code has local verification. Production launch is **not cleared**. [launch-readiness.md](launch-readiness.md) owns the current release gates and claim evidence. Baseline tables below retain the original planning observations; they do not describe the current worktree. Phase 2 has been replaced with corrected review drafts and an HN author brief. No outreach has been sent.

The site has zero external backlinks and four organic clicks in three months (00-overview.md). Nothing in plans 01–04 changes that on its own: Google finds pages through links, and communities send the first real players. This plan lists ~20 venues checked on 10 September 2026, three ready-to-post drafts in the owner's voice, a six-week calendar with hard gates on plans 01, 03 and 04, and a tracking format. Going from zero to ten referring domains is the whole goal; it matters more than anything that follows.

## Current state

| Finding | Consequence | Source |
| --- | --- | --- |
| 0 external backlinks, 4 clicks, 60 impressions in 3 months | No authority, no referral traffic, and Google has no reason to crawl deeper than the nav | docs/growth/00-overview.md |
| Origin story is on the home page: roommate 11–1, apps with energy bars and $5 refills, $5/month hosting, "free for all, free forever" | The strongest launch asset the site has; it is honest and specific. It also contains two swear words that must not travel into HN/Reddit posts | src/routes/(marketing)/+page.svelte lines 56–64, 98–111 |
| Feature facts are documented: three minimax bots (depth 2/4/6) with emote personalities, replays, spectating, QR rooms, ELO from 1000, closed coin economy, 30 s reconnect grace, server-owned colour wheel, PostgreSQL | Enough concrete claims for a technical post without inventing anything | CHANGELOG.md; src/routes/(marketing)/faq/+page.svelte |
| Move analysis (minimax depth 6, colour-coded log) is in CHANGELOG v1.3.0 but the audit flags the rating pipeline as no longer consumed by the game screen (P3) | Do not claim move grading in any post until it is verified on the live site | docs/player-experience-audit.md, P3 row |
| GitHub remote github.com/prykris/purecheckers is public, with no LICENSE and no README | The repo exists as a venue but reads as abandoned; without a license it is "source-available", which excludes open-source lists such as awesome-selfhosted | `git remote -v`; `gh repo view` (visibility PUBLIC, licenseInfo null); repo root listing |
| /strategy and /blog are "coming soon" stubs | Nothing to link to besides the home page and FAQ until plan 02 ships; never point a launch post at these | src/routes/(marketing)/strategy/+page.svelte, blog/+page.svelte |
| og-image.png is referenced in schema but no static asset exists | Reddit, Discord and Slack previews render blank; plan 01 fixes this | src/routes/(marketing)/+page.svelte line 32; static/ empty |
| GA4 is installed site-wide (G-906GR0NE7N) | Referral sources and UTMs can be measured today | src/app.html lines 11–16 |
| No bug-report channel is advertised anywhere on the site | Launch feedback will land in Reddit comments and be lost | src/routes/(marketing)/+layout.svelte nav (no contact/issues link) |
| Live database was reset on 10 September; leaderboard is empty, two bot games logged | A visitor arriving from a launch post sees an empty lobby unless plan 04 ships first | docs/growth/00-overview.md |

### What is link-worthy today versus after plans 01–04 and 06

| Asset | Today | After the dependent plan |
| --- | --- | --- |
| Home page with origin story and no-ads stance | Link-worthy now; the story is the hook for every community | Plan 01 adds an OG image so shares render |
| Bots with personalities, replays, spectating, QR rooms | Real, demonstrable, no signup | Plan 04 makes the bot the default first game on an empty server |
| Move analysis | Do not cite until verified (audit P3) | Cite once the rating pipeline is confirmed live |
| /puzzle daily page | Does not exist | Plan 03: the single best URL to link from HN and forums, because it is a thing to do rather than a thing to read |
| /strategy articles | Stub | Plan 02: rules and strategy pages are what federations, clubs and wikis actually link to |
| Share cards / per-game OG images | None | Plan 06: turns players into a distribution channel; helpful, not a blocker |
| Public GitHub repo | Exists, undocumented, unlicensed | README + LICENSE unlock Show HN "source" comments, awesome-lists and self-hosting venues (see Open questions) |

## Plan

### Phase 0 — Gates and preparation (effort: 1 day, after 01/03/04 ship)

Do not post to any community until every row is true.

| Gate | Check | Plan |
| --- | --- | --- |
| Link previews render | Paste purecheckers.com into a Discord DM and a Reddit draft; image and description appear | 01 |
| Puzzle URL is live and indexable | /puzzle returns today's puzzle, appears in the sitemap | 03 |
| Empty server is survivable | A fresh guest reaches a finished bot game inside two minutes without touching the lobby list | 04 |
| Claims in the drafts below are verified | Play one game on the live site and tick each claim: three bots, QR room, replay, spectate, reconnect, colour wheel; move grading only if visible | this plan |
| Bug-report channel exists | GitHub Issues enabled on prykris/purecheckers and linked from /faq or the footer; or a `feedback@purecheckers.com` address | this plan |
| Repo has a README | One screenshot, the one-paragraph blurb below, a link to the live site, the stack, and how to run it (docs/deployment.md already covers the server) | this plan |
| Tracking is ready | docs/growth/links-log.md created with the header row from Phase 6; GA4 Traffic acquisition report bookmarked | this plan |

### Phase 1 — Target list (effort: 0 days; research done, verify live rules before each post)

Verification status is what could be confirmed on 10 September 2026. Reddit blocks automated fetches, so subreddit sizes come from a third-party index and each sidebar must be read by hand before posting. Link type is the likely rel attribute; treat every community link as traffic first and authority second.

| # | Venue | Type | Link type | Rules or constraints | Best angle | Best asset | Priority | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Hacker News, Show HN | community post | story link followed in practice; comments nofollow | Must be tryable without signup (it is). Title starts "Show HN:". No asking friends for votes. Post once; a later major update may qualify again | Personal + technical: $5/month vs energy bars, authoritative server, bots | Home; mention /puzzle | High | Yes (showhn.html) |
| 2 | r/checkers | community post | nofollow | ~2k members, "for people who play checkers or enjoy the game". Small and on-target; read sidebar; disclose authorship | Player angle: test the rules and bots, ask what serious players need | Home, /puzzle | High | Exists (index); rules not read |
| 3 | r/WebGames | community post | nofollow | ~142k members; "no downloads, signups or plugins", which the site satisfies. Dev self-posts are common; check flair | "Free browser checkers, no signup, play a bot or a friend by QR" | Home | High | Exists (index); rules not read |
| 4 | r/sveltejs | community post | nofollow | ~57k members; self-promo posts are a normal share of content; use showcase flair if present | Builder angle: authoritative snapshots, navigation from state, colour wheel stage | Home + GitHub repo | High | Exists (index); rules not read |
| 5 | r/SideProject | community post | nofollow | ~180k members; self-promo welcome but must show progress and motivation, not a bare link; required flair; no repost within a month | Builder story: built from spite, $5/month, what I learned | Home | Medium | Exists (guides); rules not read |
| 6 | The Flying Kings (Discord) | community post | none (chat) | Listed on DISBOARD as the checkers/draughts server, all variants incl. American 8x8; has find-a-game and news-and-media channels. Join, play, then share | Ask for testers of an 8x8 site; offer club rooms | Home, /puzzle | High | Listed on DISBOARD (search); server not joined |
| 7 | ACF forum (usacheckers.com/forum) | community post + outreach | nofollow (phpBB); links.php likely followed | Active (posts dated September 2026, 31k posts). Has Introductions, Marketing and Projects/Programming boards. Links page has an "Online Gaming Websites" category; request via /contactus.php | Introduce in Introductions; request a links.php entry | Home, /strategy rules page when live | High | Yes |
| 8 | English Draughts Association | outreach | likely followed (static page) | "5.1 Where to play — online" lists four turn-based sites; contact englishdraughtsuk@gmail.com | Ask to be listed as a live-play option alongside the turn-based ones | Home | High | Yes |
| 9 | WCDF (wcdf.net) | outreach | unknown | Has Links and Forum menu items; page content not readable in this session | Same email as EDA; lower expectations | Home | Medium | Site exists; links page not read |
| 10 | FMJD (fmjd.org) | outreach | unknown | International body; delegates English checkers to WCDF. webmaster@fmjd.org | Only after WCDF; one polite email | Home | Low | Yes |
| 11 | lidraughts.org forum | community post | nofollow | Open-source, no-ads 10x10 international draughts server with General Draughts Discussion and Off-Topic boards. It does not offer 8x8 American; a user has asked why. Position as a complement, not a competitor, and never post in Lidraughts Feedback | "For those who also play 8x8: a free, no-ads site in the same spirit" | Home | Medium | Yes |
| 12 | BoardGameGeek, Checkers (boardgame/2083) | directory | nofollow | Entry exists and already lists online-play links (Play Abstract Games, Boardspace). Web links are user-submitted with a BGG account and moderated | Submit a "Play online" web link | Home | Medium | Entry exists (search); submit flow not read |
| 13 | AlternativeTo | directory | nofollow | Anyone with an account can add an app; list as alternative to existing online checkers entries | Free, no-ads, no-signup | Home | Medium | Yes (site and user-added entries) |
| 14 | GitHub repo README (prykris/purecheckers) | profile | nofollow | Owner-controlled. Needs README + LICENSE + Issues | Link to live site and /puzzle; screenshot | Home, /puzzle | High | Yes (public, no README/LICENSE) |
| 15 | Svelte Society showcase | showcase | unknown | Site exists and has a showcase/submission path per search results; the site returned 403 to automated fetch, so find "Submit" by hand | SvelteKit 2 / Svelte 5 real-time game | Home | Medium | Exists; submit path not read |
| 16 | Svelte Discord (svelte.dev/chat → discord.gg/svelte) | community post | none | Official invite verified. Post in the showcase channel only; no DMs | Same as r/sveltejs, shorter | Home + repo | Medium | Invite verified; channel name not checked |
| 17 | awesome-svelte (TheComputerM) | directory | followed (GitHub README) | 2.2k stars, CC0, PRs welcome, but only has "Application Examples › Desktop"; a web app entry may be declined | Offer as a web application example | Repo + home | Low | Yes |
| 18 | awesome-selfhosted | directory | followed | Requires an OSI licence and self-host docs; docs/deployment.md exists. Blocked until LICENSE is added | "Games › Board" style entry | Repo | Conditional | Repo exists; CONTRIBUTING not readable |
| 19 | Product Hunt | showcase | nofollow | Personal account required; launch at 12:01 am PT; one launch per product | "Free forever checkers, built by one person for $5/month" | Home | Low | Yes (launch guide) |
| 20 | dev.to | community post | nofollow | Accepts posts about your own projects; supports a canonical URL field (well known, not checked this session) | Long-form version of the r/sveltejs post | Home + repo | Medium | Yes |
| 21 | Indie Hackers / r/indiehackers | community post | nofollow | r/indiehackers allows one SHOW IH post per product, framed for feedback, no revenue claims needed | Feedback request, not a launch | Home | Low | Rules via search; not read live |
| 22 | itch.io | directory | nofollow | Requires uploading an HTML build; a socket.io app cannot be embedded, and a redirect stub is frowned on | Not a fit unless a static puzzle build exists | /puzzle (future) | Skip for now | Yes (HTML5 docs) |
| — | r/boardgames | community post | nofollow | 5.4M members; self-promotion discouraged, "come as a person, not a brand". A "Custom Project" flair exists | Only after months of genuine participation | — | Skip for now | Exists (index) |
| — | r/IndieGaming | community post | nofollow | 522k members, skewed to Steam-style releases; weak fit for a browser board game | — | — | Skip | Exists (index) |
| — | Checker Wiki (checker.fandom.com) | directory | nofollow (Fandom) | Exists per search results; page fetch failed | Add to any "online play" page if one exists | Home | Low | Not verified |

Not included because existence or rules could not be verified: r/InternetIsBeautiful, r/playmygame, checkers Facebook groups, national federations other than EDA/ACF/WCDF. Add them to the links log only after reading their rules by hand.

### Phase 2 — Review drafts and author brief

These are preparation material, not published statements or authorization to send. Use only after the corresponding production checks in [launch-readiness.md](launch-readiness.md) pass. Read each venue's current rules before using a draft; authorship disclosure does not replace permission to self-promote. The owner must choose the posting account and feedback destination. No player-count, hosting-price, move-grading, tournament-rule or seamless-deployment claim is included.

**Show HN: author brief, not a ready-to-post draft.** The [HN guidelines](https://news.ycombinator.com/newsguidelines.html), checked 10 September 2026, prohibit generated or AI-edited text. The owner should write the submission and replies independently in their own words. The [Show HN guidelines](https://news.ycombinator.com/showhn.html) require a personally built, tryable project and prohibit soliciting votes or comments. This supersedes the original plan's generated HN draft; no replacement prose for posting is supplied.

Facts to check before writing:

- Motivation: the owner's actual experience building and playing the game; confirm any story or hosting amount personally.
- Direct trial: the deployed bot flow works without registration; link to a tested playable entry point.
- Rules: 8x8, compulsory captures, backward captures by men, flying kings, choice among capture routes, promotion ending a capture turn. These are Pure Checkers' rules, not standard English/American tournament rules.
- Implementation: SvelteKit/Svelte, Express/Socket.IO, Prisma/PostgreSQL; server commands and snapshots, bounded bot workers, durable accepted game checkpoints.
- Honest boundary: unfinished-game restoration has an explicit readiness pause. Waiting-room, spectator and finished-result lifecycle persistence is still unfinished; no seamless Railway replacement claim.
- Puzzle mention: include only after today's page, publishing buffer and production solve checks pass.
- Source link: a public repository does not imply an open-source licence. Confirm the owner's licence decision first if using that description.

**r/checkers review draft (player angle)**

Title: `I built an 8x8 checkers site with flying kings — looking for rules and bot feedback`

> I'm Chris, the developer of Pure Checkers. It is a free browser game with no ads or energy bars, and you can play without registering.
>
> It uses 8x8 rules with compulsory captures, backward captures by men and flying kings. You can choose among legal capture routes; a man that promotes ends its capture turn. That differs from English/American checkers, so the rules page explains the differences before you play.
>
> You can practise against Easy, Medium or Hard bots, or invite a friend through a room link or QR code. Recorded games have replays, and other players can spectate live games.
>
> I'd appreciate feedback on whether the rule explanations are clear and where the bots make unconvincing decisions. A replay link with the move that surprised you would help me investigate.
>
> [Play Pure Checkers](https://purecheckers.com) · [Rules](https://purecheckers.com/strategy/checkers-rules) · [Changelog](https://purecheckers.com/changelog)

**r/WebGames review draft (quick trial)**

Title: `Pure Checkers — play a bot or invite a friend in your browser (I made this)`

> I'm the developer of [Pure Checkers](https://purecheckers.com), a free browser game with no ads or energy bars. Choose a nickname to try a bot without registering, or send a friend a room link. If you're together, they can scan the room's QR code on their phone.
>
> There are three bot levels and replays of recorded games. The rules use an 8x8 board, compulsory captures, backward captures by men and flying kings, so expect some differences if you usually play English/American checkers. The [rules guide](https://purecheckers.com/strategy/checkers-rules) has examples.
>
> I'd like feedback on the phone controls and how easy it is to get into a game with a friend. Please include your browser and the steps if something gets stuck.

Do not copy the same post across communities; the one-subreddit-per-week schedule below is an internal pacing choice, not a verified platform-wide rule.

**r/sveltejs review draft (builder angle)**

Title: `Pure Checkers: a SvelteKit game built around server commands and snapshots`

> I'm building Pure Checkers, a free 8x8 browser game. The UI uses SvelteKit and Svelte; Express and Socket.IO handle live play, with Prisma and PostgreSQL for persistence.
>
> The browser submits gameplay commands and presents accepted server snapshots. Board animation is separate presentation state, so catching up after a connection interruption can replace the board without replaying an old animation queue. A shared navigation controller coordinates browser routes with session state through SvelteKit's navigation APIs.
>
> Accepted moves are checkpointed before they are acknowledged. Unfinished games can be restored after a server restart, with an explicit readiness pause for returning players. Waiting-room, spectator and finished-result lifecycle persistence is still unfinished, and real Railway replacement behavior remains a release check.
>
> Bot search runs in a bounded worker pool with cancellation and stale-result checks. Easy, Medium and Hard use depth limits of 2, 4 and 6; time budgets can stop a search earlier. The pool keeps search work off the socket thread, but its limits are not a production capacity benchmark.
>
> [Game](https://purecheckers.com) · [Repository](https://github.com/prykris/purecheckers). I'd welcome feedback on the state and recovery design.

Before eventual posting, update the remaining-work paragraph against the release being described. For r/SideProject, use the owner's actual motivation and one concrete implementation lesson; do not invent a first-person experience or cost figure.

**Outreach email review draft (only to venues accepting this rules variant)**

> Subject: An 8x8 checkers resource with flying kings
>
> Hello [recipient name], I'm Chris, the developer of [Pure Checkers](https://purecheckers.com). It is a free browser game with no ads or registration requirement. Its rules include compulsory captures, backward captures by men and flying kings, with a choice among capture routes and promotion ending the capture turn. It is not standard English draughts; the [rules guide](https://purecheckers.com/strategy/checkers-rules) explains the differences with interactive boards.
>
> The site supports bot practice and friend invitations through room links or QR codes. If your resource list includes variants with these rules, would it be a suitable addition? I understand if your list is restricted to English or another tournament ruleset. Thank you for considering it.

Verify recipient name, contact method, ruleset fit and submission policy at send time. Do not send this to an English-only list as an English-play recommendation. This template does not authorize sending email.

**Directory blurb, short**

> Pure Checkers is a free 8x8 browser game with compulsory captures, backward captures by men and flying kings. Play a bot or invite a friend through a room link or QR code. No registration, ads or energy bars. Its rules differ from English/American checkers.

**Directory blurb, long**

> Pure Checkers is a free browser checkers game for phones and computers, with no ads, energy bars or registration requirement. Its 8x8 rules use compulsory captures, multi-jumps, backward captures by men and flying kings. Players choose among available capture routes, and promotion ends the capture turn; the rules guide explains how this differs from English/American checkers. Practise against three bot levels, invite a friend through a private room link or QR code, watch live games, or revisit recorded games through replays. Registered players can play rated games and collect cosmetic items using in-game coins. The repository and public changelog describe the implementation and ongoing work.

Add a daily-puzzle sentence only after the publishing gate passes. Add an open-source label only after an appropriate licence is actually present in the published repository.

### Phase 3 — Launch calendar (effort: about 1 hour per weekday of the six weeks, plus 48 h of replies after each post)

Week 0 is the gate week; nothing below starts until all Phase 0 rows are true. Community posts go to one subreddit per week, never two. Directories and profiles go first because they cannot be burned by an empty lobby or a bad first impression.

| Week | Actions | Gate |
| --- | --- | --- |
| 0 | Plans 01, 03, 04 shipped and verified in Phase 0. Write README and choose a licence (Open questions). Enable GitHub Issues. Create links-log.md | 01, 03, 04 |
| 1 | Directories and profiles: GitHub README with links (#14); AlternativeTo (#13); BGG web link (#12); Svelte Society submission (#15); join The Flying Kings and the ACF forum and read for a week without posting (#6, #7) | none |
| 2 | r/checkers post (#2) Tuesday morning US time. Same week: Introductions post on the ACF forum (#7) and a short message in The Flying Kings (#6). Log feature requests | 04 (bot-first flow must be live) |
| 3 | r/WebGames post (#3). No other subreddit. Fix the top two bugs reported in week 2 before posting; mention them in the post | bugs from week 2 triaged |
| 4 | Owner-written Show HN submission (#1), with time available for replies. Mention /puzzle only after its gate passes. Svelte Discord showcase message (#16) if its channel rules permit | Current HN policy; production gates; no open P1 bug; specific submission authorization |
| 5 | r/sveltejs post (#4), referencing the actual HN thread if relevant; dev.to write-up (#20). Use a canonical only to an actual original version of the same article, not an unrelated changelog page | Current venue rules and authorization; verified source URL if syndicating |
| 6 | Consider EDA (#8), ACF (#7), WCDF (#9) only after checking whether their resource lists accept Pure's rules variant. Consider lidraughts General Discussion (#11) and r/SideProject (#5) after reading current posting rules | Live rules explainer, confirmed ruleset fit and authorization for each destination |
| 7+ | Product Hunt (#19), awesome-svelte PR (#17), awesome-selfhosted (#18) once licensed, FMJD (#10). Second wave only after a real update worth a "major update" post | LICENSE decided |

### Phase 4 — Rules of engagement (effort: ongoing)

- Disclose authorship in the first line of every post and every profile. The drafts already do.
- Reply to every comment within 48 hours of posting; thank bug reports specifically and say when the fix shipped.
- Log every feature request under a "Requested" heading in CHANGELOG.md with the venue, then move it to the dated section when it ships. This is also the reply material for the next post.
- One subreddit per week, and never the same text twice. Reddit treats identical cross-posts as spam.
- No vote requests, no asking friends to upvote, no second accounts. HN and Reddit both detect rings; the site has one shot per community.
- Do not argue with negative comments about bugs; reproduce, fix, report back in the thread.
- Do not post in lidraughts Feedback, r/boardgames, or any federation forum's news board unless invited.
- Keep the swearing on the home page. HN readers will find the About section anyway; that is fine, it is the owner's site.

### Phase 5 — Content-led link earning for the long run (effort: 2–5 days per asset, spread over months)

| Future asset | Why it earns links unaided | Depends on | Build order |
| --- | --- | --- | --- |
| Rules explainer with interactive board diagrams | Clubs, federations, teachers and wikis link to rules pages, not to games. Answers the "how to play" queries GSC already shows | plan 02 | 1st |
| Daily puzzle (/puzzle) | One new indexable page per day; players share "did you solve today's"; HN/Reddit posts have something to do | plan 03 | already planned |
| Embeddable puzzle widget (iframe + snippet with a link back) | Every club site or blog that embeds it creates a followed link; the only asset that mechanically produces backlinks | plan 03 plus a static embed route | 2nd |
| "Beat the bot" challenge with a public leaderboard | Gives forums and Discords a competitive reason to link and return; ties to plan 04's bot-first flow | plan 04, registered accounts | 3rd |
| Open-data page (game stats, opening frequencies, win rates by first move) | Data pages get cited by writers and wikis; costs little once games accumulate | months of games | 4th |

Build the rules explainer first. It is the asset federations and clubs already link to on other sites (the EDA and ACF pages list rules and resources, not games), it turns the /strategy stub into a real page, and it strengthens the week-6 outreach emails. The widget is second because it only works once there is a puzzle with a month of history behind it.

### Phase 6 — Tracking (effort: 0.5 day setup, 15 minutes weekly)

- Search Console › Links › External links › Top linking sites. Check weekly; this is the referring-domain count for the success metric. Expect a lag of two to six weeks after a link appears.
- GA4 › Reports › Acquisition › Traffic acquisition, dimension "Session source / medium". HN and Reddit send referrers, so community posts use clean URLs (UTM parameters look promotional and get stripped or mocked). Use UTMs only where the referrer is lost: emails, directory profiles, Discord.
- UTM convention: `utm_source=<venue slug>` (hn, reddit-checkers, reddit-webgames, reddit-sveltejs, acf-forum, eda, flying-kings, alternativeto, bgg, github), `utm_medium=community|directory|outreach|social`, `utm_campaign=launch-2026-10`. Slugs are lowercase, hyphenated, never reused for a different venue.
- Maintain docs/growth/links-log.md as a single table:

| Date | Venue | URL | Status | Referral sessions |
| --- | --- | --- | --- | --- |
| 2026-10-06 | r/checkers | https://reddit.com/r/checkers/… | posted / live / removed / declined | 7-day count from GA4 |

Status values: planned, posted, live, removed, declined, in-GSC (once Search Console reports it). Update the sessions column at day 7 and day 30.

## Success metrics

| Metric | Where | 30 days from first post | 90 days |
| --- | --- | --- | --- |
| Referring domains | GSC Top linking sites | 4 | 10 |
| Referral sessions | GA4 Traffic acquisition, medium = referral | 300 | 1,000 cumulative |
| Launch-week conversion | GA4: sessions from hn / reddit sources that reach the plan 04 first-game-completion event | 30% of launch-week referral sessions | same, for every later post |
| Feature requests logged | CHANGELOG.md "Requested" section | 10 | 25, with at least 5 shipped |
| Organic clicks (side effect) | GSC Performance | 30 | 150 |

## Dependencies and risks

- Plan 01: OG image and sitemap. Without the image, every Reddit and Discord share renders blank.
- Plan 03: the puzzle is the URL the Show HN body points at; without it the post is only a home page.
- Plan 04: hard blocker. A launch post that sends 500 people to an empty lobby burns r/checkers, r/WebGames and HN in one afternoon, and none of them can be posted to again for months. Ship the bot-first first session before week 2.
- Plan 02: not a blocker for community posts, but the federation outreach in week 6 is much stronger with a real rules page to offer.
- Reddit self-promotion bans: mitigated by one subreddit per week, disclosure, and a week of reading and commenting before the first post. The owner's account should have some non-promotional history; if it has none, start week 1 by answering questions in r/checkers.
- HN timing: Show HN can sink without a trace. Post mid-week, morning US Eastern, reply fast, and do not repost the same day. If it gets no traction, a "major update" post is allowed months later; a duplicate is not.
- Negative feedback on bugs: expected and useful. Mitigation is the bug-report channel from Phase 0 and a rule of fixing the top two reports before the next post so each post can open with "since last time, fixed X and Y".
- Move-analysis claim: audit P3 says the rating pipeline is disconnected. Claiming it and being caught is worse than not mentioning it. Verify or drop the bracketed sentence.
- lidraughts positioning: it is 10x10 international draughts and open source; posting there as a competitor would be wrong and unwelcome. Post as a fellow no-ads project for the 8x8 crowd, once, in General Discussion.
- Owner time: each community post costs a real 48 hours of attention. Skip a week rather than post and disappear.

## Open questions

1. The GitHub repo prykris/purecheckers is already public but has no LICENSE and no README. Adding a README is free. Adding a licence is a genuine decision: an OSI licence (MIT, or AGPL if the owner wants forks to stay open) unlocks awesome-selfhosted, "source" links from HN commenters and the lidraughts-style open-source framing; keeping it unlicensed keeps it source-available only. Which?
2. Is the owner comfortable with the roommate story and the $5/month figure being quoted verbatim in posts? The drafts assume yes because both are already on the home page.
3. Which handle posts to HN and Reddit, and does that Reddit account have any history? A fresh account posting links is the most common reason self-promotion gets removed.
4. Bug-report channel: GitHub Issues, an email address on the domain, or a Discord? Issues is cheapest and doubles as public proof of maintenance.
5. Is move analysis actually visible on the live site today? Decide whether to restore it before launch (audit P3) or drop the claim.
6. Should the Spanish page /es be used for Spanish-language communities? "Damas" in Spain is a different variant (Spanish draughts); Latin American communities are closer to English rules. Leave out of the first six weeks unless the owner knows those communities.
7. Does the owner want to run Product Hunt at all? It is low value for a free hobby site and costs a day; it is in week 7+ only as an option.
