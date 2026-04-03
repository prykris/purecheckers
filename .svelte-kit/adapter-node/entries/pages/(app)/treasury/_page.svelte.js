import "clsx";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
function TreasuryScreen($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<div class="page-scroll"><div class="page-content treasury svelte-1um1i8f"><button class="btn btn-dark btn-small back svelte-1um1i8f">Back</button> <h2 class="svelte-1um1i8f">Community Treasury</h2> <p class="subtitle svelte-1um1i8f">Every coin has a history. This economy belongs to the players.</p> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="spinner"></div>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
function _page($$renderer) {
  TreasuryScreen($$renderer);
}
export {
  _page as default
};
