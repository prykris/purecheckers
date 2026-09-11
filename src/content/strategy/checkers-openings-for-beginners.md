---
title: "Checkers Opening Moves for Beginners: 5 Lines to Learn"
description: "Good checkers opening moves for beginners develop supported pieces. Practise five numbered lines and see how each exchange changes the whole board."
category: openings
published: "2026-09-10"
updated: "2026-09-11"
primaryQuery: "checkers opening moves for beginners"
secondaryQueries:
  - "checkers opening strategy"
  - "checkers openings explained"
related:
  - best-first-move-in-checkers
  - is-jumping-mandatory-in-checkers
  - how-to-beat-a-checkers-computer
faq:
  - q: "Which checkers opening should a beginner learn first?"
    a: "Start with 11-15 and learn to recognise the opponent's reply. This guide uses 24-19 to practise an exchange, then compares the Cross reply 23-18 and Single Corner reply 22-18. The first move alone does not prescribe the rest of the game."
  - q: "Are Old Faithful and Single Corner different openings?"
    a: "Old Faithful is a name for the first move 11-15. Single Corner is a more specific opening beginning 11-15, 22-18. They overlap: the opponent's reply determines which continuation you are playing."
  - q: "Can I use these opening lines in English draughts?"
    a: "The names come from English-checkers literature, but these diagrams are checked against Pure Checkers. Its men capture backward and its kings fly. Use an English-rules board and an English source when studying tournament theory; do not assume later continuations transfer."
  - q: "Should I keep every checker on the back row?"
    a: "Keep useful guards, but judge the actual position. The Cross practice line moves 4-8 after 8-11 has cleared the way. That develops a rear man while leaving the other three back-row men in place. Keeping every rear piece fixed can restrict your choices."
---
<script>
  import DiagramBoard from '$lib/components/DiagramBoard.svelte';
</script>

**Learn one opening move, three replies, and the exchanges they create before trying to memorise a book.** For a beginner, 11-15 is a useful starting point. Once you can explain what happens after it, compare 9-14 and 11-16 to see how another first move changes your support and available squares.

This guide gives you five short practice lines. Each board starts from the normal position and lets you step through both players' moves. The goal is to recognise a position when an opponent changes course, then choose a move for a reason. You do not need to reproduce a long sequence to benefit from opening study.

The traditional names below belong to English-checkers literature. The playable examples use **Pure Checkers rules**, including backward captures by men and flying kings. We checked their move legality against the app's engine; that does not establish that each continuation is optimal. If you need the basic movement rules first, start with the [checkers rules guide](/strategy/checkers-rules).

> **What to practise:** identify the opponent's reply, check compulsory captures, finish an exchange before counting the result, and notice which supporting square each move opens or fills.

You can practise these lines against a bot or a friend; the [site FAQ](/faq) explains how those playing options work.

## Read the board before learning a name

Only the 32 dark squares receive numbers. Here, red starts on 1–12 and moves first; black starts on 21–32. Square 1 is at the bottom right of the displayed board. Books may put the first player's pieces at the top or use black and white instead of red and black, so follow the square numbers rather than the screen direction.

A hyphen means a quiet move: **11-15** moves a man from 11 to 15. An **x** marks a capture: **15x24** jumps the piece between those squares. Each entry in a line is one player's move, so six entries normally cover three turns for each side. A multiple jump belongs to one turn even when the board displays its hops separately.

The names also operate at different levels. Old Faithful names the first move 11-15; Cross and Single Corner distinguish replies to that same move. You are learning five useful branches, not five completely independent starting moves. Our [first-move comparison](/strategy/best-first-move-in-checkers) covers all seven legal starts and the separate recorded bot experiment.

| Practice branch | Recognise this start | Main question |
| --- | --- | --- |
| Old Faithful exchange | 11-15, 24-19 | Who recaptures after the first jump? |
| Cross | 11-15, 23-18 | Which supporting pieces can develop? |
| Single Corner | 11-15, 22-18 | Where does the exchange leave black's man? |
| Double Corner | 9-14, 22-18 | What does filling square 9 protect? |
| Bristol | 11-16, 22-18 | What changes when the advanced man reaches 20? |

## What an opening is trying to do

Develop pieces so they can take part in play without conceding a damaging capture. A central square often offers more directions than an outside-file square, but geometric directions are not necessarily legal moves. Another piece may block the destination, or a compulsory capture elsewhere may prevent any quiet move at all.

Think about support in terms of landing squares. A man next to an enemy is not automatically lost: the enemy also needs an empty square beyond it. Conversely, moving a guard can make a capture available even when the two opposing men have not moved. The Double Corner example below makes that relationship visible.

You may hear the word **tempo**, meaning a move or the timing gained or spent through a sequence. Advancing faster is not automatically an advantage. A forward man may need support, and a player with no useful quiet move can be forced to disturb a good formation. For these lessons, describe the actual change rather than trying to assign a tempo score.

Likewise, treat a back-row **bridge** as a guard formation, not a command to freeze every rear piece. A guard matters because of the squares it covers and the enemy route it obstructs. The opening boards still contain many men between the armies and the crown rows; read those pieces before applying an endgame rule from memory.

## 1. Old Faithful: follow the whole exchange

Begin with **11-15, 24-19, 15x24, 28x19**. Red develops from 11, black offers a man on 19, and both sides complete a capture. The first jump looks like a gain only if you stop reading too soon: after black recaptures, each side has eleven men.

The [NorthWest Draughts Federation's opening guide](https://www.irishdraughts.org/openings.html) identifies 11-15 as Old Faithful. Here we use that start to teach exchanges; the particular reply 24-19 is a practice choice, not a claim that every opponent should answer this way.

<DiagramBoard
  position=".b.b.b.b/b.b.b.b./.b.b.b.b/......../......../r.r.r.r./.r.r.r.r/r.r.r.r."
  toMove="red" mode="step" numbered={true}
  moves={[
    { move: '11-15', note: 'Red vacates 11 and develops toward the centre.' },
    { move: '24-19', note: 'Black offers an exchange on 19.' },
    { move: '15x24', note: 'Red must jump the man on 19.' },
    { move: '28x19', note: 'Black recaptures; each side now has eleven men.' },
    { move: '8-11', note: 'Red fills the square vacated by the first move.' },
    { move: '22-18', note: 'Black develops another front-row man.' }
  ]}
  caption="Old Faithful practice: complete both captures, then compare the new supporting squares. This is a legal teaching line, not a forced sequence from the starting position." />

After the exchange, the black man on 19 came from 28. Tracking that replacement matters: square 28 is now empty, while the man originally on 24 has disappeared. A board position records both the pieces still present and the holes they leave behind.

Pause after 24-19 and identify red's capture before stepping forward. Pause again after 15x24: black can recapture with **28x19 or 27x20**. Our line chooses the first. You cannot choose an unrelated quiet move to avoid a compulsory jump, but you can choose between legal capturing pieces. Compare those two recaptures on the board before choosing which leaves your formation easier to develop.

## 2. The Cross: develop the pieces behind the first man

The Cross begins **11-15, 23-18**. Richard Pask identifies this start in [Checkers for the Freestyle Expert, lesson 109](https://www.bobnewell.net/filez/lc2.pdf#page=171). Notice that black moves from 23, not from 22 or 24. A one-square difference in the starting piece changes which routes remain occupied.

Our short line continues **8-11, 27-23, 4-8, 23-19**. It demonstrates how vacating one square lets a rear man advance behind it. Red moves 8-11 into the hole left by 11-15; later, 4-8 develops a back-row man. Black follows a comparable sequence through 23, though the resulting formations are not identical.

<DiagramBoard
  position=".b.b.b.b/b.b.b.b./.b.b.b.b/......../......../r.r.r.r./.r.r.r.r/r.r.r.r."
  toMove="red" mode="step" numbered={true}
  moves={[
    { move: '11-15', note: 'Red begins with the familiar first move.' },
    { move: '23-18', note: 'This reply identifies the Cross start.' },
    { move: '8-11', note: 'Red develops into the newly empty square 11.' },
    { move: '27-23', note: 'Black fills the square vacated on its first turn.' },
    { move: '4-8', note: 'Red develops one rear man; 1, 2 and 3 remain occupied.' },
    { move: '23-19', note: 'Black brings a second man forward. No capture has occurred in this line.' }
  ]}
  caption="Cross practice: watch squares 11, 23 and 8 become available in succession. Both sides still have twelve men after these six moves." />

At the final position, red has a man on 15 and black has one on 19. Red cannot simply jump to 24, because black still occupies that landing square. Check the far side of a target before deciding that a capture exists. This is the same landing-square habit used in [double-jump patterns](/strategy/double-jump-in-checkers), applied before the first exchange.

Do not turn 4-8 into a universal instruction. It is available here because 8-11 cleared its destination. If the opponent changes the position, first check whether another capture is compulsory or the route is blocked. The useful lesson is coordinated development, not moving a rear man on a particular turn number.

## 3. Single Corner: compare the recapture

Single Corner begins **11-15, 22-18, 15x22, 25x18**. John Reade gives this named opening in his [introduction to checkers hosted by the FMJD](https://www.fmjd.org/docs/article.pdf#page=2). The starting move matches Old Faithful, but this reply produces a different exchange and a different final square for black.

Follow the captures before comparing positions. Red jumps from 15 over 18 to 22. Black then jumps from 25 over 22 to 18. Each side loses one man, while black finishes with a man on 18 instead of the man on 19 in our first lesson. We continue with two quiet developing moves to make the resulting board easy to inspect.

<DiagramBoard
  position=".b.b.b.b/b.b.b.b./.b.b.b.b/......../......../r.r.r.r./.r.r.r.r/r.r.r.r."
  toMove="red" mode="step" numbered={true}
  moves={[
    { move: '11-15', note: 'The first move alone does not determine black’s reply.' },
    { move: '22-18', note: 'Black offers the Single Corner exchange.' },
    { move: '15x22', note: 'Red captures the man that moved to 18.' },
    { move: '25x18', note: 'Black recaptures from 25; both sides have eleven men.' },
    { move: '8-11', note: 'Red develops into the open square 11.' },
    { move: '29-25', note: 'Black fills the square vacated by its recapturing man.' }
  ]}
  caption="Single Corner practice: 22-18 creates a different exchange from 24-19. Compare the final boards rather than treating both replies as interchangeable." />

There can be a choice even within a compulsory exchange. After 15x22, black can also capture from 26 to 17 in this position. The diagram chooses 25x18; it does not claim that this particular recapture is forced. That distinction helps prevent a common learning error: confusing a recorded line with the complete set of legal replies.

Reset lessons one and three, and stop just after each recapture. Compare black's advanced man and the two newly empty rear squares. Equal material does not mean identical positions. Your next move should respond to the arrangement you actually have.

## 4. Double Corner: see what a supporting move prevents

Try **9-14, 22-18, 5-9, 25-22**. The federation opening guide above discusses 9-14 followed by 22-18 and the supporting move 5-9. Our example makes the support concrete: red fills square 9, which would otherwise be a landing behind its man on 14.

After black's 22-18, red cannot capture 14x23 because square 23 is occupied. Red has time for a quiet move. Choosing 5-9 blocks black's potential 18x9 capture by occupying its landing square. Merely saying “support the centre” misses the exact reason this move affects the next turn.

<DiagramBoard
  position=".b.b.b.b/b.b.b.b./.b.b.b.b/......../......../r.r.r.r./.r.r.r.r/r.r.r.r."
  toMove="red" mode="step" numbered={true}
  moves={[
    { move: '9-14', note: 'Red develops a man and leaves 9 empty.' },
    { move: '22-18', note: 'Black approaches 14; inspect the empty square 9 behind it.' },
    { move: '5-9', note: 'Filling 9 prevents black from landing there after jumping 14.' },
    { move: '25-22', note: 'Black develops instead of taking the now-blocked 18x9 jump.' },
    { move: '11-16', note: 'Red develops a different front-row man.' },
    { move: '29-25', note: 'Black brings a rear man into the cleared square 25.' }
  ]}
  caption="Double Corner practice: the defensive effect of 5-9 comes from occupying a capture landing, not from the opening name." />

For comparison, substitute **11-16** for red's third entry, 5-9. Under Pure's rules black then has the capture 18x9 available. That counterexample explains why this particular guard matters. It does not prove every alternative to 5-9 loses, nor that one captured man decides the game; further play would need its own calculation.

Practise stating the threat in full: starting square, jumped piece and landing square. This is more useful during a game than trying to remember whether a move “looks defensive.” The same check works when an opponent moves a guard away from one of your targets.

## 5. Bristol: compare an inward move with an outside file

Bristol starts with **11-16**. Use **22-18, 8-11, 25-22, 16-20, 24-19** as a short practice continuation. Red first develops to 16, opens 11 for another man, and later moves the leading man to 20. The opening name does not make that advance mandatory.

Square 16 is near the side but is not on the outside file in these diagrams. Square 20 is. Once a man stands on an outside file, an enemy cannot jump over it while it remains there: there is no landing square beyond the board. That geometric protection does not guarantee a useful position or a winning plan.

<DiagramBoard
  position=".b.b.b.b/b.b.b.b./.b.b.b.b/......../......../r.r.r.r./.r.r.r.r/r.r.r.r."
  toMove="red" mode="step" numbered={true}
  moves={[
    { move: '11-16', note: 'The Bristol start reaches 16 and vacates 11.' },
    { move: '22-18', note: 'Black develops toward the centre.' },
    { move: '8-11', note: 'Red develops a supporting man.' },
    { move: '25-22', note: 'Black fills the square vacated by its first move.' },
    { move: '16-20', note: 'Red reaches the outside file on 20.' },
    { move: '24-19', note: 'Black develops. Each side still has twelve men.' }
  ]}
  caption="Bristol practice: distinguish square 16 from the outside-file square 20. An unjumpable man can still be blocked or have limited options." />

At the end, red's man on 20 can quietly advance to 24 because black has vacated it and red has no compulsory capture. That is a legal option, not our recommendation for the best next move. The question is what red should do with all its pieces, not simply whether the leading man can move again.

Compare this board with the Cross. In the Cross, red's initial man remains on 15 while other pieces develop. In this Bristol line, it moves twice. Both are useful study positions because they ask you to account for support, empty squares and the opponent's immediate threats.

## How to practise without memorising the wrong lesson

Use the five boards as a short repeatable exercise. First, step through a line while reading its notes. Second, reset and predict the next move before revealing it. Third, stop one move earlier and identify which other legal choices exist. That last pass separates understanding from simply remembering the animation.

Then play a bot game with the same first move. The bot may choose another reply; respond to that board instead of forcing the study sequence. Our [guide to playing the computer](/strategy/how-to-beat-a-checkers-computer) explains the differences between difficulty levels and why a bounded search is not an opening book.

Give yourself a different question on each attempt. On the first, count all the legal captures before considering a quiet move. On the next, identify the landing square that would make your advanced man vulnerable. On a third, track which rear piece can enter the square you are about to vacate. These are observations you can verify on the board, even if you eventually lose the game. Keep the opening constant while changing the question, then switch openings once those checks feel familiar.

After the game, review the earliest position where you could not explain your choice. Write down one concrete observation, such as “I moved the guard off the capture landing,” rather than blaming the opening name. Return to the matching lesson, repeat the position, and check whether you can now see the opponent's response before moving.
