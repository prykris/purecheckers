<script>
  const boardCells = Array.from({ length: 64 }, (_, i) => {
    const row = Math.floor(i / 8);
    const col = i % 8;
    const isDark = (row + col) % 2 === 1;
    let piece = null;
    if (isDark && row < 3) piece = 'red';
    if (isDark && row > 4) piece = 'black';
    return { isDark, piece };
  });
</script>

<svelte:head>
  <title>Pure Checkers — Damas Online Gratis, Sin Anuncios</title>
  <meta name="description" content="Juega damas online gratis. Sin anuncios, sin barras de energia, sin compras. Crea salas, juega con amigos, gana ELO y disfruta damas como debe ser." />
</svelte:head>

<section class="hero" id="top">
  <h1 class="hero-logo"><span class="shimmer">Pure</span> Checkers</h1>
  <div class="board" aria-label="Tablero de damas con piezas en posicion inicial">
    {#each boardCells as cell}
      <div class="cell" class:dark={cell.isDark} class:light={!cell.isDark}>
        {#if cell.piece}
          <div class="piece" class:piece-red={cell.piece === 'red'} class:piece-black={cell.piece === 'black'}></div>
        {/if}
      </div>
    {/each}
  </div>
  <a href="/auth" class="play-btn">Jugar Ahora — Es Gratis</a>
  <p class="hero-note">No necesitas cuenta. Elige un apodo y juega.</p>
</section>

<section class="section" id="story">
  <h2 class="section-title">Por Que Existe Pure Checkers</h2>
  <div class="prose">
    <p>Cuando empece a buscar apps en mi telefono para jugar damas, encontre muchas, pero todas tenian anuncios o peor — una barra de energia tan limitada que despues de dos partidas no podia jugar mas a menos que viera un anuncio doloroso de algun juego hecho por una corporacion para sacar dinero.</p>
    <p>Por solo 5 dolares podia renovar mi energia y jugar 10 partidas mas, te lo imaginas? Este hosting me cuesta 5 dolares al mes, y miles pueden jugar gratis, liberados para siempre de los codiciosos!</p>
    <p>Esto lo hice para mi mismo, pero lo prepare para que cualquiera lo disfrute. Me tomo unos dias hacerlo pero ya recupere mi inversion aunque nunca haya jugadores aqui. Seguire agregando funciones y pensando en los jugadores en vez de en ganancias.</p>
  </div>
</section>

<section class="section" id="features">
  <h2 class="section-title">Lo Que Obtienes</h2>
  <div class="features-list">
    <div class="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><div><h3>Sin Anuncios. Nunca.</h3><p>Sin banners, sin popups, sin video ads. Solo el juego.</p></div></div>
    <div class="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><div><h3>Gratis Para Todos. Siempre.</h3><p>Sin compras dentro de la app, sin barras de energia, sin muros de pago.</p></div></div>
    <div class="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><div><h3>Sin Registro</h3><p>Elige un apodo y juega. Crea una cuenta despues si quieres guardar tus estadisticas.</p></div></div>
    <div class="feature-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg><div><h3>Funciona en Cualquier Dispositivo</h3><p>Cualquiera con un navegador puede jugar — PC, telefono, tablet.</p></div></div>
  </div>
</section>

<section class="section" id="about">
  <h2 class="section-title">Acerca De</h2>
  <blockquote class="about-quote">
    Mi nombre es Chris. Hice este mundo para nosotros, en el que todos somos iguales y solo nos diferencia la habilidad. Gratis para todos, gratis para siempre. Que la habilidad nos divida, que gane el mejor!
  </blockquote>
</section>

<style>
  .hero { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100dvh; padding: var(--sp-lg) var(--sp-md); gap: var(--sp-lg); }
  .hero-logo { font-size: var(--fs-title); letter-spacing: 2px; color: var(--text); text-align: center; }
  .shimmer { color: var(--accent); background: linear-gradient(120deg, var(--accent) 0%, #ff8a8a 40%, #fff 50%, #ff8a8a 60%, var(--accent) 100%); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; animation: shimmer 2.5s ease-in-out forwards; }
  @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
  .board { display: grid; grid-template-columns: repeat(8, 1fr); aspect-ratio: 1; width: min(300px, 50dvh, 80vw); flex-shrink: 1; min-height: 0; border-radius: var(--radius-md); overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.5); }
  .cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; }
  .cell.light { background: var(--board-light); }
  .cell.dark { background: var(--board-dark); }
  .piece { width: 65%; height: 65%; border-radius: 50%; }
  .piece-red { background: radial-gradient(circle at 35% 35%, #f87171, #dc2626); box-shadow: 0 2px 4px rgba(0,0,0,0.4); }
  .piece-black { background: radial-gradient(circle at 35% 35%, #44403c, #1c1917); box-shadow: 0 2px 4px rgba(0,0,0,0.4); }
  .play-btn { display: inline-block; padding: var(--sp-md) var(--sp-xl); font-size: 1.2rem; font-weight: 700; font-family: var(--font); background: linear-gradient(135deg, var(--accent), #dc2626); color: #fff; border-radius: var(--radius-sm); text-decoration: none; box-shadow: 0 4px 16px rgba(239,68,68,0.25); transition: transform 0.2s, box-shadow 0.2s; }
  .play-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(239,68,68,0.35); }
  .hero-note { font-size: var(--fs-caption); color: var(--text-dim); text-align: center; }
  .section { padding: 64px var(--sp-md); max-width: 800px; margin: 0 auto; }
  .section-title { font-size: var(--fs-title); font-weight: 700; text-align: center; margin-bottom: var(--sp-sm); }
  .prose { max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--sp-lg); }
  .prose p { color: var(--text-dim); font-size: var(--fs-body); line-height: 1.8; }
  .about-quote { max-width: 640px; margin: 0 auto var(--sp-xl); padding: var(--sp-lg) var(--sp-xl); border-left: 3px solid var(--accent); font-size: var(--fs-heading); font-weight: 600; font-style: italic; line-height: 1.6; color: var(--text); }
  .features-list { display: flex; flex-direction: column; gap: var(--sp-lg); max-width: 640px; margin: 0 auto; }
  .feature-item { display: flex; align-items: flex-start; gap: var(--sp-md); }
  .feature-item :global(svg) { color: var(--accent); flex-shrink: 0; margin-top: 3px; }
  .feature-item h3 { font-size: var(--fs-body); font-weight: 600; margin-bottom: 2px; }
  .feature-item p { color: var(--text-dim); font-size: var(--fs-caption); line-height: 1.5; }
  @media (min-width: 600px) { .board { width: min(360px, 50dvh, 80vw); } }
  @media (min-width: 900px) { .board { width: min(400px, 50dvh, 80vw); } }
</style>
