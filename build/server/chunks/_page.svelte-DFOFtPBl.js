import { h as store_get, d as escape_html, q as attr, p as ensure_array_like, f as attr_class, j as unsubscribe_stores } from './index2-XvOMkuwj.js';
import { o as onDestroy } from './index-server-Da89eJJ6.js';
import '@sveltejs/kit/internal';
import './root-DaKe__1o.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-Dz5XAtR1.js';
import { a as activeRoom, g as gameState } from './app-DqaBjBPS.js';
import { u as user } from './user-1rIFtvS3.js';
import './index-CRXnUj0b.js';
import { R as RoomChat } from './RoomChat-EpUSsInL.js';
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

function RoomWaiting($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let room, joinUrl, qrDataUrl, code, isHost, myPlayer, myReady;
    onDestroy(() => {
    });
    room = store_get($$store_subs ??= {}, "$activeRoom", activeRoom);
    joinUrl = room?.joinUrl || null;
    qrDataUrl = room?.qrDataUrl || store_get($$store_subs ??= {}, "$gameState", gameState)?.roomData?.qrDataUrl || null;
    code = room?.joinCode || "";
    isHost = room?.hostId === store_get($$store_subs ??= {}, "$user", user)?.id;
    myPlayer = room?.players?.find((p) => p.userId === store_get($$store_subs ??= {}, "$user", user)?.id);
    myReady = myPlayer?.ready || false;
    $$renderer2.push(`<div class="page-center"><div class="waiting svelte-1wksahx"><h2 class="svelte-1wksahx">Game Room</h2> `);
    if (room) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="settings-row svelte-1wksahx">`);
      if (room.settings.buyIn > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="tag gold svelte-1wksahx">Buy-in: ${escape_html(room.settings.buyIn)}c</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<span class="tag green svelte-1wksahx">Free</span>`);
      }
      $$renderer2.push(`<!--]--> <span class="tag svelte-1wksahx">Timer: ${escape_html(room.settings.turnTimer)}s</span> `);
      if (room.settings.allowSpectators) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="tag svelte-1wksahx">Spectators OK</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <div class="invite-section svelte-1wksahx">`);
      if (qrDataUrl) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<img class="qr-code svelte-1wksahx"${attr("src", qrDataUrl)} alt="Join QR code"/>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <span class="code-label svelte-1wksahx">Room Code</span> <span class="code svelte-1wksahx">${escape_html(code)}</span> `);
      if (joinUrl) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<button class="btn btn-dark btn-small copy-btn svelte-1wksahx"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path></svg> ${escape_html("Copy Link")}</button>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <p class="code-hint svelte-1wksahx">Scan QR or share the link to invite</p></div> <div class="slots svelte-1wksahx"><!--[-->`);
      const each_array = ensure_array_like([0, 1]);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let i = each_array[$$index];
        $$renderer2.push(`<div${attr_class("card slot svelte-1wksahx", void 0, { "filled": room.players[i], "ready": room.players[i]?.ready })}>`);
        if (room.players[i]) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="player-row svelte-1wksahx"><span${attr_class("presence-dot svelte-1wksahx", void 0, {
            "online": room.players[i].online !== false,
            "offline": room.players[i].online === false
          })}></span> <span class="pname svelte-1wksahx">${escape_html(room.players[i].username)} `);
          if (room.players[i].userId === store_get($$store_subs ??= {}, "$user", user)?.id) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="you-tag svelte-1wksahx">You</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></span> <span class="pelo svelte-1wksahx">ELO ${escape_html(room.players[i].elo)}</span> `);
          if (room.players[i].ready) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="ready-badge svelte-1wksahx">Ready</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`<span class="not-ready svelte-1wksahx">Not ready</span>`);
          }
          $$renderer2.push(`<!--]--> `);
          if (isHost && room.players[i].userId !== store_get($$store_subs ??= {}, "$user", user)?.id) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<button class="kick-btn svelte-1wksahx" title="Kick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<div class="empty-slot svelte-1wksahx"><div class="spinner-small svelte-1wksahx"></div> <span>Waiting for opponent...</span></div>`);
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]--></div> `);
      if (room.spectators?.length > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="spectators svelte-1wksahx">Spectators: ${escape_html(room.spectators.map((s) => s.username).join(", "))}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="actions svelte-1wksahx">`);
      if (room.players.length === 2) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<button${attr_class("btn", void 0, { "btn-primary": !myReady, "btn-secondary": myReady })}>${escape_html(myReady ? "Unready" : "Ready Up")}</button>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <button class="btn btn-dark btn-small">Back</button> <button class="btn btn-dark btn-small leave-btn svelte-1wksahx">${escape_html(isHost ? "Close Room" : "Leave")}</button></div> `);
      if (room.players.length < 2) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="waiting-hint svelte-1wksahx">Share the room code or wait for someone to join from the room list</p>`);
      } else if (!room.players.every((p) => p.ready)) {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`<p class="waiting-hint svelte-1wksahx">Both players must ready up to start</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="chat-box card svelte-1wksahx">`);
      RoomChat($$renderer2, { channelId: `room:${room.id}` });
      $$renderer2.push(`<!----></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="spinner"></div> <p class="dim svelte-1wksahx">Loading room...</p>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _page($$renderer) {
  RoomWaiting($$renderer);
}

export { _page as default };
//# sourceMappingURL=_page.svelte-DFOFtPBl.js.map
