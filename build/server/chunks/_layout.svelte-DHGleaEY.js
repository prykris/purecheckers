import { f as attr_class, h as store_get, d as escape_html, j as unsubscribe_stores, k as derived, l as fallback, m as stringify, n as slot, o as bind_props, p as ensure_array_like, q as attr } from './index2-XvOMkuwj.js';
import '@sveltejs/kit/internal';
import './root-DaKe__1o.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-Dz5XAtR1.js';
import { p as page } from './index3-JJ2XLFgZ.js';
import './index-CRXnUj0b.js';
import { a as activeRoom, s as searching } from './app-DqaBjBPS.js';
import { o as onDestroy } from './index-server-Da89eJJ6.js';
import { u as user } from './user-1rIFtvS3.js';
import './client-BwqJHZRc.js';
import './client2-DeMnZtql.js';
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

let socket = null;
function getSocket() {
  return socket;
}
function BottomNav($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<nav class="tab-bar svelte-oeh3u8"><button${attr_class("tab svelte-oeh3u8", void 0, { "active": page.url.pathname === "/lobby" })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-oeh3u8"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg> <span>Play</span></button> <button${attr_class("tab svelte-oeh3u8", void 0, { "active": page.url.pathname === "/shop" })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-oeh3u8"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 01-8 0"></path></svg> <span>Shop</span></button> <button${attr_class("tab svelte-oeh3u8", void 0, { "active": page.url.pathname === "/friends" })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-oeh3u8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 00-3-3.87"></path><path d="M16 3.13a4 4 0 010 7.75"></path></svg> <span>Friends</span></button> <button${attr_class("tab svelte-oeh3u8", void 0, { "active": page.url.pathname === "/profile" })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-oeh3u8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> <span>Profile</span></button></nav>`);
  });
}
function RoomBanner($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let playerCount, hasOpponent, allReady, opponentName, opponentOnline, dotClass, label, show;
    let leaving = false;
    if (!store_get($$store_subs ??= {}, "$activeRoom", activeRoom)) leaving = false;
    playerCount = store_get($$store_subs ??= {}, "$activeRoom", activeRoom)?.players?.length || 0;
    hasOpponent = playerCount >= 2;
    allReady = hasOpponent && store_get($$store_subs ??= {}, "$activeRoom", activeRoom)?.players?.every((p) => p.ready);
    opponentName = store_get($$store_subs ??= {}, "$activeRoom", activeRoom)?.players?.[1]?.username || "";
    opponentOnline = store_get($$store_subs ??= {}, "$activeRoom", activeRoom)?.players?.[1]?.online !== false;
    dotClass = allReady ? "ready" : hasOpponent ? "joined" : "waiting";
    label = allReady ? "Ready!" : hasOpponent ? opponentOnline ? opponentName : `${opponentName} (away)` : "Waiting...";
    show = store_get($$store_subs ??= {}, "$activeRoom", activeRoom) && !leaving && page.url.pathname !== "/room-waiting" && page.url.pathname !== "/game" && page.url.pathname !== "/wheel" && page.url.pathname !== "/auth";
    if (show) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div${attr_class("room-pill svelte-1it9tf", void 0, { "joined": hasOpponent, "ready": allReady })} role="button" tabindex="0"><span${attr_class(`dot ${stringify(dotClass)}`, "svelte-1it9tf")}></span> <span class="pill-text svelte-1it9tf">${escape_html(label)}</span> <span class="pill-close svelte-1it9tf" role="button" tabindex="0" title="Leave room"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10" class="svelte-1it9tf"><line x1="18" y1="6" x2="6" y2="18" class="svelte-1it9tf"></line><line x1="6" y1="6" x2="18" y2="18" class="svelte-1it9tf"></line></svg></span></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function SearchBanner($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let show;
    show = store_get($$store_subs ??= {}, "$searching", searching) && page.url.pathname !== "/search" && page.url.pathname !== "/wheel" && page.url.pathname !== "/game" && page.url.pathname !== "/auth";
    if (show) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="search-pill svelte-seio2q" role="button" tabindex="0"><span class="dot svelte-seio2q"></span> <span class="pill-text svelte-seio2q">Searching...</span> <span class="pill-close svelte-seio2q" role="button" tabindex="0" title="Cancel search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10" class="svelte-seio2q"><line x1="18" y1="6" x2="6" y2="18" class="svelte-seio2q"></line><line x1="6" y1="6" x2="18" y2="18" class="svelte-seio2q"></line></svg></span></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function SlidePanel($$renderer, $$props) {
  let open = fallback($$props["open"], false);
  let side = fallback(
    $$props["side"],
    "left"
    // 'left' | 'right'
  );
  let title = fallback($$props["title"], "");
  if (open) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<div class="backdrop svelte-1woex49" role="presentation" tabindex="-1"></div>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--> <div${attr_class(`panel ${stringify(side)}`, "svelte-1woex49", { "open": open })}><div class="panel-header svelte-1woex49"><h3 class="svelte-1woex49">${escape_html(title)}</h3> <button class="close-btn svelte-1woex49" aria-label="Close panel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svelte-1woex49"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div> <div class="panel-body svelte-1woex49"><!--[-->`);
  slot($$renderer, $$props, "default", {});
  $$renderer.push(`<!--]--></div></div>`);
  bind_props($$props, { open, side, title });
}
function GlobalChat($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let visible = fallback($$props["visible"], false);
    let messages = [];
    let input = "";
    let socket2 = null;
    let attached = false;
    function attach() {
      socket2 = getSocket();
      if (!socket2) return;
      if (attached) return;
      attached = true;
      socket2.on("chat:message", onMsg);
      socket2.on("chat:history", onHistory);
      socket2.emit("chat:history", { channelId: "global" });
    }
    onDestroy(() => {
      if (socket2) {
        socket2.off("chat:message", onMsg);
        socket2.off("chat:history", onHistory);
      }
    });
    function onMsg(msg) {
      if (msg.channelId !== "global") return;
      messages = [...messages, msg];
      scrollDown();
    }
    function onHistory({ channelId, messages: msgs }) {
      if (channelId !== "global") return;
      messages = msgs;
      scrollDown();
    }
    function scrollDown() {
      requestAnimationFrame(() => {
      });
    }
    if (visible && !attached) attach();
    $$renderer2.push(`<div class="chat-content svelte-lv2pt1"><div class="messages svelte-lv2pt1">`);
    if (messages.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="empty svelte-lv2pt1">No messages yet. Say hi!</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--[-->`);
      const each_array = ensure_array_like(messages);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let msg = each_array[$$index];
        $$renderer2.push(`<div class="msg svelte-lv2pt1"><strong class="svelte-lv2pt1">${escape_html(msg.username)}</strong> <span class="svelte-lv2pt1">${escape_html(msg.content)}</span></div>`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div> <div class="input-row svelte-lv2pt1"><input class="input" type="text"${attr("value", input)} placeholder="Type a message..." maxlength="300"/> <button class="btn btn-primary btn-small" aria-label="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></button></div></div>`);
    bind_props($$props, { visible });
  });
}
function LeaderboardPanel($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let players = [];
    $$renderer2.push(`<div class="lb-content svelte-1wny9vb">`);
    if (players.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="empty svelte-1wny9vb">No ranked games yet</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<table class="svelte-1wny9vb"><thead><tr><th class="rank svelte-1wny9vb">#</th><th class="svelte-1wny9vb">Player</th><th class="svelte-1wny9vb">ELO</th><th class="w svelte-1wny9vb">W</th><th class="l svelte-1wny9vb">L</th></tr></thead><tbody><!--[-->`);
      const each_array = ensure_array_like(players.slice(0, 20));
      for (let i = 0, $$length = each_array.length; i < $$length; i++) {
        let p = each_array[i];
        $$renderer2.push(`<tr${attr_class("svelte-1wny9vb", void 0, {
          "me": p.id === store_get($$store_subs ??= {}, "$user", user)?.id
        })}><td class="rank svelte-1wny9vb">${escape_html(i + 1)}</td><td class="name svelte-1wny9vb">${escape_html(p.username)}</td><td class="svelte-1wny9vb">${escape_html(p.elo)}</td><td class="w svelte-1wny9vb">${escape_html(p.wins)}</td><td class="l svelte-1wny9vb">${escape_html(p.losses)}</td></tr>`);
      }
      $$renderer2.push(`<!--]--></tbody></table>`);
    }
    $$renderer2.push(`<!--]--></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children } = $$props;
    const tabRoutes = ["/lobby", "/shop", "/friends", "/profile"];
    const currentPath = derived(() => page.url.pathname);
    const showTabs = derived(() => tabRoutes.some((r) => currentPath().startsWith(r)));
    const showPanelToggles = derived(() => currentPath() !== "/auth" && currentPath() !== "/game" && !loading);
    let chatOpen = false;
    let lbOpen = false;
    let loading = true;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="splash svelte-1v2axqk"><h1 class="splash-title svelte-1v2axqk">Checkers</h1> <div class="splash-spinner svelte-1v2axqk"></div></div>`);
      }
      $$renderer3.push(`<!--]--> `);
      RoomBanner($$renderer3);
      $$renderer3.push(`<!----> `);
      SearchBanner($$renderer3);
      $$renderer3.push(`<!----> <div${attr_class("app svelte-1v2axqk", void 0, { "hidden": loading })}>`);
      children($$renderer3);
      $$renderer3.push(`<!----> `);
      if (showTabs()) {
        $$renderer3.push("<!--[0-->");
        BottomNav($$renderer3);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      if (showPanelToggles()) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<button class="edge-toggle left svelte-1v2axqk" title="Global Chat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"></path></svg></button> <button class="edge-toggle right svelte-1v2axqk" title="Leaderboard"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 20V10"></path><path d="M18 20V4"></path><path d="M6 20v-4"></path></svg></button>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      SlidePanel($$renderer3, {
        side: "left",
        title: "Global Chat",
        get open() {
          return chatOpen;
        },
        set open($$value) {
          chatOpen = $$value;
          $$settled = false;
        },
        children: ($$renderer4) => {
          GlobalChat($$renderer4, { visible: chatOpen });
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      SlidePanel($$renderer3, {
        side: "right",
        title: "Leaderboard",
        get open() {
          return lbOpen;
        },
        set open($$value) {
          lbOpen = $$value;
          $$settled = false;
        },
        children: ($$renderer4) => {
          LeaderboardPanel($$renderer4);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----></div>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}

export { _layout as default };
//# sourceMappingURL=_layout.svelte-DHGleaEY.js.map
