import { p as ensure_array_like, f as attr_class, q as attr, d as escape_html } from './index2-XvOMkuwj.js';

function AuthScreen($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let loading = false;
    let guestName = "";
    const boardCells = Array.from({ length: 64 }, (_, i) => {
      const row = Math.floor(i / 8);
      const col = i % 8;
      const isDark = (row + col) % 2 === 1;
      let piece = null;
      if (isDark && row < 3) piece = "red";
      if (isDark && row > 4) piece = "black";
      return { isDark, piece };
    });
    $$renderer2.push(`<div class="page-center svelte-1qaca2q"><div class="auth-wrapper svelte-1qaca2q"><h1 class="logo svelte-1qaca2q"><span class="shimmer svelte-1qaca2q">Pure</span> Checkers</h1> <div class="board svelte-1qaca2q"><!--[-->`);
    const each_array = ensure_array_like(boardCells);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let cell = each_array[$$index];
      $$renderer2.push(`<div${attr_class("cell svelte-1qaca2q", void 0, { "dark": cell.isDark, "light": !cell.isDark })}>`);
      if (cell.piece) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div${attr_class("piece svelte-1qaca2q", void 0, {
          "piece-red": cell.piece === "red",
          "piece-black": cell.piece === "black"
        })}></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="hero-play svelte-1qaca2q"><input class="input guest-input svelte-1qaca2q" type="text"${attr("value", guestName)} placeholder="Enter a nickname" maxlength="20"/> <button class="btn btn-primary play-btn svelte-1qaca2q"${attr("disabled", loading, true)}>${escape_html("Play")}</button></div> <button class="sign-in-link svelte-1qaca2q">${escape_html("Already have an account? Sign in")}</button> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
function _page($$renderer) {
  AuthScreen($$renderer);
}

export { _page as default };
//# sourceMappingURL=_page.svelte-LbxN0iFY.js.map
