import "clsx";
import { s as store_get, l as attr_style, e as escape_html, h as attr, u as unsubscribe_stores, b as stringify } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import { u as user } from "../../../../chunks/user.js";
import "socket.io-client";
function ProfileScreen($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let winRate, initials, avatarHue, memberSince;
    let upgradeEmail = "";
    let upgradePassword = "";
    let upgradeName = "";
    let upgrading = false;
    winRate = store_get($$store_subs ??= {}, "$user", user)?.gamesPlayed > 0 ? Math.round(store_get($$store_subs ??= {}, "$user", user).wins / store_get($$store_subs ??= {}, "$user", user).gamesPlayed * 100) : 0;
    initials = (store_get($$store_subs ??= {}, "$user", user)?.username || "?").slice(0, 2).toUpperCase();
    avatarHue = (store_get($$store_subs ??= {}, "$user", user)?.username || "").split("").reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
    memberSince = store_get($$store_subs ??= {}, "$user", user)?.createdAt ? new Date(store_get($$store_subs ??= {}, "$user", user).createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";
    $$renderer2.push(`<div class="profile-layout svelte-12tlnl9"><div class="profile-content svelte-12tlnl9"><button class="back-btn svelte-12tlnl9"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="15 18 9 12 15 6"></polyline></svg> Back</button> <div class="avatar-section svelte-12tlnl9"><div class="avatar svelte-12tlnl9"${attr_style(`background: hsl(${stringify(avatarHue)}, 45%, 35%)`)}><span>${escape_html(initials)}</span></div> <h2 class="username svelte-12tlnl9">${escape_html(store_get($$store_subs ??= {}, "$user", user)?.username || "Player")}</h2> `);
    if (store_get($$store_subs ??= {}, "$user", user)?.isGuest) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="guest-tag svelte-12tlnl9">Guest</span>`);
    } else if (memberSince) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<span class="member-since svelte-12tlnl9">Since ${escape_html(memberSince)}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    if (store_get($$store_subs ??= {}, "$user", user)?.isGuest) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="card upgrade-card svelte-12tlnl9"><h3 class="svelte-12tlnl9">Create an Account</h3> <p class="upgrade-hint svelte-12tlnl9">Keep your progress, earn ELO, and unlock rewards.</p> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <input class="input" type="text" placeholder="Username (keep current if empty)"${attr("value", upgradeName)}/> <input class="input" type="email" placeholder="Email"${attr("value", upgradeEmail)}/> <input class="input" type="password" placeholder="Password (6+ chars)"${attr("value", upgradePassword)}/> <button class="btn btn-primary full-w svelte-12tlnl9"${attr("disabled", upgrading, true)}>${escape_html("Create Account")}</button></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="stats-grid svelte-12tlnl9"><div class="stat-card svelte-12tlnl9"><span class="stat-value svelte-12tlnl9">${escape_html(store_get($$store_subs ??= {}, "$user", user)?.elo || 1e3)}</span> <span class="stat-label svelte-12tlnl9">ELO</span> `);
    if (store_get($$store_subs ??= {}, "$user", user)?.peakElo && store_get($$store_subs ??= {}, "$user", user).peakElo > (store_get($$store_subs ??= {}, "$user", user)?.elo || 1e3)) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="stat-sub svelte-12tlnl9">Peak: ${escape_html(store_get($$store_subs ??= {}, "$user", user).peakElo)}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="stat-card svelte-12tlnl9"><span class="stat-value svelte-12tlnl9">${escape_html(store_get($$store_subs ??= {}, "$user", user)?.gamesPlayed || 0)}</span> <span class="stat-label svelte-12tlnl9">Games</span></div> <div class="stat-card svelte-12tlnl9"><span class="stat-value win svelte-12tlnl9">${escape_html(store_get($$store_subs ??= {}, "$user", user)?.wins || 0)}</span> <span class="stat-label svelte-12tlnl9">Wins</span></div> <div class="stat-card svelte-12tlnl9"><span class="stat-value loss svelte-12tlnl9">${escape_html(store_get($$store_subs ??= {}, "$user", user)?.losses || 0)}</span> <span class="stat-label svelte-12tlnl9">Losses</span></div> <div class="stat-card svelte-12tlnl9"><span class="stat-value svelte-12tlnl9">${escape_html(winRate)}%</span> <span class="stat-label svelte-12tlnl9">Win Rate</span></div> <div class="stat-card svelte-12tlnl9"><span class="stat-value gold svelte-12tlnl9">${escape_html(store_get($$store_subs ??= {}, "$user", user)?.coins || 0)}</span> <span class="stat-label svelte-12tlnl9">Coins</span></div></div> `);
    if (store_get($$store_subs ??= {}, "$user", user)?.friendCode) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="friend-code svelte-12tlnl9"><span class="fc-label svelte-12tlnl9">Friend Code</span> <span class="fc-value svelte-12tlnl9">${escape_html(store_get($$store_subs ??= {}, "$user", user).friendCode)}</span></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="history-section svelte-12tlnl9"><h3 class="svelte-12tlnl9">Recent Games</h3> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="empty svelte-12tlnl9">Loading...</p>`);
    }
    $$renderer2.push(`<!--]--></div> <button class="btn btn-dark logout-btn svelte-12tlnl9">Logout</button></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _page($$renderer) {
  ProfileScreen($$renderer);
}
export {
  _page as default
};
