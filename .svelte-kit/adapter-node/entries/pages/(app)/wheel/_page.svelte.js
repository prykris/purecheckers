import "clsx";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import "socket.io-client";
function WheelScreen($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<div class="page-center"><div class="wheel-screen svelte-1pfpvxv"><h2 class="svelte-1pfpvxv">Picking your color...</h2> <div class="wheel-container svelte-1pfpvxv"><div class="pointer svelte-1pfpvxv"></div> <div class="wheel svelte-1pfpvxv"><span class="wl wl-red svelte-1pfpvxv">RED</span> <span class="wl wl-black svelte-1pfpvxv">BLACK</span></div></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
function _page($$renderer) {
  WheelScreen($$renderer);
}
export {
  _page as default
};
