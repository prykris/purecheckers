<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { CheckersGame } from '../../../shared/game.js';
  import { restoreGame } from '$lib/boardSnapshot.js';
  import { BoardPresentation } from '$lib/boardPresentation.js';
  import { PRESENTATION_TIMING } from '$lib/gamePresentation.js';
  import { play } from '$lib/sounds.js';
  import BoardView from './BoardView.svelte';

  export let snapshot;
  export let recovery = 0;
  export let connected = true;
  export let myColor = 'red';
  export let interactive = false;
  export let flip = myColor === 'black';
  const dispatch = createEventDispatcher();
  let mounted = false, reducedMotion = false, visible = true;
  let presentation = { snapshot: null, animation: null, busy: false, resultVisible: false };
  const controller = new BoardPresentation({
    publish: value => presentation = value,
    onTransition: plan => play(plan.captured.length ? 'capture' : 'place'),
  });
  let game = new CheckersGame(), selectedPiece = null, validMoves = [];
  let lastMove = null, lastMoveCaptured = [];
  let renderedSnapshot = null;

  $: if (snapshot) controller.accept(snapshot, { recovery, orientation: flip, enabled: mounted && connected && visible && !reducedMotion });
  $: if (presentation.snapshot && presentation.snapshot !== renderedSnapshot) {
    renderedSnapshot = presentation.snapshot;
    game = restoreGame(new CheckersGame(presentation.snapshot.turnTime), presentation.snapshot);
    lastMove = presentation.snapshot.moveHistory.at(-1) || null;
    lastMoveCaptured = lastMove?.captured || [];
  }
  $: canInteract = interactive && connected && !presentation.busy;
  $: if (!canInteract) { selectedPiece = null; validMoves = []; }
  $: if (canInteract && snapshot?.chainPiece) {
    selectedPiece = { ...snapshot.chainPiece };
    validMoves = game.getValidMovesFor(selectedPiece.row, selectedPiece.col);
  }

  function select({ detail }) { selectedPiece = { row: detail.row, col: detail.col }; validMoves = detail.moves; }
  function deselect() { selectedPiece = null; validMoves = []; }
  onMount(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => reducedMotion = motion.matches;
    const onVisibility = () => visible = !document.hidden;
    onMotion(); onVisibility(); mounted = true;
    motion.addEventListener('change', onMotion); document.addEventListener('visibilitychange', onVisibility);
    return () => { motion.removeEventListener('change', onMotion); document.removeEventListener('visibilitychange', onVisibility); };
  });
  onDestroy(() => controller.dispose());
</script>

<BoardView {game} {flip} {myColor} interactive={canInteract} animation={presentation.animation}
  {selectedPiece} {validMoves} {lastMove} {lastMoveCaptured}
  on:select={select} on:deselect={deselect} on:move={event => dispatch('move', event.detail)}>
  <slot resultVisible={presentation.resultVisible} resultDuration={presentation.resultAnimated && !reducedMotion ? PRESENTATION_TIMING.result : 0} />
</BoardView>
