---
title: "Checkers Rules: How to Play on the 8×8 Board"
description: "Learn checkers rules for the 8×8 board: setup, movement, forced jumps, kings and draws. Compare English rules with Pure Checkers in step-through diagrams."
category: rules
published: "2026-09-10"
updated: "2026-09-10"
primaryQuery: "checkers rules"
secondaryQueries:
  - "how to play checkers"
  - "checkers rules 8x8"
related:
  - is-jumping-mandatory-in-checkers
  - how-do-kings-move-in-checkers
  - best-first-move-in-checkers
faq:
  - q: "Who goes first in checkers?"
    a: "WCDF English rules specify red and white pieces, with red moving first; older literature also calls the first side Black. In casual play the convention varies and many sets label the pieces red and black, with black or red first depending on the house. On Pure Checkers red always moves first, so the standard numbering is drawn with red on squares 1 to 12."
  - q: "Can a regular piece move backwards in checkers?"
    a: "Not in the standard game: a man moves diagonally forward only and captures forward only. It has to be crowned before it can go back. On Pure Checkers, a man may capture backwards while its quiet moves still go forwards."
  - q: "What happens when you cannot move in checkers?"
    a: "You lose. A player whose turn it is and who has no legal move, because every piece is blocked or captured, loses the game. There is no stalemate draw in checkers as there is in chess."
  - q: "How many pieces does each player have in checkers?"
    a: "Twelve each on the 8×8 board, placed on the dark squares of the three rows nearest the player. Only the dark squares are ever used; the 32 light squares play no part in the game."
  - q: "Is checkers the same as draughts?"
    a: "Yes. Draughts is the British name and checkers the American one for the same 8×8 game, and the rules are identical. The word draughts is also used for the larger 10×10 international game, which is a different variant."
---
<script>
  import DiagramBoard from '$lib/components/DiagramBoard.svelte';
</script>

Checkers is played on the 32 dark squares of an 8×8 board. Each player starts with twelve pieces, moves one piece diagonally forward per turn, captures by jumping over an enemy piece, and must capture whenever a capture is available. A piece that reaches the far side becomes a king and may move backwards. You win by capturing all of your opponent's pieces or by leaving them with no legal move.

The examples below use this site’s movement engine. The comparison table identifies where English rules differ.

If you only want the two-minute version, the [home page](/#how-to-play) has it. The [FAQ](/faq) covers accounts, ratings and rooms. This page is the rules.

## The board and setup

Use an 8×8 board with a dark square at the bottom left. Play only on dark squares. The near-left side is called the single corner, and the near-right side the double corner; their geometry affects endgame routes without guaranteeing safety.

Each player has twelve pieces, called men, placed on the dark squares of the three rows nearest them. The two middle rows start empty. The pieces are traditionally black and white, or black and red; on this site they are red and black.

### Who moves first

[WCDF rules 1.9 and 1.13](https://nccheckers.org/NCCA/WCDF%20Checker%20-%20Draughts%20-%20English%20Rules.htm) specify red and white pieces, with red moving first. Older literature also refers to that first side as Black. Casual sets disagree with each other and with the rule book, so it is worth stating the convention wherever you play. On Pure Checkers, red always moves first.

### Square numbers and notation

Checkers writing refers to squares by number. The 32 dark squares are numbered 1 to 32, four per row, starting from the top-left corner of the board as seen by the player who moves second. The player who moves first starts on squares 1 to 12, the player who moves second on 21 to 32, and the two empty rows in between are 13 to 20. Moves are written from-to, so 11-15 means the piece on square 11 moves to square 15, and a capture is written with an x: 15x24.

On this site red moves first and is drawn at the bottom of the screen, so the numbering runs from red's point of view: square 1 is at the bottom right (red's double corner) and square 32 is at the top left. If you turn the board round to black's side you get the familiar textbook picture with square 1 at the top left. Every diagram in these guides prints the numbers on the squares, so you never have to work it out.

The diagram below is the starting position with the numbers shown. Step through it to see the first two moves by each side in the example sequence 11-15 23-19 8-11 22-17, and watch how the notation matches the board.

<DiagramBoard
  position="
    .b.b.b.b
    b.b.b.b.
    .b.b.b.b
    ........
    ........
    r.r.r.r.
    .r.r.r.r
    r.r.r.r."
  toMove="red"
  mode="step"
  numbered={true}
  moves={[
    { move: '11-15', note: 'Red opens with Old Faithful, towards the centre.' },
    { move: '23-19', note: 'Black meets it head on.' },
    { move: '8-11', note: 'Red refills the square behind.' },
    { move: '22-17', note: 'Black develops on the other side.' }
  ]}
  caption="The starting position with the standard square numbers, and four example opening moves. Red (bottom) moves first on this site." />

## How pieces move

A man moves one square diagonally forward, to an empty square. Forward means towards the opponent's side of the board. That is the only non-capturing move a man has: no sideways moves, no straight-ahead moves, no backward moves and no moving two squares at once. From most squares a man has two possible moves; from the edge of the board it has one.

In English checkers, a man cannot retreat to defend the row it left. On Pure Checkers it cannot retreat with a quiet move, but a backward capture may bring it back. A man on an outside file has only one geometric forward direction. This is the reason the opening moves matter and why checkers players talk about "tempo": a player cannot pass merely to preserve a position. Check which safe moves remain, including any captures, before assuming equal material means equal chances.

On the first move, the seven legal choices for the first player are 9-13, 9-14, 10-14, 10-15, 11-15, 11-16 and 12-16. Which of them is best, and what the site's own bot answers to each, is the subject of the [best first move guide](/strategy/best-first-move-in-checkers).

## Capturing and forced jumps

You capture by jumping. If an enemy piece is diagonally adjacent to your man and the square immediately beyond it is empty, your man may jump over the enemy piece onto that empty square, and the enemy piece is removed from the board. In the standard game a man jumps forward only, in the same directions it moves.

### Jumping is compulsory

If any of your pieces can capture on your turn, you must capture. You may not make a quiet move instead. This applies in English checkers and on this site. It lets an attacker force a response by offering a piece, provided the complete position leaves no alternative capture. The [forced capture article](/strategy/is-jumping-mandatory-in-checkers) goes through the rule in detail with positions you can click through; the summary is:

- If any capture exists, one of your capturing pieces must make it.
- If several captures exist, you choose which one. English rules have no "must take the most pieces" requirement.
- Pieces that cannot capture cannot move at all on a turn when another piece can.

### Multiple jumps

After a jump, if the same piece can jump again from its landing square, it must continue. A chain of jumps is a single move; the opponent does not get a turn in between. The chain may change direction at each jump within the piece's allowed directions, so a man in the standard game zigzags forward, while a king can turn back. The chain ends when no further jump is available, or when the capturing man reaches the king row and is crowned.

A piece cannot be jumped twice in the same move, and two enemy pieces standing next to each other on a diagonal cannot be jumped in one go, because there is no empty square between them to land on.

### Where the captured pieces go

Captured pieces are removed from the board. In the 8×8 game they never come back, and there is no rule for retrieving them. A captured piece cannot return, but a material advantage can disappear when the opponent captures in reply. Count the position after the complete exchange before deciding what you gained.

## Kings

A man that reaches the far row, the row the opponent's pieces started on, is crowned and becomes a king. Crowning happens immediately on arrival, whether the man got there by an ordinary move or by a jump, and it ends the move even if the new king could jump again from the crowning square. Physically, a second piece is placed on top; on screen, the piece shows a crown.

In the standard game a king moves exactly like a man in every respect but one: it may move and capture in all four diagonal directions, backwards as well as forwards. One square per move, jumping an adjacent piece to the square beyond, and continuing a chain if another jump is available. Because it can turn round, a king can string together captures that no man could reach, and it can retreat to safety or to defend. The [kings article](/strategy/how-do-kings-move-in-checkers) has diagrams for each case, including the flying kings used on this site.

Kings are not immune to capture. A king is jumped exactly like a man.

Below, a red man reaches the king row and is crowned.

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
    { move: '27-31', note: 'The man reaches square 31 on the king row and is crowned.' }
  ]}
  caption="Red's man on 27 moves to 31 and becomes a king. From the next turn it may move backwards." />

## Winning, drawing and the clock

### Winning

You win when your opponent cannot move on their turn. That happens in two ways: you have captured all of their pieces, or the pieces they have left are all blocked, with no legal move and no capture available. There is no stalemate in checkers; a player with no move loses. A player may also resign at any time.

### Draws

A draw can end a game without a winner. The exact condition and how it is established depend on the ruleset:

- **By agreement.** One player offers a draw and the other accepts. Pure Checkers supports draw agreements between human opponents; bots do not negotiate offers.
- **English repetition claim.** WCDF rule 1.32.1 allows a player to demonstrate to the referee that their next move would create the same position for the third time. This is a claim procedure.
- **English 40-move condition.** Rule 1.32.2 requires both no advance of an uncrowned man and no removal of pieces during each player’s previous 40 moves. A man’s advance matters even when it does not crown.
- **Pure Checkers automatic draws.** The server ends the game on a third occurrence of the same position and side to move, or after 50 turns without a capture. It does not use the English 40-move condition. Advancing or crowning a man without capturing does not reset this counter.

### The clock

Clock settings vary by event. On Pure Checkers, the default is 60 seconds per turn, not a single time bank for the whole game. A capture chain belongs to the same turn. Room settings also offer other turn lengths and unlimited time; check the setting before you ready up.

## Standard vs house rules

"Checkers" covers a family of games with the same idea and different details. The English game described above is the one played in Britain, Ireland, the United States and most of the English-speaking world. If you are used to a different variant, or you learned from a relative who was, the table shows where the differences lie, and the last column shows what the engine on this site actually does.

| Rule | English / American | International draughts | Pure Checkers |
| --- | --- | --- | --- |
| Board and pieces | 8×8, 12 each | 10×10, 20 each | 8×8, 12 each |
| Men make quiet moves | One square forward | One square forward | One square forward |
| Men capture | Forward | Forward or backward | Forward or backward |
| Kings | One-step | Flying | Flying |
| Capture choice | Free choice among legal captures | Greatest number required | Free choice among legal captures |
| Man reaches king row in a chain | Crown and stop | Crown only if the move ends there | Crown and stop |
| Captured pieces removed | At end of sequence | At end of sequence | After each hop |

The international column follows [FMJD Annex 1](https://www.fmjd.org/docs/Annex_1.pdf), especially sections 2–4. That 10×10 game has its own draw rules too; the English and Pure limits above do not apply to it. Similar movement does not make two variants interchangeable.

<aside class="house-rules">
<p class="house-rules-label">On Pure Checkers</p>

Pure Checkers uses its own documented combination of rules: men capture backwards as well as forwards, kings fly any distance along a diagonal and capture from a distance, captures are compulsory, and you choose freely between captures with no obligation to take the largest. Crowning follows the English rule: a man that reaches the king row in the middle of a multi-jump is crowned and stops there. These rules were checked by running positions through the game code, not taken from the settings screen, so the diagrams in the rules articles match what you will see in a game.

Additional details enforced by this site:

- **Repetition.** The same position with the same side to move three times ends the game as a draw automatically. No claim is needed.
- **No-capture limit.** Fifty consecutive half-moves without a capture (twenty-five by each player) end the game as a draw automatically.
- **The clock.** By default each player has 60 seconds per move; letting the clock run out loses the game. Rooms can be set to unlimited time, in which case there is no clock at all.

Captured pieces are removed after each hop, so newly opened diagonals can affect a continuing chain. Treat this as a distinct variant rather than assuming complete equivalence with another rule book.
</aside>

The practical difference is the set of moves you must check. Here an ordinary piece behind an opponent can still be captured backward, and a distant king can attack along a clear diagonal. Before borrowing an opening or endgame example, confirm that those moves were allowed in its original ruleset.

## Your first game in five minutes

Here is how to sit down and play a sensible game today, using only the rules above.

1. **Set up and confirm the rules.** Twelve men each start on the dark squares of your nearest three rows. Red moves first here. If you are teaching a friend who learned English checkers, explain backward captures and flying kings before starting.
2. **Develop a front-row piece.** Try 11-15 as a repeatable starting choice. Watch which square becomes free for a supporting man, then inspect the opponent’s reply. The opening guide includes a worked exchange you can follow.
3. **Check captures on every turn.** First find your compulsory captures. When considering a quiet move, trace the opponent’s potential jump over your landing square, including any further jumps. On this site, check backward as well as forward.
4. **Keep useful defenders without freezing development.** Back-row men can block promotion routes, but keeping all of them forever can restrict your own moves. Before advancing one, inspect the route it leaves open and whether another piece still covers it. No two-square formation guarantees that every crown route is closed.
5. **Evaluate the whole exchange.** Trading when ahead can simplify a position, but count the opponent’s recaptures and check promotion threats. A nominally equal trade can leave one side with a safe king and the other with blocked men.
6. **Use a king’s actual legal moves.** Look along its diagonals for captures, landing choices and enemy replies. A king placed behind opposing men is not automatically safe here because men can capture backward.
7. **Recognise a draw condition.** Equal piece counts do not by themselves prove a draw. Check legal mobility and threats, then respect the server’s repetition or no-capture result. In a human game you can also offer a draw for the opponent to accept.

For a short practice session, step through the opening diagram, reset it and name each source and destination before advancing. Then try the promotion diagram and identify the new backward destinations of the king. These are constructed teaching positions checked with the same movement engine used in live games; they do not claim to be records of tournament play.

When you start a live game, the board shows the legal destinations for a selected piece. If a move you expected is unavailable, check for a capture elsewhere before assuming the piece is blocked. During a chain, continue with the selected capturing piece. The opponent gets a turn only once the chain ends or a man crowns.

Use the [double-jump exercises](/strategy/double-jump-in-checkers) to practise reading complete capture routes. The purpose of learning the rules is to know which choices actually exist; deciding among those legal choices is the next part of learning to play.
