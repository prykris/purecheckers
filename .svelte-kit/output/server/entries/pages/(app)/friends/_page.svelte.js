import "clsx";
import { h as attr, g as ensure_array_like, e as escape_html, s as store_get, a as attr_class, u as unsubscribe_stores } from "../../../../chunks/index2.js";
import { u as user } from "../../../../chunks/user.js";
function FriendsScreen($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let friends = [];
    let pending = [];
    let friendCode = "";
    let tipAmounts = {};
    $$renderer2.push(`<div class="page-scroll"><div class="page-content friends svelte-cre4t5"><h2 class="svelte-cre4t5">Friends</h2> <div class="card add-row svelte-cre4t5"><input class="input code-input svelte-cre4t5" type="text"${attr("value", friendCode)} placeholder="Enter friend code" maxlength="8"/> <button class="btn btn-primary btn-small">Add</button></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="lists svelte-cre4t5">`);
    if (pending.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<section class="pending svelte-cre4t5"><h3 class="section-title">Pending Requests</h3> <!--[-->`);
      const each_array = ensure_array_like(pending);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let req = each_array[$$index];
        $$renderer2.push(`<div class="card friend-row svelte-cre4t5"><span class="fname svelte-cre4t5">${escape_html(req.requester.username)}</span> <span class="felo svelte-cre4t5">ELO ${escape_html(req.requester.elo)}</span> <button class="btn btn-primary btn-small">Accept</button></div>`);
      }
      $$renderer2.push(`<!--]--></section>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <section class="friend-list svelte-cre4t5"><h3 class="section-title">Friends (${escape_html(friends.length)})</h3> `);
    if (friends.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="empty svelte-cre4t5">No friends yet. Share your code: <strong class="svelte-cre4t5">${escape_html(store_get($$store_subs ??= {}, "$user", user)?.friendCode)}</strong></p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--[-->`);
      const each_array_1 = ensure_array_like(friends);
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let f = each_array_1[$$index_1];
        $$renderer2.push(`<div class="card friend-row svelte-cre4t5"><span${attr_class("status-dot svelte-cre4t5", void 0, {
          "online": f.status === "online",
          "in-game": f.status === "in-game"
        })}></span> <span class="fname svelte-cre4t5">${escape_html(f.username)}</span> <span class="felo svelte-cre4t5">ELO ${escape_html(f.elo)}</span> <span class="fstatus svelte-cre4t5">${escape_html(f.status)}</span> <div class="tip-row svelte-cre4t5"><input class="input tip-input svelte-cre4t5" type="number" min="1" placeholder="Tip"${attr("value", tipAmounts[f.id])}/> <button class="btn btn-dark btn-small">Tip</button></div> <button class="remove-btn svelte-cre4t5">x</button></div>`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></section></div></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _page($$renderer) {
  FriendsScreen($$renderer);
}
export {
  _page as default
};
