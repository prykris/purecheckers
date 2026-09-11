---
title: "How Do Kings Move in Checkers? Rules and Examples"
description: "Kings move one square diagonally in English checkers; Pure Checkers kings fly along clear diagonals. Try captures and promotion in playable diagrams."
category: rules
published: "2026-09-10"
updated: "2026-09-11"
primaryQuery: "how do kings move in checkers"
secondaryQueries:
  - "can a king move backwards in checkers"
  - "can a king jump multiple pieces in checkers"
related:
  - checkers-rules
  - is-jumping-mandatory-in-checkers
  - best-first-move-in-checkers
faq:
  - q: "Can a king move backwards in checkers?"
    a: "Yes. Moving backwards is the whole point of a king. A king may move and capture in all four diagonal directions, which is the one ability an ordinary man lacks in the standard game."
  - q: "Can a king jump multiple pieces in checkers?"
    a: "Yes, one at a time. A king that lands on a square from which another jump is available must continue jumping, changing direction as needed, until no further jump exists. It cannot jump two pieces that sit next to each other on the same diagonal, because there is no empty landing square between them."
  - q: "Can a king be captured in checkers?"
    a: "Yes. An opposing piece can capture a king when it has a legal jump and an empty landing square beyond. A king’s extra mobility does not make it immune, but an adjacent enemy alone does not prove it is capturable."
  - q: "Can a king move more than one square in checkers?"
    a: "Not in English or American checkers, where a king moves one square at a time. On Pure Checkers, kings are 'flying' kings and may slide any number of empty squares along a diagonal in one move."
  - q: "Do you have to move a king if you have one?"
    a: "No. A king is just one of your pieces. You may move any piece you like on your turn, with the usual exception that if any of your pieces can capture, one of them must."
---
<script>
  import DiagramBoard from '$lib/components/DiagramBoard.svelte';
</script>

A king in checkers moves one square diagonally in any of the four directions, forwards or backwards, and captures the same way, by jumping over an adjacent enemy piece to the empty square beyond. These are the movement rules for English and American checkers, described in [WCDF sections 1.16–1.21](https://nccheckers.org/NCCA/WCDF%20Checker%20-%20Draughts%20-%20English%20Rules.htm). Ordinary men move forward only; a king is a man that has earned the right to come back.

On Pure Checkers, kings fly along empty diagonals. The diagrams distinguish that movement from English one-step kings; each interactive board uses this site’s rules.

The [quick setup guide](/#how-to-play) introduces the board before promotion; the [site FAQ](/faq) covers bots and rooms for practising these king moves.

## How a piece becomes a king

A man is crowned when it reaches the last row on the far side of the board, the row its opponent started on. That row is often called the king row or the crownhead. On a board with the standard 1 to 32 numbering, red's men are crowned on squares 29 to 32 and black's on squares 1 to 4. (If that numbering is new to you, the [rules guide](/strategy/checkers-rules) explains it, including why square 1 sits at the bottom right on this site.)

Crowning happens the moment the man arrives, whether it arrives by a quiet move or by a jump. In a physical game a second piece is placed on top of it; online the piece simply gets a crown. From the next turn on it moves as a king.

One detail matters for tactics: crowning ends the move. If a man reaches the king row in the middle of a multi-jump, it is crowned and stops, even if the new king could jump again from where it landed. It may make that jump on your next turn, if the target is still there. English rules and Pure Checkers both stop it. Do not carry that convention into another variant without checking its promotion rules.

In the sequence below, the red man on 27 steps to 32 and is crowned. Black moves a man, and then the new king steps back to 27, a move no man could make.

<DiagramBoard
  position="
    ........
    ..r.....
    .......b
    ..b.....
    ........
    ....r...
    ........
    ..r....."
  toMove="red"
  mode="step"
  numbered={true}
  moves={[
    { move: '27-32', note: 'The man reaches the king row and is crowned.' },
    { move: '21-17', note: 'Black plays a waiting move.' },
    { move: '32-27', note: 'The king moves backwards, one square.' }
  ]}
  caption="Step through: red's man on 27 is crowned on 32, then returns to 27 as a king. Under English rules the king moves exactly one square; on Pure Checkers it could have travelled further along the same diagonal." />

## Movement: one square, any diagonal

Under English and American rules a king moves exactly like a man, except that it may move in all four diagonal directions instead of only forwards. One square per move, to an empty square, on the diagonals only. It cannot move sideways or straight ahead, it cannot pass over pieces, and it cannot move two squares unless it is jumping.

That sounds like a small upgrade. It is not. A man on the standard board has at most two squares it can move to; a king in the open has four. The practical benefit is the ability to retreat or change which side of the board it defends. Mobility still depends on occupied squares and compulsory captures: a king with four geometric directions does not necessarily have four legal moves.

The diagram shows a red king on square 18, near the centre. Toggle the illustrative highlights to compare reachable squares. This static comparison does not switch the app’s ruleset. Under the standard one-step rule it can move to 22, 23, 15 or 14. With flying kings, the rule on Pure Checkers, the same king can reach twelve squares, stopping only where a piece blocks the diagonal.

<DiagramBoard
  position="
    ...b.b..
    ....b...
    .......b
    ....R...
    ........
    r.......
    ........
    r.r....."
  toMove="red"
  numbered={true}
  variants={[
    { label: 'Standard (one step)', highlight: [22, 23, 14, 15] },
    { label: 'Pure Checkers (flying)', highlight: [22, 27, 32, 23, 25, 29, 15, 11, 8, 14, 9, 5] }
  ]}
  caption="Red king on 18. Standard rules: four possible moves, one square each. Flying kings: twelve, along every open diagonal until a piece gets in the way (the red man on 4 blocks the last square of the lower-left diagonal)." />

## Capturing with a king

Under English rules, kings capture adjacent opposing pieces in either diagonal direction and can change direction during a chain. Each hop needs an empty landing immediately beyond the target.

Everything from the [forced capture article](/strategy/is-jumping-mandatory-in-checkers) applies to kings. If any piece can jump, you must choose an available capture. The king must jump when it is the only piece that can capture, even into a recapture. If it can continue a chain, it must. If several captures are available, you may choose which piece captures and which route it takes. And a king is captured in exactly the same way as a man; there is nothing special about jumping a king except that you will enjoy it more.

Here is a king double jump. The red king on 14 jumps the black man on 18, landing on 23, and from there jumps the man on 26, landing on 30. Both hops advance toward red’s king row. An ordinary man can make this forward zigzag too; changing left-to-right diagonal direction is different from jumping backward.

<DiagramBoard
  position="
    .b......
    ....b...
    .......b
    ....b...
    .....R..
    ........
    ........
    ..r.r..."
  toMove="red"
  mode="step"
  numbered={true}
  moves={[
    { move: '14x23', note: 'First hop: capture 18 and keep the turn.' },
    { move: '23x30', note: 'Second hop: capture 26. Both hops go forward for red.' }
  ]}
  caption="Red king on 14 captures 18 and then 26 in a single move: 14x23x30. The landing squares 23 and 30 must both be empty for the chain to work." />

Two adjacent enemy pieces on the same diagonal cannot be jumped in one hop: the first has no empty landing immediately beyond it. This blocks that particular capture route in English checkers and here.

## What a king is worth depends on the position

A crown changes the legal moves, not the rules for winning. A trapped king can be lost; well-supported men can threaten promotion; a capture can pull a strong piece away from the square it needs to defend. Compare those concrete possibilities before deciding whether to exchange a king for men.

The bot on Pure Checkers gives a king a base value of 5 and a man a base value of 1 in its evaluation. Those numbers are a search heuristic, not a guarantee that any king is worth exactly five men. The bot also searches legal replies and applies smaller advancement and central-column bonuses. A forced loss can outweigh a favourable material count.

For your own decisions, check three things: where the king can safely land, what the opponent is forced to capture, and whether a man can reach the king row. Count the entire exchange. A king that takes two men and is then recaptured has not simply won two pieces for nothing.

The [double-jump guide](/strategy/double-jump-in-checkers) gives a verified sacrifice with supporting pieces that block unwanted continuations. Use that same attention to landing squares when trading kings. It is more dependable than applying a fixed numerical exchange rate to every board.

## Flying kings: the variant Pure Checkers uses

The one-step movement described above belongs to English rules. On this site a king may move any number of empty squares along a diagonal in one turn, and it captures from a distance.

<aside class="house-rules">
<p class="house-rules-label">On Pure Checkers</p>

**Movement.** A king slides along any diagonal as far as it likes, as long as every square it passes over is empty. The second diagram above shows the difference: twelve reachable squares instead of four from a central square.

**Capture.** A king may jump an enemy piece that is any distance away along a clear diagonal, provided every square between the king and that piece is empty and at least one square beyond it is empty. After the jump the king may land on any empty square beyond the captured piece along the same diagonal, not just the first one. If a further capture is available from the chosen landing square, the chain continues, so the choice of landing square is part of the move.

**Forced capture still applies.** Because a flying king sees the whole diagonal, it also has more captures to be forced into. If a king has the only available capture, you must use it. When several pieces or routes can capture, you choose among those legal options.

**Captured pieces leave after each hop.** The Pure Checkers engine removes a captured piece immediately. It does not leave it as a blocker until the end of the chain. Inspect newly opened diagonals before deciding the next landing.

**Men capture backwards too.** Kings are not the only difference from the English game: on Pure Checkers a man may jump backwards as well as forwards, although it still moves forwards only. The [rules guide](/strategy/checkers-rules) has the complete comparison.
</aside>

The position below shows a flying capture that is impossible in English checkers. The red king on 32 and the black man on 18 are three squares apart on the long diagonal with nothing between them. Click the king: the engine offers three landing squares, 14, 9 and 5, every empty square beyond the man. A one-step king could not have captured this piece at all without first walking up next to it.

<DiagramBoard
  position="
    .R......
    ........
    .......b
    ....b...
    ........
    ....r...
    ........
    ..r....."
  toMove="red"
  mode="try"
  numbered={true}
  caption="Pure Checkers rules. Red's king on 32 must capture the black man on 18 from a distance and may land on 14, 9 or 5. Click the king to see the choices; this move does not exist under standard rules." />

When a flying king shares a diagonal with your piece, check its landing squares before moving. You can deliberately offer that piece if the resulting exchange helps you, but first calculate the complete capture route and your reply.

## Three checks before moving a king

**Look along the whole diagonal.** With a flying king, a distant opponent can be a legal capture even when nothing is adjacent. First find the opposing piece, then check the empty landing squares beyond it. A friendly blocker or a second adjacent enemy can close that route.

**Examine the landing, not just the target.** Different landings beyond the same captured piece can produce different continuations. One may force another jump while another ends the chain. Step through each route before deciding which position you want. The longest-looking move is not automatically the safest.

**Remember the draw rules.** Moving a king back and forth does not keep a game going forever. Pure Checkers automatically ends a game when the same position with the same side to move occurs three times, or after 50 turns without a capture. Promotion alone does not reset that capture counter. The [rules guide](/strategy/checkers-rules) distinguishes those automatic conditions from English tournament draw procedures.

Use Reset to compare another flying-capture landing.
