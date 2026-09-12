<script>
  import GameScreen from './GameScreen.svelte';
  export let view;
  export let noticeInset = 0;
</script>
<GameScreen {view} {noticeInset}/>
