---
title: "Two Kings vs One in Checkers: A Win or a Draw?"
description: "Two kings vs one is not automatically a draw in checkers. Learn how the rules change the ending and practise a verified flying-king win on our board."
category: endgames
published: "2026-09-10"
updated: "2026-09-11"
primaryQuery: "two kings vs one king checkers"
secondaryQueries:
  - "can two kings beat one king in checkers"
  - "checkers double corner endgame"
related:
  - how-do-kings-move-in-checkers
  - checkers-rules
  - is-jumping-mandatory-in-checkers
faq:
  - q: "Is two kings against one automatically a draw?"
    a: "No. Piece counts alone do not establish the result. English checkers has winning two-king techniques, and the Pure Checkers position in this guide has a verified forced win. Check the rules, actual squares, side to move and draw history."
  - q: "Does the double corner make a lone king safe forever?"
    a: "No. A corner can restrict attack routes, but two coordinated kings may deny the defender a safe exit. The worked example closes the corner's two escape diagonals in sequence."
  - q: "Does failing to beat Hard prove that an ending is drawn?"
    a: "No. A bot game explores one continuation. It cannot prove that every possible attacking plan fails. The certificate in this guide proves one particular winning plan by checking every legal defensive reply."
  - q: "Does a king move reset the Pure Checkers draw counter?"
    a: "Only a capture resets the no-capture counter. Quiet king moves keep it running. The game ends automatically at 50 turns without a capture, or earlier if the same position and side to move occur three times."
---
<script>
  import DiagramBoard from '$lib/components/DiagramBoard.svelte';
</script>

**Two kings against one is not automatically a draw.** The result depends on the rules, the kings' squares, whose turn it is and any approaching draw condition. English checkers has winning two-king techniques. On Pure Checkers, flying movement changes those techniques; the example below proves a win from one specific position without assuming every two-against-one ending is won.

If you have spent a game chasing a lone king around a corner, the useful question is which escape route you can take away. Moving the nearest king toward it again may leave exactly the same exits. The aim is to coordinate your two pieces so that one controls a route while the other changes the position.

To practise the position in a full game, choose a bot or arrange a friendly room. The [site FAQ](/faq) explains both playing options.

## Identify the rules before using an endgame lesson

English-checkers kings make quiet moves one square at a time. Pure Checkers kings can slide along an empty diagonal and capture from a distance. A square that is safely out of reach in one game can be attacked immediately in the other. Review [how kings move](/strategy/how-do-kings-move-in-checkers) if you learned with short-range kings.

The [NorthWest Draughts Federation's endings lesson](https://www.irishdraughts.org/endings.html) explicitly demonstrates two kings beating a lone king under English rules. Its first diagram places the attacking kings on 18 and 19, with the defender on 32. The lesson's first move is 18-23. This is evidence against the blanket claim that a king in the double corner always holds a draw.

Do not copy that opening move into this site's game. From 32, a flying king can capture a red king that has moved to 23, because there are empty landing squares farther along the diagonal. The short-range English defender cannot make that same distant jump. Identical piece placement does not make the two rulesets strategically equivalent.

## The double corner has two routes to watch

Look at the corner around squares 32 and 28. From 32, a flying king can travel down the long diagonal toward 5, or step along the other diagonal to 28. From 28, it can return to 32 or travel along the diagonal toward 1. Those are the routes the worked plan will close.

At an endpoint, a piece cannot be captured along a diagonal that has no landing square beyond it. That makes endpoints useful defensive squares. It does not mean a defender can pass its turn to remain there indefinitely. Once all its available departures lead to capture, the lack of a passing move becomes decisive.

For the attacker, an exposed king can be a target even when it is several squares away. Before moving either king inward, inspect the defender's complete diagonal and its landing squares. You want to control exits without donating one of the pieces that makes your net work.

## A verified winning plan on Pure Checkers

In this constructed practice position, red has kings on 18 and 19; black has a king on 32. Red moves first. **Play 18-5.** The king on 5 now watches the long diagonal leading to 32. Black cannot capture it at the endpoint, and most of black's moves along that diagonal allow red to capture the lone king on the next turn.

<DiagramBoard
  position=".B....../......../......../..R.R.../......../......../......../........"
  toMove="red"
  mode="try"
  bot="hard"
  numbered={true}
  caption="Pure Checkers flying kings: red kings on 18 and 19, black king on 32, red to move. Try the verified plan beginning 18-5 against Hard. Reset starts with a fresh draw history." />

Black's more persistent defence is 32-28. Red responds 19-1, placing its second king at the far endpoint of 28's other diagonal. If black returns 28-32, red plays 1-28. Now the king on 28 occupies the side exit, while the king on 5 still watches the long diagonal. Black must leave 32 along that diagonal and be captured.

<DiagramBoard
  position=".B....../......../......../..R.R.../......../......../......../........"
  toMove="red"
  mode="step"
  numbered={true}
  moves={[
    { move: '18-5', note: 'Control the long diagonal from an endpoint.' },
    { move: '32-28', note: 'Black avoids an immediate capture by using the other corner square.' },
    { move: '19-1', note: 'The second king watches the other escape diagonal.' },
    { move: '28-32', note: 'Black returns to the corner.' },
    { move: '1-28', note: 'Occupy the side exit while the king on 5 covers the long diagonal.' },
    { move: '32-27', note: 'Black must leave the corner. Other legal departures also allow capture.' },
    { move: '5x32', note: 'Capture the last black king. Red wins.' }
  ]}
  caption="One longest defensive line in the verified Pure Checkers win. The plan uses both kings: 18-5 and 19-1 establish diagonal control, then 1-28 closes the remaining exit." />

The important move is not simply approaching the defender. Red first moves away from it to 5, then sends the other king to 1. Both are deliberate changes of angle. The final approach to 28 works because the first king has kept its diagonal covered throughout the plan.

## What if black chooses another move?

A line against a cooperative opponent is not a forced-win proof. After 18-5, black has six legal moves. Five allow an immediate winning capture; the remaining move leads to the corner plan above. This table gives one sufficient response to each choice, without claiming that it is the only possible winning capture.

| Black's reply after 18-5 | Red's response |
| --- | --- |
| 32-27 | 5x32 wins |
| 32-23 | 19x26 wins |
| 32-18 | 5x23 wins |
| 32-14 | 5x18 wins |
| 32-9 | 5x14 wins |
| 32-28 | 19-1, then follow the corner plan |

After 32-28 and 19-1, the same reasoning applies to black's next choice. Moving inward from 28 along its diagonal lets the king on 1 capture. Returning to 32 permits 1-28. After that move, every legal departure from 32 allows a capture by the king on 5.

The [complete verification record](/research/two-kings-proof.json) includes every defensive reply and a winning red continuation. It was generated using the actual game engine, including capture obligations and draw detection, then checked by replaying the certificate and comparing its defensive branches with the legal move list. The plan wins within seven single-hop turns from the initial position.

That result has a specific boundary: the diagram starts with no previous repetitions and a zero no-capture counter. It does not prove that the same board can still be won with one turn remaining before a draw. The record also says nothing about every other arrangement of three kings.

## When an extra king does not settle the question

Before applying the plan to a game already in progress, compare four details with the diagram. The three kings must occupy the same numbered squares, red must have the move, no different piece may occupy a landing square, and the draw history must leave enough time to finish. Matching only the visible piece count is not enough.

Suppose the board matches but black moves first. That is a different position for analysis: black can change which diagonal it occupies before red establishes the plan. Likewise, arriving at this arrangement late in a chase is different from opening the fresh practice board. The server retains the game's repetition history and no-capture count; Reset in an article creates a new exercise.

To check your understanding, hide the response table and list all six black replies after 18-5. Mark the one that avoids immediate capture. Then restore the board and explain why 19-1 answers that reply without exposing either red king to a legal jump. This exercise tests control of the routes, rather than memory of the displayed longest line.

If your proposed variation includes a sacrifice, account for the recapture before declaring it successful. A valid proof ends in a win against every legal defence; a promising diagram with an extra piece still needs that work.

Two kings can lose their advantage through a careless offer. In the starting diagram, 18-23 permits a distant capture from 32. Before choosing a move, check what remains after the opponent's complete turn. Having two crowns at the start does not protect you from ending the turn with only one.

Three kings give the attacker another piece to control a diagonal or block an exit, but a piece count still leaves out placement and history. A third king already under attack can disappear; a nearly expired draw counter can end play before a useful plan finishes. Look for a concrete route to capture or immobilisation rather than assuming the extra crown cancels every defence.

International draughts adds special limits for some small king endings. For example, its [FMJD rules, section 6](https://www.fmjd.org/docs/Annex_1.pdf), distinguish several material combinations with their own move counts. Those 10×10 limits are not the rules of this 8×8 app. An endgame video can be correct for its own game and still give the wrong advice for yours.

## Respect the draw counter while improving the position

Pure Checkers automatically draws after 50 turns without a capture, equivalent to 25 turns by each side, and on the third occurrence of the same position with the same player to move. Moving a king a long distance does not count as progress for the capture counter. Returning to a familiar position can also trigger repetition before the 50-turn limit arrives.

If you are trying to convert an advantage, give each quiet move a purpose: occupy an endpoint, cover a diagonal, force the defender to change routes or close an exit. A move that merely repeats the chase spends time without demonstrating improvement. The [full rules guide](/strategy/checkers-rules) explains the automatic draw conditions and how they differ from English tournament procedures.

Against a human, you can offer a draw when neither of you sees a productive continuation; the other player must accept it. Against a bot, the automatic rules settle drawn play. A bot's refusal to walk into a trap is useful practice feedback, but neither a long chase nor one failed attempt is a mathematical proof of a draw.

Practise the worked position until you can explain why each black departure is covered. Then reset and deliberately try a different red first move. Compare which escape route reopens or which capture you allow. Learning to account for every reply is the part of this ending that carries over to your next game.
