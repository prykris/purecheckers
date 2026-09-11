---
title: "Is Jumping Mandatory in Checkers? The Forced Capture Rule"
description: "Jumping is mandatory in English checkers and Pure Checkers. Learn which captures you can choose, when a chain ends, and try the rule on a live board."
category: rules
published: "2026-09-10"
updated: "2026-09-10"
primaryQuery: "is jumping mandatory in checkers"
secondaryQueries:
  - "do you have to jump in checkers"
  - "forced capture rule checkers"
related:
  - checkers-rules
  - how-do-kings-move-in-checkers
  - best-first-move-in-checkers
faq:
  - q: "Do you have to jump in checkers even if it loses you a piece?"
    a: "Yes. The rule does not care whether the jump is good for you. If a capture is available on your turn, you must make one, even when your opponent has set it up so that your piece is recaptured, or so that the jump pulls your piece out of a defensive position. Using that against you is one of the oldest tricks in the game."
  - q: "Can you refuse a jump if you have two jumps available?"
    a: "No. Having two jumps available does not give you the option of making neither. You must make one of them. What you may choose is which one, and in English and American checkers you may choose the smaller capture even when a longer multi-jump is available."
  - q: "What happens if a player does not jump in checkers?"
    a: "On Pure Checkers, a quiet move is rejected when a capture is available. In an English-rules tournament, omitted captures are illegal moves handled under the event’s referee procedures; they are not automatically treated as the historical huffing penalty."
  - q: "Is jumping mandatory for kings too?"
    a: "Yes. Forced capture applies to every piece you own. If your only available capture is with a king, you must make it with the king, even if it drags the king to a square where it is lost."
  - q: "Does a jump have to be made by the piece that could have moved somewhere else?"
    a: "The obligation belongs to the player, not to a particular piece. If any of your pieces can capture, you must capture with one of the pieces that can. Pieces that cannot capture cannot move at all that turn."
---
<script>
  import DiagramBoard from '$lib/components/DiagramBoard.svelte';
</script>

**Yes. Jumping is mandatory in English checkers and Pure Checkers.** If any of your pieces can capture on your turn, you must choose an available capture. You cannot make a quiet move instead merely because the jump loses material. Once you begin a chain, the same piece must continue while it has another legal capture, with the promotion exception explained below.

This makes an offered piece a tactical decision for both players. The defender must capture, but may have a choice of pieces or routes. To force one particular reply, the attacker must check that no alternative capture exists. A sacrifice works through the complete position, including pieces that block landing squares.

## The rule and the choice it leaves you

[WCDF English rules 1.19–1.20](https://nccheckers.org/NCCA/WCDF%20Checker%20-%20Draughts%20-%20English%20Rules.htm) require capture and completion of a started chain, while allowing a choice between capture routes without requiring the largest count. Pure Checkers follows those principles, with different movement rules for men and kings.

If you learned optional jumping at home, agree which rules you will use before starting. Allowing a player to decline a capture changes which replies an attacker can force. It does not make every sacrifice impossible, but it means a combination cannot rely solely on the opponent being obliged to accept an offer.

The [home-page introduction](/#how-to-play) gives the basic setup, and the [site FAQ](/faq) covers playing options. The examples below focus on the decision you face when a capture is already available.

## What "forced capture" means on the board

For an ordinary piece on this site, a capture is a jump: your piece moves diagonally over an adjacent enemy piece and lands on the empty square immediately beyond it. The jumped piece is removed. Forced capture means that if any such jump exists for any of your pieces, your move this turn must be a jump.

The clearest way to see it is a position where you would rather do something else. Below, red has three ordinary moves available on paper (15-18, 12-16 and 10-14), but the red man on 15 can jump the black man on 19. So none of those quiet moves is legal. Click on the man on 10 or 12 and the board will tell you it cannot move; click on 15 and the only square offered is 24, the landing square of the jump.

<DiagramBoard
  position="
    .b......
    b.......
    ...b....
    ..b.....
    ...r....
    r...r...
    ........
    ........"
  toMove="red"
  mode="try"
  numbered={true}
  caption="Red to move. Red would like to play 10-14 or 12-16, but the man on 15 can jump the black man on 19, so 15x24 is the only legal move. Try clicking the other red men." />

Notice what happens next. After 15x24, the black man on 28 is now sitting diagonally next to the red man on 24 with an empty square behind it, so black must jump back: 28x19. A single forced capture has turned into an exchange, one piece for one piece, in the resulting position. This example has only one legal red capture and then one legal black reply; positions with more choices need a separate check.

A blocked landing is not a capture: neither a friendly piece nor an enemy piece can occupy the square you need to land on. Check that condition before treating a target as compulsory.

## Choosing between two captures

Sometimes two or more captures are available at once. The rule then says you must take one of them, and in English and American checkers you may choose which. There is no requirement to take the capture that removes the most pieces. International draughts instead requires the greatest number of captures; see [FMJD rule 4.13](https://www.fmjd.org/docs/Annex_1.pdf). Confirm the variant before choosing a route.

In the position below, the red man on 14 has two captures: it can jump the man on 17, landing on 21, or jump the man on 18, landing on 23. The second capture does not stop there. From 23 the same man can jump again over 27 to 32, and 32 is on the far edge of the board, so the man is crowned on arrival. Under English rules red may take either capture. The single jump to 21 is legal. This diagram demonstrates the choice, not a proof of which continuation wins against best defence.

<DiagramBoard
  position="
    .....b..
    ..b.b...
    ........
    ....b.b.
    .....r..
    ......r.
    .......r
    ........"
  toMove="red"
  mode="try"
  numbered={true}
  caption="Red to move and must capture. 14x21 takes one piece; 14x23 takes one piece and then continues 23x32, taking a second and crowning the man. Both choices are legal here. Compare their final positions and the opponent’s replies before judging them." />

Compare the final landing, the material taken and the opponent’s legal replies for each route. A longer capture can leave the moving piece exposed; a shorter one may preserve a defender. Legality and quality are separate questions.

## Multi-jumps: once you start, you finish

A jump that lands on a square from which the same piece can jump again must continue. This is the multi-jump, or chain capture, and the rule is strict: you cannot stop halfway. If the man on 14 above takes the piece on 18 and lands on 23, it must then take the piece on 27 as well. You do not get to leave a piece on 23 because you have decided one capture is enough.

Two details matter here.

First, the chain is one move. Your opponent does not get a turn between the jumps, and a piece cannot be jumped twice in the same move. Pure Checkers removes each captured piece immediately. English rules describe removing the captured pieces at the end of the sequence. Removal timing can matter in variants with flying kings because a vacated square can open another diagonal.

Second, crowning ends the chain. If a man reaches the far row during a multi-jump, it is crowned and the move is over, even if the new king could immediately jump again from the crowning square. That further capture has to wait for your next turn, and by then your opponent may have moved the piece away. In the diagram above the man that lands on 32 is crowned there and stops. That stopping rule is shared by English checkers and this site; do not assume every other variant handles promotion in the same way.

Multi-jumps are also where the "choose your capture" rule bites: you choose the starting jump, and then the chain follows wherever it leads. If two chains start with the same first jump and fork later, you choose again at the fork. Where the fork leads to captures of different lengths, English rules still let you pick either branch.

## Missing a jump and the old huffing penalty

Huffing is the historical idea of removing a piece that failed to make a required capture. The [NorthWest Draughts Federation rules summary](https://www.irishdraughts.org/rules.html) notes that modern omitted-capture rules supersede huffing. It is not how Pure Checkers handles an attempted quiet move when a jump exists.

On this site, the move must be legal before the server accepts it. Your opponent does not gain a separate right to delete a piece. In an over-the-board event, ask the referee to apply that event’s illegal-move procedure. The full WCDF rules include cautions, penalties and conditions for a move being condoned; an informal take-back is not a complete description of tournament procedure.

## On Pure Checkers

The capture obligation is familiar, but the set of available captures depends on the movement rules. These are the details to check on this site.

<aside class="house-rules">
<p class="house-rules-label">On Pure Checkers</p>

**Captures are forced here too, and enforced.** The engine never offers you a quiet move when a jump exists. In these practice diagrams, selecting a noncapturing piece produces an explanatory notice. Select a capturing piece to see its legal landing squares. Multi-jumps are enforced the same way: after the first jump, the only piece you can move is the one mid-chain, and its only moves are the next jumps.

**Men capture backwards.** In the standard English game a man may only jump forwards. On Pure Checkers a man may jump in all four diagonal directions, forwards and backwards, under this site’s rules. Combined with forced capture this matters a lot: a black piece that slips in behind your man is a piece your man may be obliged to jump backwards, and a chain capture can zigzag back and forth across the board. Check behind you as well as in front.

**You choose freely between captures.** As in English rules, there is no majority rule. When several captures exist, you pick one, and you may pick the shorter one.

**Kings capture from a distance.** Kings here are "flying" kings: a king may jump an enemy piece that is any distance away along a clear diagonal and land on any empty square beyond it. That still counts as a capture, so it is still forced. The [kings article](/strategy/how-do-kings-move-in-checkers) has the diagrams.
</aside>

The [backward-capture guide](/strategy/can-you-move-backwards-in-checkers) isolates a jump that is legal here but unavailable to an English-rules man.

## Putting the rule to work

Practise the [verified two-for-one sacrifice](/strategy/double-jump-in-checkers): offer one man, finish the opponent’s forced turn and take two in reply. Check the supporting pieces that block unwanted landings. The pattern works because of those details, not merely because the opponent has to jump.
