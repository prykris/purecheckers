import { f as fallback, s as store_get, g as ensure_array_like, e as escape_html, a as attr_class, h as attr, u as unsubscribe_stores, d as bind_props } from "./index2.js";
import "socket.io-client";
import { u as user } from "./user.js";
import { c as roomChatMessages } from "./app.js";
import "@sveltejs/kit/internal";
import "./exports.js";
import "./utils.js";
import "@sveltejs/kit/internal/server";
import "./root.js";
import "./state.svelte.js";
function RoomChat($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let channelId = fallback($$props["channelId"], null);
    let closeable = fallback($$props["closeable"], false);
    let readOnly = fallback($$props["readOnly"], false);
    let input = "";
    $$renderer2.push(`<div class="room-chat svelte-12ngbke">`);
    if (closeable) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="chat-header svelte-12ngbke"><span class="chat-title svelte-12ngbke">Chat</span> <button class="close-btn svelte-12ngbke" aria-label="Close chat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="msgs svelte-12ngbke">`);
    if (store_get($$store_subs ??= {}, "$roomChatMessages", roomChatMessages).length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="empty svelte-12ngbke">No messages yet</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--[-->`);
      const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$roomChatMessages", roomChatMessages));
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let msg = each_array[$$index];
        if (msg.system || msg.senderId === 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="msg system svelte-12ngbke"><span class="svelte-12ngbke">${escape_html(msg.content)}</span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<div${attr_class("msg svelte-12ngbke", void 0, {
            "own": msg.senderId === store_get($$store_subs ??= {}, "$user", user)?.id
          })}><strong class="svelte-12ngbke">${escape_html(msg.username)}</strong> <span class="svelte-12ngbke">${escape_html(msg.content)}</span></div>`);
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div> `);
    if (!readOnly) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="input-row svelte-12ngbke"><input class="input svelte-12ngbke" type="text"${attr("value", input)} placeholder="Message..." maxlength="200"/> <button class="btn btn-primary btn-small send-btn svelte-12ngbke" aria-label="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></button></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
    bind_props($$props, { channelId, closeable, readOnly });
  });
}
export {
  RoomChat as R
};
