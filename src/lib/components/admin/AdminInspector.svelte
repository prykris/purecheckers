<script>
  import AdminResource from './AdminResource.svelte';
  import AdminPlayerActions from './AdminPlayerActions.svelte';
  import PlayerPage from '../PlayerPage.svelte';
  import PlayerLink from '../PlayerLink.svelte';
  import GameBoard from '../GameBoard.svelte';
  import ReplayBoard from '../ReplayBoard.svelte';
  let { section, id } = $props();
  let confirmed = $state(''), previewWidth = $state(280);
  $effect(() => { section; id; confirmed = ''; });
  const display = value => value == null ? '—' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
</script>
{#if confirmed}<p class="confirmation" role="status">{confirmed}</p>{/if}
<AdminResource path={`${section}/${id}`}>
{#snippet children(data, refresh)}
<div class="inspector">
  <div class="detail-heading"><strong>{section === 'players' ? data.player.username : `${section} #${id}`}</strong><button class="btn btn-dark btn-small" onclick={refresh}>Refresh</button></div>
  {#if data.player}
    <p class="muted">Account #{data.player.id} · {data.player.email || 'No email'}{#if data.player.guestRetiredAt} · Retired{/if}</p>
    <AdminPlayerActions player={data.player} onchanged={receipt => { confirmed = `Confirmed ${receipt.kind} for ${receipt.user.username}.`; refresh(); }}/>
    <PlayerPage data={data} embedded allowChallenge={false}/>
  {:else if data.game}
    <ReplayBoard gameData={data.game}/>
    <dl><dt>Result</dt><dd>{data.game.result}</dd><dt>Ending</dt><dd>{data.game.endReason || 'Unknown'}</dd><dt>Mode</dt><dd>{data.game.mode}</dd></dl>
  {:else if data.puzzle}
    <div class="preview" bind:clientWidth={previewWidth}><GameBoard snapshot={{...data.puzzle.position, moveHistory:[], turnTime:0}} interactive={false} maxSize={Math.min(previewWidth,360)} readOnlyLabel="Puzzle starting position"/></div>
    <dl>{#each ['date', 'difficulty', 'theme', 'verifiedDepth', 'solutionPlies', 'legalMoves', 'scoreGap', 'generatorVersion', 'createdAt'] as field}<dt>{field.replace(/([A-Z])/g, ' $1')}</dt><dd>{field === 'date' ? data.puzzle.date.slice(0,10) : display(data.puzzle[field])}</dd>{/each}<dt>Attempts</dt><dd>{data.attempts}</dd><dt>Publishing</dt><dd>{data.rejection ? 'Rejected — requires review' : data.puzzle.date.slice(0,10) > new Date().toISOString().slice(0,10) ? 'Scheduled' : 'Published'}</dd></dl>
    {#if data.rejection}<p role="alert">This position is in the rejection registry.</p>{/if}
    <details><summary>Solution and explanation</summary><pre>{display(data.puzzle.solution)}</pre><pre>{display(data.puzzle.commentary)}</pre></details>
  {:else if data.room}
    <dl><dt>Status</dt><dd>{data.room.status}</dd><dt>Host</dt><dd>#{data.room.state.hostId}</dd><dt>Created</dt><dd>{new Date(data.room.createdAt).toLocaleString()}</dd><dt>Revision</dt><dd>{data.room.revision}</dd></dl>
    <h3>Players</h3>{#each data.room.state.players as p}<a href={`/admin?section=players&id=${p.userId}`}>Account #{p.userId} · {p.ready ? 'Ready' : 'Not ready'} · {p.online ? 'Online' : 'Offline'}</a>{/each}
    <h3>Settings</h3><dl>{#each Object.entries(data.room.state.settings) as [key,value]}<dt>{key}</dt><dd>{display(value)}</dd>{/each}</dl>
  {:else if data.run}
    <p><PlayerLink username={data.run.redPlayer.username}/> vs <PlayerLink username={data.run.blackPlayer.username}/></p>
    <dl>{#each ['id','status','mode','buyIn','turnTime','createdAt','revision','roomId','replayId'] as field}<dt>{field.replace(/([A-Z])/g,' $1')}</dt><dd>{display(data.run[field])}</dd>{/each}</dl>
    {#if data.run.replayId}<a href={`/admin?section=games&id=${data.run.replayId}`}>Review saved game</a>{/if}
  {/if}
</div>
{/snippet}
</AdminResource>
<style>.confirmation{padding:12px;background:color-mix(in srgb,var(--success) 12%,var(--surface));border-radius:8px;font-size:13px;margin-bottom:12px}.inspector{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;min-width:0}.inspector > :global(*){min-width:0;max-width:100%}.detail-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.muted{color:var(--text-dim);font-size:13px}dl{display:grid;grid-template-columns:minmax(90px,1fr) minmax(0,2fr);gap:10px;font-size:13px}dt{color:var(--text-dim);text-transform:capitalize}dd{margin:0;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;max-height:260px;overflow:auto;background:var(--bg);padding:12px}summary{cursor:pointer;min-height:44px;padding:12px}h3{font-size:15px}.preview{display:grid;place-items:center;max-width:100%}</style>
