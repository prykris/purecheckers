---
title: "5 Checkers Traps: Captures, Crowns and Blocked Pieces"
description: "Learn five checkers traps with playable boards. Check forced replies, spot a flying-king defence, and practise winning material or trapping a blocked man."
category: tactics
published: "2026-09-11"
updated: "2026-09-11"
primaryQuery: "checkers traps"
secondaryQueries:
  - "checkers tricks to win"
  - "two for one shot checkers"
related:
  - double-jump-in-checkers
  - is-jumping-mandatory-in-checkers
  - how-do-kings-move-in-checkers
faq:
  - q: "What is a two-for-one shot in checkers?"
    a: "You give up one piece to capture two opposing pieces, gaining one in the exchange. Check the opponent's whole capture turn and your recapture before counting the gain. An extra jump or an occupied landing can break the combination."
  - q: "Are breeches and a fork the same checkers tactic?"
    a: "Breeches places a king between two enemy pieces so moving one leaves the other threatened. It resembles a fork, but checkers books also use fork for other arrangements. The actual squares, capture directions and landing spaces matter more than the label."
  - q: "Does the longest jump always win?"
    a: "No. Pure Checkers lets you choose between legal captures without requiring the longest route. Compare the position after each complete chain, including the opponent's reply. A king's landing square can decide whether a counter-capture works."
  - q: "Is the dog hole always losing?"
    a: "No. In this guide, a black man on 5 is blocked by red's guard on 1. Red can win the constructed exercise by keeping that guard, but moving it lets black crown. A king or a different surrounding position needs a fresh calculation."
---
<script>
  import DiagramBoard from '$lib/components/DiagramBoard.svelte';
</script>

**The most useful checkers traps exploit a compulsory capture, a landing square or a piece that cannot escape.** Start with a two-for-one shot: offer one man, force the opponent onto your capture route, and take two in return. Then learn to recognize the guards that make the sequence work. Remembering the sacrifice without its supporting pieces is an easy way to give material away.

These five lessons cover different outcomes. The first wins a piece in an exchange; the second threatens material; the third punishes a particular king landing. The fourth buys a promotion, and the last wins by blocking the opponent's only man. They are not five automatic wins from any similar-looking position.

The boards use **Pure Checkers rules**: men capture backward, kings fly, and a man that crowns ends its turn. English-checkers examples can change under those rules. Read the [movement and capture guide](/strategy/checkers-rules) first if those differences are unfamiliar. Four boards let you step through an example; the final board lets you choose the moves yourself.

> **Before offering a piece:** find every legal opposing capture, finish each chain, and check the position you will actually receive. “They must capture” does not always mean “they must capture this way.”

Use a free practice game to test a combination from both sides. The [site FAQ](/faq) covers playing against bots and inviting a friend.

## Read the numbers and the whole turn

The 32 dark squares are numbered. In these diagrams, square 1 is at the bottom right; red moves toward 29–32, while black moves toward 1–4. A dash denotes a quiet move, such as 15-18. An x denotes a capture, such as 22x15. In 10x19x26, one piece makes two jumps in the same turn.

For each jump, identify three things: the moving piece, the enemy being crossed and the empty landing beyond it. Update all three after a hop. You cannot trace a second jump from the original square, and you cannot land on a friendly guard simply because it would complete an attractive pattern.

The compulsory-capture rule gives tactics their force. The [NorthWest Draughts Federation's tactics lesson](https://www.irishdraughts.org/tactics.html) connects tactics with shots, sacrifices for promotion and blocking pieces. Our boards use the app's engine to check the moves and the alternatives described below. Most positions are constructed exercises; they are not claimed to be tournament games or optimal play.

The names are memory aids. Richard Pask treats two-for-one, in-and-out, breeches and fork as separate lessons in [Checkers for the Novice](https://www.bobnewell.net/filez/cfn.pdf#page=45). We use those distinctions where useful, while calculating the actual position rather than importing an English-rules conclusion unchanged.

## 1. The two-for-one shot: inspect the guards

Red's **15-18** offers a man and leaves black exactly one capture: **22x15**. Red then has **10x19x26**, taking two black men for the one sacrificed. Once the chain ends, red has gained one piece in the exchange. That local gain is the claim here; the remaining game still requires play.

<DiagramBoard
  position=".b....../......../...b.b../......../...r.r../....r.../.....r../........"
  toMove="red" mode="step" numbered={true}
  moves={[
    { move: '15-18', note: 'Offer the man while keeping both supporting guards.' },
    { move: '22x15', note: 'Black has only this capture; the guard on 6 stops another hop.' },
    { move: '10x19', note: 'Take the man drawn onto 15.' },
    { move: '19x26', note: 'Continue over 23, completing the two-for-one.' }
  ]}
  caption="Constructed two-for-one: the red men on 14 and 6 restrict black's capture routes. Red sacrifices one man and captures two." />

The quiet-looking guards do the hard work. Red on 14 blocks black from jumping the offered man with the piece on 23. Red on 6 prevents the man that reaches 15 from continuing over red's intended attacker on 10. Remove either guard and you must recalculate; the sacrifice no longer has the same justification.

This is why a loose checker can be bait rather than a mistake. Its owner may have prepared the square where your jump will end. As the defender, inspect what your compulsory landing attacks and what attacks it. A capture that wins material halfway through a sequence can lose material when the turns finish.

The [double-jump lesson](/strategy/double-jump-in-checkers) develops this same position in more detail. Once you can explain both guards, reset the board and call out the next landing before advancing. That tests whether you see the mechanism instead of remembering the animation.

Count the pieces on both sides of the transaction. This board starts with four red men and three black men. It ends with three red men and one black man. Red was already a piece ahead; the shot increases that advantage by one. Saying “red wins two pieces” without mentioning the sacrifice would describe the captures while hiding their cost.

When reviewing one of your own games, record the position before the offer rather than saving only the final double jump. That preserves the evidence needed to check whether the opponent really lacked another capture. It also tells you which earlier move removed a necessary guard when a similar attempt failed.

## 2. Breeches: a king between two targets

Red plays **15-18**, placing its king between the black men on 14 and 23 along one diagonal. Black cannot jump the king immediately: each man's required landing is occupied by the other black man. Moving one of them exposes the one left behind.

<DiagramBoard
  position="...................b...............R.b.........................."
  toMove="red" mode="step" numbered={true}
  moves={[
    { move: '15-18', note: 'Place the king between black on 14 and 23.' },
    { move: '23-19', note: 'This is one of black\'s three legal replies.' },
    { move: '18x9', note: 'Capture the man left on 14; landing on 5 is also legal.' }
  ]}
  caption="Constructed breeches: 15-18 threatens a capture after any of black's three replies. The diagram shows 23-19 followed by 18x9, not the only line." />

Check every reply rather than assuming a threat is unavoidable. Black has **23-19, 14-10 and 14-9**. After 23-19, red can take the man on 14 and land on 9 or 5. After either move from 14, red can capture the man on 23 and land on 27 or 32. The reply 14-9 also allows 18x5 against the moved man.

This is the breeches idea described in Pask's lesson 13: a king inserted between two targets gains one when they cannot both get away. The extra landing choices here come from Pure Checkers' flying kings. The exercise establishes an immediate capture, not a solved outcome for every resulting king-versus-man ending.

For defence, look for a capture of the attacking king, a blocked landing beyond the other target, or a move that creates a counter-threat. Adding another piece can supply one of those resources. Learn the geometry, but do not declare a fork won from the names of its three main squares alone.

Compare the tempting **15-19** in the starting position. It does not put the king between the two men on their shared diagonal. Black can answer **23x16**, capturing red's only piece and winning immediately. The successful and unsuccessful king moves both advance into the same general area; what separates them is the precise landing beyond the king. “Attack both pieces” is a plan, not a substitute for that square check.

## 3. The in-and-out shot: a crown pauses the chain

An in-and-out shot can exploit the pause when a man reaches the crown row. The newly crowned piece cannot continue capturing until its next turn. That gives the opponent time to prepare a counter-capture. Pask's lesson 12 illustrates this with the arrangement below, but a flying king changes the defender's choices.

Here **black** is setting the trap. Black plays **30-26**, opening square 30. Red must jump **21x30**, taking the black man on 25 and crowning. Black uses the pause for **7-3**, gaining its own king. Now the trap depends on red's landing.

<DiagramBoard
  position=".....b........b........r.........r...............r.b............"
  toMove="black" mode="step" numbered={true}
  moves={[
    { move: '30-26', note: 'Black clears 30 so red must capture into the crown row.' },
    { move: '21x30', note: 'Red captures 25, crowns and ends its turn.' },
    { move: '7-3', note: 'Black uses the pause to crown another man.' },
    { move: '30x23', note: 'This landing falls into the trap; 30x19 is also legal on Pure Checkers.' },
    { move: '3x12', note: 'Black begins its return shot over red on 8.' },
    { move: '12x19', note: 'Continue over red on 16.' },
    { move: '19x26', note: 'Capture the red king on 23 and win.' }
  ]}
  caption="In-and-out example adapted from Pask's lesson 12, diagram 59. The shown Pure Checkers line wins for black, but red may choose 30x19 instead of 30x23." />

After **30x23**, black's **3x12x19x26** captures all three red pieces. That is a complete win in the displayed line. However, red can instead play **30x19**. Black still has 3x12, but red's pieces on 16 and 19 then sit consecutively along the next diagonal, leaving no landing between them. The advertised triple jump breaks.

Do not turn that counterexample into another unsupported verdict: stopping this combination does not prove that 30x19 wins or draws the remaining game. It proves that the original forced-win claim cannot simply be transferred to this ruleset. The [king movement guide](/strategy/how-do-kings-move-in-checkers) explains why landing freedom matters.

## 4. Pull a crown-row guard away

Sometimes the target is a square rather than material. In this position, red's man on 27 cannot crown: black occupies both 31 and 32. Red offers **22-26**, and black must answer **31x22**. That vacates 31, allowing **27-31** and a new red king.

<DiagramBoard
  position=".b.b......r......r.r.r.........................................."
  toMove="red" mode="step" numbered={true}
  moves={[
    { move: '22-26', note: 'Offer a man to draw the guard away from 31.' },
    { move: '31x22', note: 'Black has exactly this capture because the other landings are blocked.' },
    { move: '27-31', note: 'Red uses the cleared square to crown.' }
  ]}
  caption="Constructed guard deflection: 22-26 forces 31x22 and makes 27-31 possible. Red spends one man to obtain a king; this is not a material gain or a proved game win." />

The supporting red men again matter. The man on 24 blocks 31x24 over red on 27. The man on 23 blocks 32x23 over that same piece. With those alternative landings occupied, black cannot choose a different capture and leave the guard on 31 in place.

Count the price honestly. Red starts with four men and finishes with two men and a king; black still has two men. Red has spent a piece to promote another. A king's mobility can make that attractive, but its value depends on the position, not a universal exchange rate. This exercise verifies access to the crown square, not that the sacrifice is the best move.

Before pressing Next, find why an immediate promotion is unavailable. Both destinations from 27 are occupied by black. After the forced capture, only 31 has been cleared; black still holds 32. The combination changes one specific obstruction. It does not make every route through the back row safe, and it does not remove the need to inspect black's next turn after the crown.

As defender, notice when a required jump abandons a square you were guarding. Before the bait arrives, keeping an alternative capture available may change the tactic. Once this exact position has reached 22-26, the [mandatory-capture rule](/strategy/is-jumping-mandatory-in-checkers) does not let black refuse the jump to preserve its back row.

## 5. The dog hole: keep the guard in place

The dog-hole idea concerns a man stranded near the edge with poor onward movement. Pask discusses a sunken man on square 5 in [Checkers for the Freestyle Expert, lesson 85](https://www.bobnewell.net/filez/lc2.pdf#page=98). The constructed exercise below isolates a simple version: black's only man sits on 5, and red on 1 blocks its promotion.

It is red's turn. **Find a move that keeps black from moving.** You control both colours on this board; there is no bot response. Keep track of which red man is doing the guarding.

<DiagramBoard
  position=".......................................................b..r...r."
  toMove="red" mode="try" numbered={true}
  caption="Constructed dog-hole exercise: red men on 1 and 3, black's only man on 5, red to move. Find a winning move that preserves the guard, then reset and investigate 1-6." />

<details>
<summary>Show the winning moves and the mistake</summary>

Both 3-7 and 3-8 win by leaving black without a legal move. The tempting 1-6 removes the guard instead; black can then play 5-1 and crown. Reset before comparing the alternatives.

</details>

This is an immobilization win, not a capture. Black would have reached this awkward square after a move such as 9-5, but that choice was not forced: 9-6 was also available in the corresponding three-man position. Avoid describing a voluntary entry as something the attacker can compel.

A black king on 5 would be a different exercise because it could move backward along other diagonals. Even for a man, another nearby piece can supply a capture or change the available waiting moves. The square's nickname is a warning to inspect the exits, not a verdict that every piece placed there is lost.

Notice the role of red's spare man on 3. It supplies a legal move while the guard stays on 1. If that spare man were absent, red would have to move its guard instead. A blocked opponent is useful only when your own move can preserve the block. Counting legal waiting moves is part of calculating the trap.

## A practical way to avoid these traps

Before moving, first check your compulsory captures. If there is more than one, compare the complete chains, including a king's possible landing squares. The in-and-out example shows how a different destination can interrupt a combination even when you capture the same enemy man.

Then inspect what your intended move uncovers. Are you vacating a landing behind another piece, a crown square, or an exit from a cramped corner? Guards are easy to overlook because they may be several squares from the piece being offered. Calculate from the resulting position, with captured pieces removed and any new king recognized.

Finally, name the outcome accurately: a net material gain, a promotion purchased with a sacrifice, an immediate threat, or a forced win. Those are different achievements. During practice, reset these boards and explain one defence as carefully as the attacking line.
