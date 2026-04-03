import { k as head, g as ensure_array_like, a as attr_class } from "../../../../chunks/index2.js";
function _page($$renderer) {
  const boardCells = Array.from({ length: 64 }, (_, i) => {
    const row = Math.floor(i / 8);
    const col = i % 8;
    const isDark = (row + col) % 2 === 1;
    let piece = null;
    if (isDark && row < 3) piece = "red";
    if (isDark && row > 4) piece = "black";
    return { isDark, piece };
  });
  head("1atbhhx", $$renderer, ($$renderer2) => {
    $$renderer2.title(($$renderer3) => {
      $$renderer3.push(`<title>Pure Checkers — Damas Online Gratis, Sin Anuncios</title>`);
    });
    $$renderer2.push(`<meta name="description" content="Juega damas online gratis. Sin anuncios, sin barras de energia, sin compras. Crea salas, juega con amigos, gana ELO y disfruta damas como debe ser." class="svelte-1atbhhx"/>`);
  });
  $$renderer.push(`<section class="hero svelte-1atbhhx" id="top"><h1 class="hero-logo svelte-1atbhhx"><span class="shimmer svelte-1atbhhx">Pure</span> Checkers</h1> <div class="board svelte-1atbhhx" aria-label="Tablero de damas con piezas en posicion inicial"><!--[-->`);
  const each_array = ensure_array_like(boardCells);
  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
    let cell = each_array[$$index];
    $$renderer.push(`<div${attr_class("cell svelte-1atbhhx", void 0, { "dark": cell.isDark, "light": !cell.isDark })}>`);
    if (cell.piece) {
      $$renderer.push("<!--[0-->");
      $$renderer.push(`<div${attr_class("piece svelte-1atbhhx", void 0, {
        "piece-red": cell.piece === "red",
        "piece-black": cell.piece === "black"
      })}></div>`);
    } else {
      $$renderer.push("<!--[-1-->");
    }
    $$renderer.push(`<!--]--></div>`);
  }
  $$renderer.push(`<!--]--></div> <a href="/auth" class="play-btn svelte-1atbhhx">Jugar Ahora — Es Gratis</a> <p class="hero-note svelte-1atbhhx">No necesitas cuenta. Elige un apodo y juega.</p></section> <section class="section svelte-1atbhhx" id="story"><h2 class="section-title svelte-1atbhhx">Por Que Existe Pure Checkers</h2> <div class="prose svelte-1atbhhx"><p class="svelte-1atbhhx">Cuando empece a buscar apps en mi telefono para jugar damas, encontre muchas, pero todas tenian anuncios o peor — una barra de energia tan limitada que despues de dos partidas no podia jugar mas a menos que viera un anuncio doloroso de algun juego hecho por una corporacion para sacar dinero.</p> <p class="svelte-1atbhhx">Por solo 5 dolares podia renovar mi energia y jugar 10 partidas mas, te lo imaginas? Este hosting me cuesta 5 dolares al mes, y miles pueden jugar gratis, liberados para siempre de los codiciosos!</p> <p class="svelte-1atbhhx">Esto lo hice para mi mismo, pero lo prepare para que cualquiera lo disfrute. Me tomo unos dias hacerlo pero ya recupere mi inversion aunque nunca haya jugadores aqui. Seguire agregando funciones y pensando en los jugadores en vez de en ganancias.</p></div></section> <section class="section svelte-1atbhhx" id="features"><h2 class="section-title svelte-1atbhhx">Lo Que Obtienes</h2> <div class="features-list svelte-1atbhhx"><div class="feature-item svelte-1atbhhx"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" class="svelte-1atbhhx"><line x1="18" y1="6" x2="6" y2="18" class="svelte-1atbhhx"></line><line x1="6" y1="6" x2="18" y2="18" class="svelte-1atbhhx"></line></svg><div class="svelte-1atbhhx"><h3 class="svelte-1atbhhx">Sin Anuncios. Nunca.</h3><p class="svelte-1atbhhx">Sin banners, sin popups, sin video ads. Solo el juego.</p></div></div> <div class="feature-item svelte-1atbhhx"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" class="svelte-1atbhhx"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" class="svelte-1atbhhx"></path></svg><div class="svelte-1atbhhx"><h3 class="svelte-1atbhhx">Gratis Para Todos. Siempre.</h3><p class="svelte-1atbhhx">Sin compras dentro de la app, sin barras de energia, sin muros de pago.</p></div></div> <div class="feature-item svelte-1atbhhx"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" class="svelte-1atbhhx"><circle cx="12" cy="12" r="10" class="svelte-1atbhhx"></circle><line x1="12" y1="8" x2="12" y2="12" class="svelte-1atbhhx"></line><line x1="12" y1="16" x2="12.01" y2="16" class="svelte-1atbhhx"></line></svg><div class="svelte-1atbhhx"><h3 class="svelte-1atbhhx">Sin Registro</h3><p class="svelte-1atbhhx">Elige un apodo y juega. Crea una cuenta despues si quieres guardar tus estadisticas.</p></div></div> <div class="feature-item svelte-1atbhhx"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" class="svelte-1atbhhx"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" class="svelte-1atbhhx"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" class="svelte-1atbhhx"></path></svg><div class="svelte-1atbhhx"><h3 class="svelte-1atbhhx">Funciona en Cualquier Dispositivo</h3><p class="svelte-1atbhhx">Cualquiera con un navegador puede jugar — PC, telefono, tablet.</p></div></div></div></section> <section class="section svelte-1atbhhx" id="about"><h2 class="section-title svelte-1atbhhx">Acerca De</h2> <blockquote class="about-quote svelte-1atbhhx">Mi nombre es Chris. Hice este mundo para nosotros, en el que todos somos iguales y solo nos diferencia la habilidad. Gratis para todos, gratis para siempre. Que la habilidad nos divida, que gane el mejor!</blockquote></section>`);
}
export {
  _page as default
};
