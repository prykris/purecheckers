import { d as escape_html, h as store_get, j as unsubscribe_stores, f as attr_class } from './index2-XvOMkuwj.js';
import '@sveltejs/kit/internal';
import './root-DaKe__1o.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-Dz5XAtR1.js';
import { p as presenceStats, b as phase } from './app-DqaBjBPS.js';
import { u as user } from './user-1rIFtvS3.js';
import './index-CRXnUj0b.js';
import { o as onDestroy } from './index-server-Da89eJJ6.js';
import { g as goto } from './client2-DeMnZtql.js';
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

function QuickPlay($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    if (store_get($$store_subs ??= {}, "$phase", phase) === "matchmaking") {
      goto();
    }
    $$renderer2.push(`<div class="quick svelte-mtn8qi"><div class="elo-display svelte-mtn8qi"><span class="elo-label svelte-mtn8qi">Your Rating</span> <span class="elo-value svelte-mtn8qi">${escape_html(store_get($$store_subs ??= {}, "$user", user)?.elo || 1e3)}</span></div> <button class="btn btn-primary play-btn svelte-mtn8qi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Find Opponent</button> <button class="btn btn-dark play-btn svelte-mtn8qi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 00-3-3.87"></path><path d="M16 3.13a4 4 0 010 7.75"></path></svg> Play vs Friend</button></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function PlayTabs($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let activeTab = "quick";
    onDestroy(() => {
    });
    $$renderer2.push(`<div class="play-tabs svelte-6hewlt"><div class="tab-row svelte-6hewlt"><button${attr_class("tab svelte-6hewlt", void 0, { "active": activeTab === "quick" })}>Quick Play</button> <button${attr_class("tab svelte-6hewlt", void 0, { "active": activeTab === "rooms" })}>Rooms `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></button> <button${attr_class("tab svelte-6hewlt", void 0, { "active": activeTab === "bot" })}>Bot</button></div> <div class="tab-content svelte-6hewlt">`);
    {
      $$renderer2.push("<!--[0-->");
      QuickPlay($$renderer2);
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
function Lobby($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    localStorage.getItem("checkers_theme") || "Default";
    $$renderer2.push(`<div class="lobby-layout svelte-1pl19bw"><div class="top-header svelte-1pl19bw"><h1 class="title svelte-1pl19bw">Checkers <span class="svelte-1pl19bw">Online</span></h1> <div class="presence-stats svelte-1pl19bw"><span class="stat-pill online svelte-1pl19bw"><span class="pulse-dot svelte-1pl19bw"></span>${escape_html(store_get($$store_subs ??= {}, "$presenceStats", presenceStats).online)} online</span> `);
    if (store_get($$store_subs ??= {}, "$presenceStats", presenceStats).lookingToPlay > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="stat-pill looking svelte-1pl19bw">${escape_html(store_get($$store_subs ??= {}, "$presenceStats", presenceStats).lookingToPlay)} looking to play</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="card user-bar svelte-1pl19bw"><div class="user-info svelte-1pl19bw"><strong class="svelte-1pl19bw">${escape_html(store_get($$store_subs ??= {}, "$user", user)?.username)}</strong> <span class="stat svelte-1pl19bw">ELO ${escape_html(store_get($$store_subs ??= {}, "$user", user)?.elo || 1e3)}</span> <span class="stat gold svelte-1pl19bw">${escape_html(store_get($$store_subs ??= {}, "$user", user)?.coins || 0)} coins</span></div> <div class="header-actions svelte-1pl19bw"><button class="icon-btn svelte-1pl19bw" title="Theme"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" class="svelte-1pl19bw"><circle cx="12" cy="12" r="5" class="svelte-1pl19bw"></circle><line x1="12" y1="1" x2="12" y2="3" class="svelte-1pl19bw"></line><line x1="12" y1="21" x2="12" y2="23" class="svelte-1pl19bw"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" class="svelte-1pl19bw"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" class="svelte-1pl19bw"></line><line x1="1" y1="12" x2="3" y2="12" class="svelte-1pl19bw"></line><line x1="21" y1="12" x2="23" y2="12" class="svelte-1pl19bw"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" class="svelte-1pl19bw"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" class="svelte-1pl19bw"></line></svg></button> <button class="btn btn-dark btn-small svelte-1pl19bw">Logout</button></div></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="lobby-center svelte-1pl19bw">`);
    PlayTabs($$renderer2);
    $$renderer2.push(`<!----> `);
    if (store_get($$store_subs ??= {}, "$user", user)?.friendCode) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="friend-code svelte-1pl19bw">Your code: <strong class="svelte-1pl19bw">${escape_html(store_get($$store_subs ??= {}, "$user", user).friendCode)}</strong></p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <button class="treasury-link svelte-1pl19bw"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" class="svelte-1pl19bw"><rect x="3" y="11" width="18" height="11" rx="2" class="svelte-1pl19bw"></rect><path d="M7 11V7a5 5 0 0110 0v4" class="svelte-1pl19bw"></path></svg> Community Treasury</button></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _page($$renderer) {
  Lobby($$renderer);
}

export { _page as default };
//# sourceMappingURL=_page.svelte-CctG8FjK.js.map
