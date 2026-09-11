---
title: "Checkers vs Draughts: Names, Boards and Rules"
description: "Checkers and English draughts are the same game; international draughts uses a larger board. Compare named variants and see which rules Pure uses."
category: rules
published: "2026-09-10"
updated: "2026-09-11"
primaryQuery: "checkers vs draughts"
secondaryQueries:
  - "is draughts the same as checkers"
  - "difference between checkers and draughts"
related:
  - checkers-rules
  - can-you-move-backwards-in-checkers
  - how-do-kings-move-in-checkers
faq:
  - q: "Does the word draughts always mean a 10×10 board?"
    a: "No. English draughts uses an 8×8 board, as does Russian draughts. International draughts uses a 10×10 board. The variant name identifies the rules more accurately than the word draughts alone."
  - q: "Can I use an international draughts opening on an 8×8 board?"
    a: "Not as the same numbered move sequence. The boards have different square counts, starting positions and capture rules. Transfer an idea only after checking the moves on the actual board."
  - q: "Is Pure Checkers an official pool-checkers implementation?"
    a: "No. Pure has backward man captures and flying kings, but its promotion, capture handling and automatic draw conditions must be checked in its own rules. Similar movement does not establish complete compatibility."
  - q: "Do all checkers variants make you take the most pieces?"
    a: "No. English checkers and Pure Checkers allow a choice among available captures. International draughts requires a sequence taking the greatest number. In each case you must obey the continuation rules of the chosen variant."
---
<script>
  import DiagramBoard from '$lib/components/DiagramBoard.svelte';
</script>

**Checkers and draughts can mean the same game.** American checkers is also called English draughts. But *international draughts* is a different variant, with a larger board and different movement rules. Saying “I play draughts” does not, by itself, tell your opponent which game you mean.

The useful comparison is therefore between named rulesets. A familiar board can hide an unfamiliar backward capture; a familiar king can suddenly travel much farther. This guide compares the rules that change your decisions, shows the two board sizes, and identifies the game our practice boards actually play.

New to this board? The [quick setup guide](/#how-to-play) shows the basics, while the [site FAQ](/faq) explains the available ways to play.

## English checkers and international draughts compared

A *man* is an uncrowned piece. A *quiet move* is a move without a capture. *Flying kings* can travel along several empty squares of a diagonal instead of stepping to the next square only.

| Feature | English / American checkers | International draughts |
| --- | --- | --- |
| Board | 8×8; 32 playable dark squares | 10×10; 50 playable dark squares |
| Starting force | 12 men per player | 20 men per player |
| Quiet man move | One square diagonally forward | One square diagonally forward |
| Man captures | Forward only | Forward or backward |
| Quiet king move | One diagonal square | Any clear distance on a diagonal |
| Capture choice | Choose any available route | Take the greatest number of pieces |
| Promotion during a capture | Reaching the king row ends the turn | Continue as a man; crown only if the sequence ends on the king row |

These distinctions come from the [WCDF English rules](https://nccheckers.org/NCCA/WCDF%20Checker%20-%20Draughts%20-%20English%20Rules.htm) and the [FMJD international rules, Annex 1](https://www.fmjd.org/docs/Annex_1.pdf). Both make captures compulsory. In international draughts, equal-length capture routes do not gain priority merely because one takes a king.

The table helps identify a game; it does not replace its full regulations. Draw conditions, clocks and tournament procedures deserve a separate check, particularly before trying to reproduce a published endgame. For a beginner's explanation of the smaller-board game, start with our [checkers rules guide](/strategy/checkers-rules).

## See the difference between the boards

The illustrations show the starting arrangements at comparable display sizes. Count the rows rather than judging the apparent size of the pieces. On a phone the boards stack vertically; the international illustration remains a static reference.

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:24px;align-items:start">
<DiagramBoard
  position=".b.b.b.b/b.b.b.b./.b.b.b.b/......../......../r.r.r.r./.r.r.r.r/r.r.r.r."
  toMove="red"
  mode="static"
  caption="An 8×8 starting arrangement: 12 pieces per side occupy three rows. Shown in Pure Checkers colours; this static board does not demonstrate English movement." />
<figure style="margin:var(--sp-lg) 0;display:flex;flex-direction:column;gap:var(--sp-sm)">
<img src="/strategy/international-start.svg" width="400" height="400" style="width:100%;height:auto;display:block;border-radius:12px" alt="International draughts starting board: 10 rows and 10 columns, with 20 black men in the top four rows and 20 white men in the bottom four rows." />
<figcaption style="font-size:var(--fs-caption);color:var(--text-dim);text-align:center;line-height:1.5">International draughts: 20 pieces per side occupy four rows. This illustration is not playable.</figcaption>
</figure>
</div>

The extra rows change the starting position, not just its appearance. A diagram copied from a book needs its original board size. Likewise, a move number belongs to a particular numbering scheme: square 32 on these two boards is not a promise of the same geometric location.

When following one of our numbered 8×8 lessons, keep the numbers visible until you can identify the intended piece and destination. You do not need to memorise both numbering systems to enjoy either game. You do need to avoid placing a 10×10 move list onto an 8×8 board and expecting the same position.

## Four other variants that explain common disagreements

The smaller board is shared by several games. Its dimensions alone cannot answer whether a man may capture backward or whether a king can cross an entire diagonal.

| Variant | Board and pieces per side | Useful distinction |
| --- | --- | --- |
| Russian draughts | 8×8, 12 | Backward man captures, flying kings, free capture choice |
| Portuguese / Spanish family | 8×8, 12 | Forward man captures, flying kings, maximum capture with a king-count tiebreak |
| American pool checkers | 8×8, 12 | Backward man captures and flying kings; check continuation and crowning carefully |
| Turkish draughts | 8×8, 16 | Movement along rows and columns rather than diagonals |

In **Russian draughts**, reaching the last row during a capture can turn the man into a king that continues capturing in the same turn. The [IDF draughts-64 rules, sections 4.13–4.16](https://idf64.org/wp-content/uploads/2016/09/Official-Rules-of-the-game.pdf) distinguish Russian capture choice from the separate Brazilian maximum-capture rules. Do not treat every paragraph in that document as applying to both versions.

For **Portuguese and Spanish-style play**, the [FMJD-hosted Portuguese presentation](https://www.fmjd.org/downloads/pd/PD_rules.pdf) describes the shared family. Portugal's [2026 federation rules, articles 3.4 and 3.7](https://www.fpdamas.pt/wp-content/uploads/2026/04/RegrasDoJogoDeDamas_VD_MM_2026_03_29_FINAL.pdf) specify forward man captures, greatest quantity first, then quality when quantities tie. Here, taking more kings breaks a tie in the number of captured pieces. Confirm the local rulebook before a competition.

**Pool checkers** illustrates why “flying kings and backward captures” is an incomplete description. The [Draughts Association of Malawi's pool rules](https://admamalawi.weebly.com/game-rules.html), rules 9–11, require a man that can jump back away from the king row to continue as a man. They also require a flying king to choose a continuing landing square when one exists. Free choice of an initial capture does not mean permission to stop a sequence wherever you prefer.

**Turkish draughts** makes the visual difference especially clear: pieces travel horizontally or vertically. Its men occupy two full starting rows, with the back row empty, as illustrated in [Sultan Ratrout's FMJD-hosted variant survey](https://www.fmjd.org/downloads/variants/Checkers_families_and_rules_28-9-2018.pdf). The [Turkish rules published by the FMJD](https://www.fmjd.org/downloads/td/TD_eng.pdf) require maximum capture and remove each captured piece during the sequence. Diagonal tactics from this site's boards cannot be copied directly into that game.

## The rules used on Pure Checkers

<aside class="house-rules">
<p class="house-rules-label">On Pure Checkers</p>
<p>We use an 8×8 board with 12 men each, and red moves first. Men move quietly forward but capture in all four diagonal directions. Kings fly along diagonals. Captures are mandatory, with free choice among available captures and required continuation after landing. A man that reaches the king row is crowned and ends its turn.</p>
</aside>

Captured pieces leave our board after each jump. That can open a line which a rulebook leaving captured pieces in place until the end would still block. A flying king may choose any legal empty landing square beyond the captured piece; if another capture is available from its chosen landing, it must continue. That distinction matters when comparing our game with the pool landing restriction described above.

Pure also ends games automatically for three occurrences of the same position with the same player to move, or 50 consecutive turns without a capture. One player's move counts as one turn here; a complete multi-jump counts as one. A quiet man move does not reset that no-capture counter. Use our [full rules](/strategy/checkers-rules) when planning an ending rather than importing a tournament draw rule from a different game.

These details are why we describe Pure's rules directly instead of labelling the app an exact implementation of English, Russian or pool checkers. Every playable article diagram uses this same ruleset. Static comparison marks explain alternatives, but they do not switch the practice engine to a different game.

## Agree on the game before the first move

For an over-the-board game with someone new, a short agreement prevents most avoidable disputes. Name the variant, then check backward man captures, king range, capture choice and promotion during a jump. Set any clock and draw procedure before either player has a reason to prefer one interpretation.

For an online game, read its rules page even if its title looks familiar. Try a small example where the difference is visible: a man with an opponent behind it, or a king facing a distant target. Our [backward-capture lesson](/strategy/can-you-move-backwards-in-checkers) and [king-movement comparison](/strategy/how-do-kings-move-in-checkers) supply both illustrations and Pure practice positions.

When reviewing a lost piece, record the squares and the move that surprised you. Then ask which rule permitted it. That turns “we play different checkers” into a specific, learnable difference—and gives you a useful starting point for the next game.
