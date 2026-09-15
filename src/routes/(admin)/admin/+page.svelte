<script>
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { user } from '$lib/stores/user.js';
  import { bootstrapState, retryBootstrap } from '$lib/stores/site.js';
  import { adminState } from '$lib/admin/actions.js';
  import AdminPending from '$lib/components/admin/AdminPending.svelte';
  import AdminResource from '$lib/components/admin/AdminResource.svelte';
  import AdminInspector from '$lib/components/admin/AdminInspector.svelte';
  import AdminBadge from '$lib/components/AdminBadge.svelte';
  import AccountMenu from '$lib/components/AccountMenu.svelte';
  import GameEntryLink from '$lib/components/GameEntryLink.svelte';
  const sections = [['overview','Overview'],['players','Players'],['live','Games & rooms'],['puzzles','Puzzles'],['economy','Economy'],['activity','Activity']];
  const names = Object.fromEntries([...sections,['games','Saved games'],['rooms','Rooms']]);
  const section = $derived(names[page.url.searchParams.get('section')] ? page.url.searchParams.get('section') : 'overview');
  const id = $derived(['players','live','rooms','games','puzzles'].includes(section) ? page.url.searchParams.get('id') : null);
  const query = $derived(page.url.searchParams.get('q') || '');
  const sort = $derived(page.url.searchParams.get('sort') || 'newest');
  const filter = $derived(page.url.searchParams.get('filter') || 'all');
  const offset = $derived(Number(page.url.searchParams.get('offset')) || 0);
  let search = $state('');
  $effect(() => { search = query || page.url.searchParams.get('userId') || '';  });
  function navigate(patch) {
    const params = new URLSearchParams(page.url.searchParams);
    for (const [key,value] of Object.entries(patch)) { if(value == null || value === '')params.delete(key);else params.set(key,String(value)); }
    goto('/admin?' + params, { noScroll: true });
  }
  function tab(value) { goto('/admin?section=' + value); }
  const path = $derived(section + '?' + new URLSearchParams({ q: query, filter, sort, offset: String(offset), ...(page.url.searchParams.get('userId') ? {userId:page.url.searchParams.get('userId')} : {}) }));
  const date = value => value ? new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}) : '—';
  const title = row => section === 'players' ? row.username : section === 'puzzles' ? row.date.slice(0,10) : section === 'rooms' ? `Room #${row.id}` : section === 'live' ? `${row.redPlayer.username} vs ${row.blackPlayer.username}` : section === 'games' ? `${row.redPlayer} vs ${row.blackPlayer}` : section === 'economy' ? row.reason.replaceAll('_',' ') : row.kind;
  const detail = row => section === 'players' ? `${row.elo} ELO · ${row.coins} coins` : section === 'puzzles' ? `${row.difficulty} · ${row.theme}` : section === 'rooms' || section === 'live' ? row.status : section === 'games' ? `${row.result} · ${row.mode}` : section === 'economy' ? `${row.amount > 0 ? '+' : ''}${row.amount} coins · ${row.receiver.username}` : `${row.actor.username} → ${row.target.username}`;
  const stamp = row => date(row.createdAt || row.date || row.startedAt);
</script>
<svelte:head><title>Administration · Pure Checkers</title><meta name="robots" content="noindex,nofollow"/></svelte:head>
<div class="admin-shell">
<header class="admin-header"><div><span class="eyebrow">Pure Checkers</span><h1>Administration</h1></div><div class="header-actions"><GameEntryLink/><AccountMenu/></div></header>
{#if $bootstrapState.loading}<p role="status">Checking your account…</p>
{:else if $bootstrapState.error}<p role="alert">{$bootstrapState.error}</p><button class="btn btn-dark" onclick={retryBootstrap}>Retry</button>
{:else if !$user?.isAdmin}
  <div class="access"><h2>Administrator access required</h2><p>Sign in with an administrator account to manage Pure Checkers.</p>{#if !$user}<a class="btn btn-primary" href="/login?returnTo=%2Fadmin">Log in</a>{/if}<AdminPending/></div>
{:else}
<div class="workspace">
<nav class="admin-nav" aria-label="Administration">{#each sections as [key,label]}<a href={`/admin?section=${key}`} aria-current={section===key || (key==='live' && ['games','rooms'].includes(section)) ? 'page' : undefined}>{label}</a>{/each}<div class="admin-identity">{$user.username} <AdminBadge isAdmin={true}/></div></nav>
<main><AdminPending/>
<div class="section-heading"><h2>{names[section]}</h2>{#if ['live','rooms','games'].includes(section)}<div class="segments">{#each [['live','Live'],['rooms','Rooms'],['games','Saved']] as [key,label]}<button aria-pressed={section===key} onclick={() => tab(key)}>{label}</button>{/each}</div>{/if}</div>
{#if section !== 'overview'}
<form class="filters" class:detail-filter={!!id} onsubmit={event => {event.preventDefault(); navigate({q:search,offset:null,id:null,...(['economy','activity'].includes(section)?{userId:search,q:null}:{})});}}>
<label class="search"><span>{section==='players'?'Find a player':section==='puzzles'?'Starting date': ['economy','activity'].includes(section)?'Account ID':'Record ID'}</span><input bind:value={search} type="search" placeholder={section==='players'?'Username or ID':section==='puzzles'?'YYYY-MM-DD':'All records'}/></label><button class="btn btn-dark">Search</button>
{#if section==='players'}<label><span>Show</span><select value={filter} onchange={event => navigate({filter:event.target.value,offset:null,id:null})}>{#each ['all','admins','registered','guests','bots','retired'] as value}<option {value}>{value}</option>{/each}</select></label><label><span>Sort</span><select value={sort} onchange={event => navigate({sort:event.target.value,offset:null,id:null})}>{#each [['newest','Newest'],['oldest','Oldest'],['rating','Highest rating'],['coins','Most coins'],['name','Name A–Z']] as [value,label]}<option {value}>{label}</option>{/each}</select></label>{/if}
{#if query || page.url.searchParams.get('userId')}<button type="button" class="btn btn-dark" onclick={() => navigate({q:null,userId:null,offset:null,id:null})}>Clear</button>{/if}
</form>
{/if}
<div class="panes" class:with-detail={!!id}>
<section class="records" class:mobile-hidden={!!id} aria-label={names[section]}>
<AdminResource {path}>
{#snippet children(data, refresh)}
{#if section==='overview'}
  <div class="metrics">{#each [['players','Players',data.players],['live','Open games',data.games],['rooms','Active rooms',data.rooms],['puzzles','Puzzle days ready',data.buffer.consecutiveDays]] as [key,label,value]}<a href={`/admin?section=${key}`}><span>{label}</span><strong>{value}</strong></a>{/each}</div>
  <p class="updated">{data.presence.humansOnline} players online · {data.presence.searching} finding an opponent</p><section class="health"><h3>Needs attention</h3><p>{data.settlements ? `${data.settlements} game settlements pending.` : 'No game settlements pending.'}</p><p>{data.buffer.healthy ? `Puzzle calendar complete through ${data.buffer.through}.` : `Puzzle buffer needs review: ${data.buffer.missingDates.length} missing dates, ${data.buffer.rejectedDates.length} rejected.`}</p><a href="/admin?section=puzzles">Inspect puzzle calendar</a></section>
  <div class="section-heading"><h3>Latest admin activity</h3><a href="/admin?section=activity">View all</a></div>
  {#each data.recentActions as item}<p class="activity-preview">{item.actor.username} <AdminBadge isAdmin={item.actor.isAdmin}/> · {item.kind} · {item.target.username} <AdminBadge isAdmin={item.target.isAdmin}/><small>{date(item.createdAt)}</small></p>{:else}<p>No administrative changes recorded.</p>{/each}
  <p class="updated">Updated {date(data.asOf)} <button onclick={refresh}>Refresh</button></p>
{:else}
  {#if data.buffer}<p class="buffer" class:attention={!data.buffer.healthy}>{data.buffer.consecutiveDays} consecutive days ready · through {data.buffer.through}{#if !data.buffer.healthy} · Needs review{/if}</p>{/if}
  <div class="list-heading"><span>{section==='activity'?'Who changed what':section==='economy'?'Coin ledger':'Records'}</span><button onclick={refresh}>Refresh</button></div>
  {#each data.rows as row (row.id)}
    {#if ['activity','economy'].includes(section)}
      <details class="audit-row" name="admin-audit"><summary><span><strong>{title(row)}</strong><small>{#if section === 'activity'}{row.actor.username} <AdminBadge isAdmin={row.actor.isAdmin}/> → {row.target.username} <AdminBadge isAdmin={row.target.isAdmin}/>{:else}{detail(row)} <AdminBadge isAdmin={row.receiver.isAdmin}/>{/if}</small></span><time>{stamp(row)}</time></summary>
      <div class="audit-detail">{#if section==='activity'}<p>Reason: {row.payload.reason || 'No reason recorded'}</p><dl>{#each Object.entries(row.receipt.before || {}) as [key,value]}<dt>{key}</dt><dd>{String(value ?? '—')} → {String(row.receipt.user?.[key] ?? '—')}</dd>{/each}</dl><details><summary>Full receipt</summary><pre>{JSON.stringify(row.receipt,null,2)}</pre></details><a href={`/admin?section=players&id=${row.targetId}`}>Inspect player</a>{:else}<p>From: {row.sender?.username || 'System'} · To: {row.receiver.username}</p><a href={`/admin?section=players&id=${row.receiverId}`}>Inspect player</a>{/if}</div>
      </details>
    {:else}
      <button class="record" class:selected={String(row.id)===id} onclick={() => navigate({id:row.id})}><span class="record-name"><strong>{#if section === 'live'}{row.redPlayer.username} <AdminBadge isAdmin={row.redPlayer.isAdmin}/> vs {row.blackPlayer.username} <AdminBadge isAdmin={row.blackPlayer.isAdmin}/>{:else if section === 'games'}{row.redPlayer} <AdminBadge username={row.redPlayer}/> vs {row.blackPlayer} <AdminBadge username={row.blackPlayer}/>{:else}{title(row)}{/if} {#if section==='players'}<AdminBadge isAdmin={row.isAdmin}/>{/if}</strong><small>#{row.id}{#if section==='players'} · {row.guestRetiredAt?'Retired':row.isBot?'Bot':row.isGuest?'Guest':'Registered'}{/if}</small></span><span class="record-detail">{detail(row)}</span><time>{stamp(row)}</time></button>
    {/if}
  {:else}<p class="empty">No matching records.</p>{/each}
  <div class="pagination"><button class="btn btn-dark" disabled={offset===0} onclick={() => navigate({offset:Math.max(0,offset-25),id:null})}>Previous</button><span>Page {Math.floor(offset/25)+1}</span><button class="btn btn-dark" disabled={data.nextOffset===null} onclick={() => navigate({offset:data.nextOffset,id:null})}>Next</button></div>
{/if}
{/snippet}
</AdminResource>
</section>
{#if id}<aside class="detail-pane"><button class="back btn btn-dark" onclick={() => navigate({id:null})}>Back to list</button>{#key `${section}/${id}`}<AdminInspector {section} {id}/>{/key}</aside>{/if}
</div>
</main>
</div>
{/if}
</div>
<style>
.admin-shell{height:100dvh;display:flex;flex-direction:column;overflow:hidden;background:var(--bg);color:var(--text)}.admin-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid var(--surface2);flex:none}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:10px;color:var(--text-dim)}h1{font-size:20px}h2{font-size:20px}h3{font-size:16px}.header-actions{display:flex;align-items:center;gap:8px}.workspace{display:flex;flex:1;min-height:0;flex-direction:column}.admin-nav{display:flex;overflow-x:auto;scrollbar-width:none;gap:4px;padding:8px;border-bottom:1px solid var(--surface2);flex:none}.admin-nav a{display:flex;align-items:center;min-height:44px;padding:8px 12px;border-radius:8px;white-space:nowrap;color:var(--text-dim);text-decoration:none;font-size:13px}.admin-nav a[aria-current]{background:var(--surface2);color:var(--text);font-weight:700}.admin-identity{display:none}main{padding:16px;overflow:auto;min-height:0;flex:1;min-width:0}.section-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}.filters{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-bottom:16px}.filters label{display:grid;gap:6px;font-size:12px;color:var(--text-dim)}.search{flex:1;min-width:140px}input,select{background:var(--surface);color:var(--text);border:1px solid var(--surface2);border-radius:8px;min-height:44px;padding:10px;font:inherit;width:100%}.segments{display:flex;gap:4px}.segments button{min-height:44px;padding:8px 12px;border:0;background:var(--surface);color:var(--text-dim);border-radius:8px;cursor:pointer}.segments button[aria-pressed=true]{background:var(--surface2);color:var(--text)}.panes{display:grid;gap:20px;min-width:0}.records,.detail-pane{min-width:0}.mobile-hidden{display:none}.detail-pane{padding:16px;background:var(--surface);border-radius:var(--radius-md)}.back{margin-bottom:16px}.metrics{display:grid;grid-template-columns:1fr 1fr;gap:12px}.metrics a{padding:16px;background:var(--surface);border-radius:var(--radius-md);display:grid;gap:8px;color:var(--text);text-decoration:none}.metrics span{font-size:12px;color:var(--text-dim)}.metrics strong{font-size:30px}.health{padding:20px;background:var(--surface);border-radius:var(--radius-md);display:grid;gap:10px;margin:20px 0}.health p,.health a{font-size:13px}.activity-preview{padding:12px 0;border-bottom:1px solid var(--surface2);font-size:13px}.activity-preview small{display:block;color:var(--text-dim);margin-top:4px}.updated{font-size:12px;color:var(--text-dim);margin-top:16px}.updated button,.list-heading button{background:none;border:0;color:var(--accent);min-height:44px;cursor:pointer}.list-heading{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--text-dim)}.record{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 12px;text-align:left;padding:14px 10px;border:0;border-bottom:1px solid var(--surface2);background:transparent;color:var(--text);font:inherit;cursor:pointer}.record:hover,.record.selected{background:var(--surface2)}.record-name{grid-row:span 2;min-width:0}.record strong{font-size:13px;overflow-wrap:anywhere}.record small{display:block;font-size:12px;color:var(--text-dim);margin-top:4px}.record-detail{font-size:12px;text-align:right;color:var(--text-dim);max-width:140px}time{font-size:11px;color:var(--text-dim);text-align:right}.pagination{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:20px;font-size:12px}.buffer{padding:12px;background:color-mix(in srgb,var(--success) 10%,var(--surface));border-radius:8px;font-size:13px}.attention{color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,var(--surface))}.empty{padding:24px 0;color:var(--text-dim)}.audit-row{border-bottom:1px solid var(--surface2)}summary{display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;padding:14px 0;min-height:44px}summary strong{font-size:13px}summary small{display:block;font-size:12px;color:var(--text-dim);margin-top:5px}.audit-detail{padding:12px;background:var(--surface);font-size:13px;display:grid;gap:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;max-height:250px;overflow:auto}dl{display:grid;grid-template-columns:1fr 2fr;gap:8px}dd{margin:0}.access{padding:24px;display:grid;gap:16px}button:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media(min-width:900px){.workspace{flex-direction:row}.admin-nav{width:180px;flex-direction:column;border-right:1px solid var(--surface2);border-bottom:0;padding:16px 10px}.admin-identity{display:block;padding:16px 12px;margin-top:auto;font-size:13px;color:var(--text-dim)}main{padding:24px}.metrics{grid-template-columns:repeat(4,1fr)}.record{grid-template-columns:minmax(120px,1.5fr) minmax(100px,1fr) 130px;align-items:center}.record-name{grid-row:auto}.record-detail{max-width:none;text-align:left}.admin-header{padding:14px 24px}}
@media(max-width:1099px){.detail-filter{display:none}}
@media(min-width:1100px){.panes.with-detail{grid-template-columns:minmax(300px,1fr) minmax(360px,480px)}.mobile-hidden{display:block}.detail-pane{align-self:start}.with-detail .record{grid-template-columns:minmax(0,1fr) auto}.with-detail .record-name{grid-row:span 2}.with-detail .record-detail{max-width:140px;text-align:right}}
</style>
