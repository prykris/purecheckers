---
title: "Double Jump in Checkers: Find and Finish the Chain"
description: "A double jump in checkers captures two pieces with the same checker in one turn. Step through verified examples, a sacrifice and a triple-jump exercise."
category: tactics
published: "2026-09-10"
updated: "2026-09-11"
primaryQuery: "double jump in checkers"
secondaryQueries:
  - "multiple jumps in checkers"
  - "triple jump in checkers"
related:
  - is-jumping-mandatory-in-checkers
  - can-you-move-backwards-in-checkers
  - how-do-kings-move-in-checkers
faq:
  - q: "Does a double jump count as two turns?"
    a: "No. The same piece makes both jumps during one turn. Your opponent moves after the complete capture chain ends, unless the game has already finished."
  - q: "Can I switch checkers after the first jump?"
    a: "No. If another capture is available to the piece that just landed, that piece must continue. You cannot transfer the rest of the turn to a different checker."
  - q: "Can I stop a chain when my man becomes a king?"
    a: "In English checkers and Pure Checkers, crowning ends that turn. This is a specific promotion rule, not permission to stop an ordinary chain whenever you want."
  - q: "Must I choose a double jump over a single jump?"
    a: "English checkers and Pure Checkers allow a choice among available captures without requiring the largest count. After choosing, you must complete that piece's available chain. Other variants can require the longest capture."
---
<script>
  import DiagramBoard from '$lib/components/DiagramBoard.svelte';
</script>

**A double jump captures two opposing pieces with the same checker during one turn.** Jump the first piece, land on an empty square, then jump the second piece from that new position. If that second capture is available to your landing piece, you cannot stop early or let your opponent move between the jumps.

The useful pattern is an alternating sequence: opposing piece, empty landing square, opposing piece, empty landing square. The path can change diagonal direction at a landing square. These constructed practice positions have been replayed through the Pure Checkers engine; they are teaching examples, not attributed tournament games.

For practice beyond these positions, the [site FAQ](/faq) explains how to start a game against a bot or a friend.

## Follow one piece through the whole turn

In the first board, red's man on 14 jumps the black man on 18 and lands on 23. From 23 it can jump the black man on 26 and land on 30. Both jumps go forward for red, even though one goes diagonally left and the other diagonally right. An ordinary man can make this sequence under English rules as well as here.

<DiagramBoard
  position=".b....../....b.../......../....b.../.....r../......../......../r......."
  toMove="red"
  mode="step"
  numbered={true}
  moves={[
    { move: '14x23', note: 'Capture 18. Red keeps the turn because this same man can jump again.' },
    { move: '23x30', note: 'Capture 26 and crown on 30. The complete move is 14x23x30.' }
  ]}
  caption="Constructed double jump: 14x23x30 captures the black men on 18 and 26. Next shows one hop at a time; both hops belong to the same red turn." />

The intermediate square matters. Writing only “14 to 30” hides the route, the captured pieces and the requirement that 23 be empty. Capture notation uses an x between successive landing squares: 14x23x30. A hyphen, as in 11-15, describes a quiet move. The [rules guide](/strategy/checkers-rules) explains the board numbers if you need a reference beside the diagram.

On an interactive board, complete the first jump and look for the next highlighted landing square. The moving piece remains active during a chain. Selecting a different friendly piece will not hand it the rest of your turn. If you are playing with a clock, decide the complete route before starting so you do not spend your remaining time discovering the second jump.

## Build a double jump with a sacrifice

A sacrifice can place an opponent on a square where your next capture starts a chain. It works only if you examine every legal response to the offer. “They will probably take this way” is a prediction; a forced reply is a property of the position.

The next example makes the reply explicit. Red offers 15-18. Black has only 22x15. Red then plays 10x19x26, taking the black men that end up on 15 and 23. Red has given up one man and taken two, gaining one piece in the exchange. This is a local material result; it is not a claim that every remaining move wins automatically.

<DiagramBoard
  position=".b....../......../...b.b../......../...r.r../....r.../.....r../........"
  toMove="red"
  mode="step"
  numbered={true}
  moves={[
    { move: '15-18', note: 'Offer a man. Red has checked the complete forced reply.' },
    { move: '22x15', note: 'Black has exactly this capture. The red man on 6 blocks a further jump.' },
    { move: '10x19', note: 'Red takes the man that just arrived on 15.' },
    { move: '19x26', note: 'Continue over 23. Red has traded one man for two.' }
  ]}
  caption="Constructed two-for-one: 15-18, 22x15, 10x19x26. Red's supporting men on 14 and 6 make the intended capture route work; they are essential parts of the position." />

Look at the supporting men rather than treating them as decoration. Red on 14 blocks black's alternative landing after a jump from 23 over 18. Red on 6 blocks a continuation from 15 over red's man on 10. Without that second guard, black would take the piece intended to make red's double jump. The tempting combination would collapse before red got another turn.

That gives you a practical method for checking a sacrifice: move the offered piece in your mind, list the opponent's captures, finish each possible chain, then inspect your recapture. Do not stop your calculation when the opponent takes the bait. The end of their whole turn is the position you actually get to play.

## Find the gaps behind the targets

A pair of enemy pieces is not enough. Each target needs an empty square beyond it along your route. Two enemy pieces touching on the same diagonal cannot both be crossed in one hop. A landing occupied by either colour stops that jump, even if the next target looks perfectly lined up.

Work backward when searching for a combination. Choose a target you would like to take second. Find a square from which your checker could jump it. That square becomes the desired landing of your first jump. Now look for an opposing piece that connects your current checker to that landing. This approach reduces the number of unrelated moves you have to examine.

On Pure Checkers, include backward captures in that search. A man can jump forward and then backward during a chain, provided it has not crowned. Read the [backward movement guide](/strategy/can-you-move-backwards-in-checkers) before importing a combination from English checkers: extra capture directions can change both the attack and the defence.

## A triple-jump exercise

A triple jump uses the same process with one more landing. In this constructed position, find a route for red's man on 6 that takes all three black men in the central zigzag. The black man on 32 stays out of that route, so finishing the combination does not mean every opposing piece has disappeared.

<DiagramBoard
  position=".b....../....b.../......../....b.../......../....b.../.....r../r......."
  toMove="red"
  mode="try"
  numbered={true}
  caption="Find the triple jump starting on 6. This constructed exercise uses Pure Checkers rules and lets you control both colours; Reset restores the starting position." />

<details>
<summary>Show the triple-jump route</summary>

Play 6x15x22x31. The captured pieces are on 10, 18 and 26. Red crowns on 31, ending its turn. Each landing is empty when needed, and all three hops go forward. Count the captured men separately from the landing squares to check your reading of the notation.

</details>

Try naming the next landing before clicking it. Once you can see the whole route, reset and explain why each black piece is vulnerable. The goal is to recognise the spacing, not simply remember three numbers from this particular board.

## Check a blocked landing before you calculate

Return to the first example and imagine a friendly red piece occupying 23. The black man on 18 would no longer be capturable from 14: the destination is occupied, regardless of colour. Now imagine that 23 is empty but 30 is occupied. The first jump could exist while the second one could not. These are two different positions, so they require two different calculations.

You can apply the same check without moving any pieces. Cover the later part of a diagram with your hand and identify the first legal landing. Then uncover the next target and find the second landing from that square. This prevents a common reading error: tracing both jumps from the checker’s original square instead of updating its location after each hop.

When a chain branches, pause at the fork. Compare the available landing squares from the piece’s new position, not just the number of targets visible at the start. The compulsory-capture rule still permits a choice where the ruleset allows one. It does not mean the board chooses a single route on your behalf.

## Defend against the complete chain

Before making a quiet move, check every capture you would give the opponent. Trace each one until the piece can no longer jump. A move that loses only one man on the first hop can lose several by the end of the turn. Moving a guard can be as dangerous as moving the target itself, because the guard may have occupied a critical landing square.

Avoid treating every available double jump as a good move for you, either. The opponent may recapture the landing piece, force it away from a promotion square or gain a stronger king. Count the net exchange and examine the final position. Where you have a choice of captures, compare those complete results instead of choosing the longest-looking animation.

For the formal obligation to continue and the exception when a man crowns, consult [WCDF rules 1.19–1.20](https://nccheckers.org/NCCA/WCDF%20Checker%20-%20Draughts%20-%20English%20Rules.htm). Pure Checkers also ends a man's turn on promotion. Its flying kings add more landing choices, covered in the [king movement guide](/strategy/how-do-kings-move-in-checkers); the basic habit remains the same: find every landing before committing the first jump.
