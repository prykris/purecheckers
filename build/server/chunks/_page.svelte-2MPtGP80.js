import { h as store_get, d as escape_html, j as unsubscribe_stores } from './index2-XvOMkuwj.js';
import '@sveltejs/kit/internal';
import './root-DaKe__1o.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-Dz5XAtR1.js';
import { p as presenceStats, b as phase } from './app-DqaBjBPS.js';
import './index-CRXnUj0b.js';
import './index-Dv3MCDRn.js';
import 'fs';
import 'url';
import 'child_process';
import 'http';
import 'https';
import 'tty';
import 'util';
import 'os';
import 'events';
import 'net';
import 'tls';
import 'crypto';
import 'stream';
import 'zlib';
import 'buffer';

function SearchScreen($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let others;
    let cancelling = false;
    others = store_get($$store_subs ??= {}, "$presenceStats", presenceStats).lookingToPlay - 1;
    if (store_get($$store_subs ??= {}, "$phase", phase) === "idle" && cancelling) ;
    $$renderer2.push(`<div class="page-center"><div class="search svelte-8kbg9g"><div class="spinner"></div> <p class="svelte-8kbg9g">Looking for an opponent...</p> `);
    if (others > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="count svelte-8kbg9g">${escape_html(others)} other ${escape_html(others === 1 ? "player" : "players")} looking to play</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<p class="count svelte-8kbg9g">No other players searching right now</p>`);
    }
    $$renderer2.push(`<!--]--> <div class="search-actions svelte-8kbg9g"><button class="btn btn-dark btn-small">Minimize</button> <button class="btn btn-dark btn-small">Cancel</button></div></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _page($$renderer) {
  SearchScreen($$renderer);
}

export { _page as default };
//# sourceMappingURL=_page.svelte-2MPtGP80.js.map
