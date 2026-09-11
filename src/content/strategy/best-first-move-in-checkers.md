---
title: "Best First Move in Checkers: Why Start With 11-15?"
description: "11-15 is a useful candidate for the best first move in checkers. Compare all seven legal starts, recorded bot replies and a playable opening board."
category: openings
published: "2026-09-10"
updated: "2026-09-11"
primaryQuery: "best first move in checkers"
secondaryQueries:
  - "checkers first move"
  - "best opening move in checkers"
related:
  - checkers-rules
  - is-jumping-mandatory-in-checkers
  - double-jump-in-checkers
faq:
  - q: "Does the first move guarantee a win in checkers?"
    a: "No. The Chinook project established that the standard English-checkers starting position is a draw with perfect play. That result does not establish the outcome of Pure Checkers, which has different capture and king rules."
  - q: "What should the second player do after 11-15?"
    a: "Check the actual position and the rules you are using. This guide examines 24-19 and its forced exchange on Pure Checkers. It is a practice line, not a universal instruction for every opponent or variant."
  - q: "Is Old Faithful a different move from 11-15?"
    a: "No. Old Faithful is a traditional name for the first move 11-15. The numbers identify the checker’s starting square and destination; later replies determine the opening variation."
  - q: "Will the Hard bot always give the recorded reply?"
    a: "No guarantee. The recorded experiment completed depth six without a wall-clock limit. Live search has a time budget and uses its last complete iteration; tied best replies can also vary through random selection."
---
<script>
  import DiagramBoard from '$lib/components/DiagramBoard.svelte';
</script>

**Start with 11-15 if you want one useful first move to learn.** It develops a front-row man toward the centre and gives you a clear starting point for practising exchanges. Known as Old Faithful, it is a beginner recommendation rather than a promise that one opening move wins the game.

You have seven legal first moves. Understanding what they leave behind is more useful than memorising a ranking: two moves can reach the same destination while freeing different squares for the next piece. Below, you can try each move against the current bot and compare that experience with a recorded search experiment.

To practise a reply in a full game, use a free bot room. The [site FAQ](/faq) explains bot access and other playing options.

## The seven legal first moves

Only the front row can move at the start, because friendly pieces block the two rows behind it. Of those four men, the men on 9, 10 and 11 each have two destinations, while the man on 12 can only move to 16: two plus two plus two plus one makes seven moves. Different starting squares still count as different moves even when their destinations match.

The [NorthWest Draughts Federation opening guide](https://www.irishdraughts.org/openings.html) lists these traditional names and recommends 11-15 as a starting choice. The square numbers are the practical part to remember; names become more specific as both sides develop the position.

| First move | Traditional name | Square vacated |
| --- | --- | --- |
| 11-15 | Old Faithful | 11 |
| 9-14 | Double Corner | 9 |
| 10-15 | Kelso | 10 |
| 11-16 | Bristol | 11 |
| 10-14 | Denny | 10 |
| 9-13 | Edinburgh | 9 |
| 12-16 | Dundee | 12 |

In these diagrams, red starts on squares 1–12 and moves first. Square 1 is at the bottom right of the displayed board, and square 32 is at the top left. Read 11-15 as “move the man on 11 to 15.” If you learned with a board facing the other way, use the printed numbers rather than guessing from left and right. The [rules guide](/strategy/checkers-rules) covers setup and notation.

Select a red man and then its destination. The arrows illustrate the seven choices; they are not separate buttons. After your move, the Hard bot replies for black. Reset restores the initial board and cancels any pending reply.

<DiagramBoard
  position=".b.b.b.b/b.b.b.b./.b.b.b.b/......../......../r.r.r.r./.r.r.r.r/r.r.r.r."
  toMove="red"
  mode="try"
  bot="hard"
  numbered={true}
  arrows={['11-15', '9-14', '10-15', '11-16', '10-14', '9-13', '12-16']}
  caption="All seven legal first moves for red. Select a man and destination to play; Hard replies using the current bounded search, with a maximum depth of six completed turns. Reset to compare another opening." />

## What 11-15 develops

After 11-15, red has advanced one man and opened square 11 for a supporting piece. You can now examine the interaction between red on 15 and black's front row, instead of deciding among seven unrelated starts on every game. Keeping that first choice constant helps you notice the consequences of different replies.

One concrete continuation here is 24-19. Red must then capture 15x24; black can recapture with 28x19 or 27x20. The diagram chooses 28x19. This exchange removes one man from each side. Black's man on 19 at the end is the one that began on 28, not the man that first moved from 24.

<DiagramBoard
  position=".b.b.b.b/b.b.b.b./.b.b.b.b/......../......../r.r.r.r./.r.r.r.r/r.r.r.r."
  toMove="red"
  mode="step"
  numbered={true}
  moves={[
    { move: '11-15', note: 'Red develops a man and vacates 11.' },
    { move: '24-19', note: 'Black offers an exchange.' },
    { move: '15x24', note: 'Red must capture the man on 19.' },
    { move: '28x19', note: 'Black recaptures. Each side has lost one man.' }
  ]}
  caption="A verified Pure Checkers opening exchange: 11-15, 24-19, 15x24, 28x19. Step through the full sequence before judging who gained material." />

This line introduces an opening habit you can reuse: when a move offers a capture, finish the exchange before evaluating it. A piece left apparently undefended might be part of a deliberate trade. The [mandatory-jump guide](/strategy/is-jumping-mandatory-in-checkers) explains why you cannot decline the capture by developing another man.

## Compare 9-14 and 10-15

With 9-14, a different part of red's front row moves first. Before making a second move, identify which friendly men can fill the vacated square and which enemy advances create captures. Do not assume that a reply learned after 11-15 has the same tactical effect here: the red man is on another diagonal.

With 10-15, the destination matches Old Faithful but the starting square does not. Red still has a man on 11 and an empty square on 10. This changes which pieces can follow forward. Comparing those two boards is a simple way to learn why a position includes every piece, not just the most advanced one.

Try each start twice in the live board. In one run, focus on the moved man. In the other, look only at the squares it vacated and the friendly pieces behind it. That second view can reveal a blocked supporting piece or an opening for development that you missed while watching the opponent.

## What an edge move changes

The immediate limitation of 9-13 is visible on the board: a man on 13 has only one forward diagonal inside the board. A man on 14 has two geometric forward directions, although occupied squares and compulsory captures may reduce its actual choices. This is a reason to practise central development early, not a rule that touching the edge loses.

Be precise with 11-16 and 12-16. Square 16 lies near the other side but is not on an outside file in this orientation; from there, both 20 and 19 are geometrically forward. The two openings differ because they leave different men in place behind 16. Calling all these moves “the same edge mistake” conceals that difference.

Safety also depends on future moves. A man on an outside file cannot be jumped while it remains there, because a jump needs a landing beyond it. Once it steps inward, that protection disappears. A piece protected by the edge can still restrict its own side's development or be forced into an unfavourable exchange later.

## What our recorded bot search found

The following experiment used this site's current movement engine and bot evaluation on 10 September 2026. Each search began immediately after the listed red opening. It requested depth six, allowed 150,000 search nodes and disabled the wall-clock cutoff for repeatability. Every search completed depth six. The table lists all exactly tied best replies from those completed passes.

| Red opening | Highest-scoring black reply in this experiment |
| --- | --- |
| 11-15 | 24-19 |
| 9-14 | 24-19, 23-18 or 22-17 |
| 10-15 | 24-19 |
| 11-16 | 23-19 |
| 10-14 | 24-19 or 23-18 |
| 9-13 | 22-17 |
| 12-16 | 23-19 |

The [experiment record](/research/opening-search.json) contains every reply score, completed depth, node count, settings and hashes of the source files used. This is evidence of what that search calculated, not a survey of live games or a ranking established by expert tournament play.

Live games and the practice board retain a time limit. The bot searches progressively deeper and keeps results only from a complete pass. If it cannot finish depth six in time, it uses the last completed depth. When replies tie at that depth, it selects among them randomly. A changed search budget, position or evaluation can therefore produce a different answer.

The evaluation values a man at 1 and a king at 5, then adds smaller bonuses for advancement and central columns. Those values guide the search; they are not odds of winning. Its depth counts completed turns, including an entire forced capture chain within its turn. It does not simply stop in the middle of a double jump because two hops have been played.

A practical comparison is to record the opening, the reply and the first position where you had a capture choice. Ignore the speed of the bot’s animation when judging its answer. A quick reply can come from a small search tree, while a slower reply can come from more legal branches. Neither timing observation establishes the quality of the move.

## Use the opening to practise the next decision

The [five beginner opening lines](/strategy/checkers-openings-for-beginners) take this first move further, comparing exchanges, supporting moves and different replies on numbered boards.

Choose one first move for several practice games, then compare where your decisions start to differ. After a trade, recount the pieces and check whose turn it is. Before advancing another man, look for backward captures as well as forward captures on this site. The [double-jump examples](/strategy/double-jump-in-checkers) show why a single overlooked continuation changes an exchange.

Do not confuse this exercise with a solved-game claim. The [Chinook project](https://webdocs.cs.ualberta.ca/~chinook/project/) established a drawn starting position under standard English rules with perfect play. Pure Checkers uses backward captures for men and flying kings, so that result cannot be transferred to this variant. Your practical aim is to reach a position you understand and make the next move carefully.
