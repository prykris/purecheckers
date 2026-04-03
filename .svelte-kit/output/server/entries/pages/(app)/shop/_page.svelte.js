import "clsx";
import { e as escape_html, s as store_get, g as ensure_array_like, a as attr_class, l as attr_style, b as stringify, h as attr, u as unsubscribe_stores } from "../../../../chunks/index2.js";
import { u as user } from "../../../../chunks/user.js";
function ShopScreen($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let themes, skins, emotes;
    let items = [];
    let inventory = [];
    let buying = null;
    function isOwned(id) {
      return inventory.some((i) => i.itemId === id);
    }
    function isEquipped(id) {
      return inventory.some((i) => i.itemId === id && i.equipped);
    }
    themes = items.filter((i) => i.type === "THEME");
    skins = items.filter((i) => i.type === "SKIN");
    emotes = items.filter((i) => i.type === "EMOTE");
    $$renderer2.push(`<div class="page-scroll"><div class="page-content shop svelte-kp98zc"><h2 class="svelte-kp98zc">Shop</h2> <p class="coins svelte-kp98zc">Your coins: <strong class="svelte-kp98zc">${escape_html(store_get($$store_subs ??= {}, "$user", user)?.coins || 0)}</strong></p> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (themes.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<h3 class="section-title">Themes</h3> <div class="items-grid svelte-kp98zc"><!--[-->`);
      const each_array = ensure_array_like(themes);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let item = each_array[$$index];
        $$renderer2.push(`<div${attr_class("card item-card svelte-kp98zc", void 0, { "equipped": isEquipped(item.id) })}><div class="theme-preview svelte-kp98zc"><span class="tp-swatch svelte-kp98zc"${attr_style(`background:${stringify(item.data?.["--accent"] || "#ef4444")}`)}></span> <span class="tp-swatch svelte-kp98zc"${attr_style(`background:${stringify(item.data?.["--bg"] || "#1c1917")}`)}></span> <span class="tp-swatch svelte-kp98zc"${attr_style(`background:${stringify(item.data?.["--board-dark"] || "#7c5e3c")}`)}></span></div> <div class="info svelte-kp98zc"><span class="name svelte-kp98zc">${escape_html(item.name)}</span> <span class="price svelte-kp98zc">${escape_html(item.price)} coins</span></div> `);
        if (isEquipped(item.id)) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="badge equipped svelte-kp98zc">Equipped</span>`);
        } else if (isOwned(item.id)) {
          $$renderer2.push("<!--[1-->");
          $$renderer2.push(`<button class="btn btn-secondary btn-small">Equip</button>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<button class="btn btn-primary btn-small"${attr("disabled", buying === item.id || (store_get($$store_subs ??= {}, "$user", user)?.coins || 0) < item.price, true)}>${escape_html(buying === item.id ? "..." : "Buy")}</button>`);
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (skins.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<h3 class="section-title">Piece Skins</h3> <div class="items-grid svelte-kp98zc"><!--[-->`);
      const each_array_1 = ensure_array_like(skins);
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let item = each_array_1[$$index_1];
        $$renderer2.push(`<div${attr_class("card item-card svelte-kp98zc", void 0, { "equipped": isEquipped(item.id) })}><div class="preview svelte-kp98zc"${attr_style(`background:linear-gradient(135deg,${stringify(item.data?.red?.base || "#e94560")},${stringify(item.data?.black?.base || "#2d2d2d")})`)}></div> <div class="info svelte-kp98zc"><span class="name svelte-kp98zc">${escape_html(item.name)}</span> <span class="price svelte-kp98zc">${escape_html(item.price)} coins</span></div> `);
        if (isEquipped(item.id)) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="badge equipped svelte-kp98zc">Equipped</span>`);
        } else if (isOwned(item.id)) {
          $$renderer2.push("<!--[1-->");
          $$renderer2.push(`<button class="btn btn-secondary btn-small">Equip</button>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<button class="btn btn-primary btn-small"${attr("disabled", buying === item.id || (store_get($$store_subs ??= {}, "$user", user)?.coins || 0) < item.price, true)}>${escape_html(buying === item.id ? "..." : "Buy")}</button>`);
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (emotes.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<h3 class="section-title">Emotes</h3> <div class="items-grid svelte-kp98zc"><!--[-->`);
      const each_array_2 = ensure_array_like(emotes);
      for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
        let item = each_array_2[$$index_2];
        $$renderer2.push(`<div class="card item-card svelte-kp98zc"><div class="emote-icon svelte-kp98zc">${escape_html(item.data?.emoji || "?")}</div> <div class="info svelte-kp98zc"><span class="name svelte-kp98zc">${escape_html(item.name)}</span> <span class="price svelte-kp98zc">${escape_html(item.price === 0 ? "Free" : `${item.price} coins`)}</span></div> `);
        if (item.price === 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="badge free svelte-kp98zc">Free</span>`);
        } else if (isOwned(item.id)) {
          $$renderer2.push("<!--[1-->");
          $$renderer2.push(`<span class="badge owned svelte-kp98zc">Owned</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<button class="btn btn-primary btn-small"${attr("disabled", buying === item.id || (store_get($$store_subs ??= {}, "$user", user)?.coins || 0) < item.price, true)}>${escape_html(buying === item.id ? "..." : "Buy")}</button>`);
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _page($$renderer) {
  ShopScreen($$renderer);
}
export {
  _page as default
};
