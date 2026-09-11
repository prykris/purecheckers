# Puzzle explanation review — 11 September 2026

This review covers the six shared theme paragraphs and all 31 entries in `data/puzzles/launch-buffer.json`, dated 10 September–10 October 2026. Each entry now has an individual tactical note. Positions, solution definitions, dates, difficulty, search evidence, source identity and original generation versions are unchanged. Generator 1.2.3 supplies the corrected wording for future drafts; it does not pretend to regenerate the reviewed artifact.

## What changed

- Theme text describes the house rules without promising that a promotion, material advantage or apparent threat wins. A compulsory capture can have several legal branches. Crowning ends a turn, including a capture chain.
- Solution narration identifies an offered king correctly. It reserves “must take” for a position with exactly one legal complete turn. The game is described as continuing when the solution merely reaches a tactical gain.
- Alternative narration now identifies captured men and kings, crowns and the actual remaining forces. It reconstructs those facts through legal engine turns instead of trusting cached annotations. An illegal continuation stops generation; an incomplete or bounded search result is not presented as an exact sample.
- The two displayed alternatives remain short examples from the commentary search, not complete refutations. That search uses depth five; the verified solution uses its separately recorded deeper search. Material at a sample endpoint is not an evaluation score or a proof of the eventual result. Missing examples are disclosed without inventing replies.
- Generic instructions about capture chains were removed from every position paragraph. Individual notes explain which pieces prepare, sacrifice, recapture or crown, and separate the required solution from the optional continuation.

## Review by position

The review compared the prose with starting pieces, every complete solution turn, legal reply counts, captured pieces, promotion and the final board. Every existing continuation and both alternative examples were replayed from their correct starting position.

| Date | Specific point checked in the revised explanation |
| --- | --- |
| 2026-09-10 | Quiet preparation 19-24 before 24x31; Black has five replies |
| 2026-09-11 | Captures the king on 17 and man on 26; Red still has fewer pieces |
| 2026-09-12 | Immediate promotion; Red already has a king |
| 2026-09-13 | Sacrifice, double jump, recapture and promotion involve different black men |
| 2026-09-14 | First double jump is followed by a forced red capture and a different black man's crown |
| 2026-09-15 | Quiet promotion; both alternative samples leave Black without a king |
| 2026-09-16 | Six pieces each afterward, with one red man converted to a king |
| 2026-09-17 | Man on 8 prepares; man on 15 collects the capture |
| 2026-09-18 | Two-jump man route removes 15 and 24 without crowning |
| 2026-09-19 | 5-1 crowns; the 28-24 sample instead loses the advanced man on 24 |
| 2026-09-20 | Two legal black capture replies; the shown defence permits a three-jump collection |
| 2026-09-21 | Flying king's distant landings differ from the captured squares |
| 2026-09-22 | 16-12 prepares the crown; both other legal choices move the man on 23 |
| 2026-09-23 | Promotion is the answer; subsequent king captures are optional study |
| 2026-09-24 | Final king capture removes Black's last piece and actually ends the game |
| 2026-09-25 | Double jump and crown leave Black with fewer pieces, but a new king |
| 2026-09-26 | One-turn promotion is distinct from the king's later sample capture chain |
| 2026-09-27 | Red has another legal capture; its king on 29 survives the combination |
| 2026-09-28 | Three landings form one turn and leave the capturing piece a man |
| 2026-09-29 | Black's new second king faces two existing red kings |
| 2026-09-30 | Promotion and the later sample exchange are separate events |
| 2026-10-01 | Sacrificing and collecting men differ; Black has two legal capture replies |
| 2026-10-02 | Removes a king on 16 and man on 8, then crowns on 4 |
| 2026-10-03 | Promotion changes mobility without equalising the piece count |
| 2026-10-04 | One forced black reply; a different red man returns to the offered square |
| 2026-10-05 | Lone king takes three men but leaves two; the game continues |
| 2026-10-06 | New king on 2 joins the existing king on 3 |
| 2026-10-07 | Both sides have a king after Black's promotion |
| 2026-10-08 | King on 30 prepares; man on 11 captures; king remains on 25 |
| 2026-10-09 | Crown on the second landing ends the turn; later captures are separate |
| 2026-10-10 | Second king joins the one on 3; the required move captures nothing |

## Evidence and limits

**84 tests across six files pass** (`.generated/tests-puzzle-editorial.log`): commentary, deterministic generation, import validation, source attribution, actual-controller playthrough of every launch solution and page policies. The new commentary cases cover an offered existing king, multiple legal capture replies, stale capture/after-state annotations, terminal alternative outcomes, incomplete/bounded results and illegal continuations. All 31 stored solution/continuation texts and 62 alternative samples are legally replayed. This is not a new exhaustive deep-search proof of the alternatives.

The production build passes (`.generated/build-puzzle-editorial.log`), with the existing adapter unused-import warning. No full-suite rerun or new hydrated-browser acceptance is claimed.

The comparison report (`.generated/puzzle-editorial-audit.json`, produced by `.generated/audit-puzzle-editorial.mjs`) confirms all 31 non-commentary definitions are identical to the pre-review artifact. Each explanation has at least **335 words**; the six theme paragraphs have **98–104 words**. Excluding theme text and sentences repeated verbatim in another buffer entry leaves at least **153 words per puzzle**. This sentence comparison is an explicit textual duplication check, not a measure of originality, search quality or indexing. Individual tactical notes were reviewed against the board facts above.

No existing database rows were rewritten. The [import policy](puzzles.md#commands) still rejects conflicting content at an existing position/date. Production import, owner acceptance, runner/monitoring activation and the feedback destination remain outstanding. The dates in this local artifact are not evidence of a deployed publication schedule.

Manual acceptance after publication: open an archive explanation, follow the numbered solution on its board, and compare the alternative captures and crowns. Today's explanation should remain hidden until solving or revealing. Use one sacrifice puzzle and one promotion puzzle when those dates become available; do not expose future pages to perform this check.
