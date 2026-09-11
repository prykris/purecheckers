---
title: "Can You Move Backwards in Checkers?"
description: "Can you move backwards in checkers? Kings can; ordinary pieces depend on the kind of move and rules. Compare English rules with our playable example."
category: rules
published: "2026-09-10"
updated: "2026-09-10"
primaryQuery: "can you move backwards in checkers"
secondaryQueries:
  - "can checkers jump backwards"
  - "can a man capture backwards in checkers"
related:
  - how-do-kings-move-in-checkers
  - is-jumping-mandatory-in-checkers
  - checkers-rules
faq:
  - q: "Can an ordinary checker retreat without taking a piece?"
    a: "No under English rules or Pure Checkers rules. An uncrowned piece makes quiet moves diagonally forward. Pure Checkers permits backward captures, which are a different kind of move."
  - q: "Does turning the board change which direction is forward?"
    a: "No. Forward means toward that piece's original opposing king row. Rotating the view changes where the squares appear, not the piece's movement direction."
  - q: "Can a backward jump be compulsory on Pure Checkers?"
    a: "Yes. If a backward jump is the only available capture, you must take it. If several captures exist, you may choose among them, then finish the selected piece's available chain."
  - q: "Can I switch to English movement rules in a room?"
    a: "Pure Checkers currently uses one shared ruleset. Room settings change options such as the timer, privacy and stakes; they do not switch men to forward-only captures or kings to one-step movement."
---
<script>
  import DiagramBoard from '$lib/components/DiagramBoard.svelte';
</script>

**In English or American checkers, a king can move and jump backwards; an ordinary piece cannot.** On Pure Checkers, ordinary pieces can also *capture* backwards, but their moves to empty neighbouring squares still go forward. Identify the ruleset and distinguish a quiet move from a jump before deciding whether a retreat is legal.

That distinction explains a move which can look like a bug: a red man walks toward the far end of the board on one turn, then jumps toward its own starting row on another. On this site, both moves can be correct. The piece has not become a king, and its direction has not changed. It has used two different movement rules.

## Ordinary pieces move forward

A quiet move takes a man to an empty, diagonally adjacent square toward the opposing king row. It does not remove anything from the board. A man cannot use an empty backward diagonal simply because its forward squares are blocked. If none of your pieces has a legal move on your turn, you lose; there is no pass button that changes their directions.

“Forward” belongs to the piece's colour, rather than to the screen. In these diagrams, red starts at the bottom and advances toward the top. Black advances toward the bottom. If you play black with the board rotated for your seat, your pieces can appear to advance upward on your own display. The legal destinations stay attached to the same numbered squares.

Our [complete rules guide](/strategy/checkers-rules) explains the numbering. Red starts on squares 1–12 and promotes on 29–32. Black starts on 21–32 and promotes on 1–4. Numbers are useful when discussing a move with a friend whose board faces the other way: “18 to 9” identifies the same move for both of you.

## A backward capture is a separate rule

Under [WCDF English rules, sections 1.15–1.21](https://nccheckers.org/NCCA/WCDF%20Checker%20-%20Draughts%20-%20English%20Rules.htm), men make both their quiet moves and their captures forward. Kings gain backward movement and backward capture. English draughts and American checkers refer to this same rules family.

Pure Checkers uses different capture rules for men. A man can jump an adjacent opposing piece in any diagonal direction, provided the square immediately beyond it is empty. It still lands exactly two diagonal steps from where it started. Backward capture does not let it slide several empty squares, turn a corner in the middle of one jump, or jump a friendly piece.

The constructed example below isolates that difference. Red has a man on 18; black has a man on 14, behind it. Square 9 is empty. Under English rules, 18x9 is unavailable because the red man would capture backward. Here it is the only capture and therefore compulsory. The toggle changes the illustration's markings; it does not change the app's ruleset.

<DiagramBoard
  position=".b....../......../......../....r.../.....b../......../......../r......."
  toMove="red"
  numbered={true}
  variants={[
    { label: 'English: no backward capture', highlight: [] },
    { label: 'Pure Checkers: 18x9', highlight: [18, 9], arrows: ['18x9'] }
  ]}
  caption="Constructed comparison: red man on 18, black man on 14 and empty landing square 9. The marked backward capture is legal only under the Pure Checkers rules illustrated here; this static toggle does not switch the game engine." />

Notice the empty landing square, not just the black piece. If another piece occupied 9, the jump would disappear. If the man on 14 were red, it could not be jumped. If black were two squares away instead of adjacent, this ordinary red man could not capture it from a distance. Each condition matters independently of the direction.

## Try the backward jump

Select red's man on 18, then select 9. The board uses the same movement engine as a live game. It should offer one destination, remove the black man on 14 and pass the turn to black. Red remains an ordinary piece on 9 because that square is not its king row.

<DiagramBoard
  position=".b....../......../......../....r.../.....b../......../......../r......."
  toMove="red"
  mode="try"
  numbered={true}
  caption="Try Pure Checkers rules: play the forced backward jump 18x9. You control both colours in this practice board; Reset restores the four-piece example." />

The extra red man on 4 is deliberate. It shows why looking at one piece's ordinary moves can be misleading. You may see a plausible forward destination for that man, but an available capture elsewhere prevents you from choosing a quiet move. Read [why jumping is mandatory](/strategy/is-jumping-mandatory-in-checkers) for examples with several capture choices.

After the jump, look again before moving black. A board position changes whenever a piece moves or disappears. A diagonal that was blocked can open; a safe landing square can become exposed. Checking the new position is more useful than remembering which moves were available on the previous turn.

## Kings can move both ways

A king keeps its backward movement ability for the rest of the game. It does not lose its crown when it leaves the king row. Under English rules, quiet king moves cover one diagonal square. On Pure Checkers, kings can travel any distance along an empty diagonal, so a retreat can cross much of the board.

That extra range belongs only to kings. A backward capture by a man does not temporarily give it flying movement. The crown on the piece tells you which movement rules apply. See [how kings move](/strategy/how-do-kings-move-in-checkers) for the difference between a distant flying capture and an adjacent jump.

<aside class="house-rules">
<p class="house-rules-label">On Pure Checkers</p>

Men move forward to empty adjacent squares and capture in all four diagonal directions. Kings move and capture along diagonals at any distance allowed by the intervening pieces. Captures are compulsory; when several are available, you choose a route without a maximum-capture requirement. Reaching the king row crowns a man and ends its turn, including during a chain.

</aside>

## Check backward threats before offering a piece

When you advance beside an opposing man here, inspect both sides of that man. An English-checkers habit of checking only its forward jumps misses half the possible capture directions. Trace the jump from the opponent's square, through your piece, to its landing square. Then check whether it can continue from that landing.

This also affects exchanges. A proposed one-for-one trade can turn into a longer chain when a backward jump becomes available after the first capture. Count pieces on the board after the complete sequence, including any forced reply. Counting only the first two jumps gives the wrong answer when a third one is compulsory.

For a first session with someone who learned a different version, use the [quick setup explanation](/#how-to-play) and agree on these movement differences before starting. The [site FAQ](/faq) covers playing options. Once both players know that backward captures are allowed here, the same position stops looking inconsistent and becomes a tactical possibility you can both plan around.
