import { s as store_get, e as escape_html, a as attr_class, l as attr_style, g as ensure_array_like, b as stringify, h as attr, u as unsubscribe_stores, f as fallback, c as slot, d as bind_props } from "../../../../chunks/index2.js";
import { g as gameState, a as activeRoom, r as roomUnreadChat } from "../../../../chunks/app.js";
import { o as onDestroy } from "../../../../chunks/index-server.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import { u as user } from "../../../../chunks/user.js";
import "socket.io-client";
import { R as RoomChat } from "../../../../chunks/RoomChat.js";
const TURN_TIME = 60;
class CheckersGame {
  constructor() {
    this.board = [];
    this.currentPlayer = "red";
    this.chainPiece = null;
    this.gameOver = false;
    this.winner = null;
    this.redTime = TURN_TIME;
    this.blackTime = TURN_TIME;
    this.moveHistory = [];
    this.reset();
  }
  reset() {
    this.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 8; c++)
        if ((r + c) % 2 === 1) this.board[r][c] = { color: "black", queen: false };
    for (let r = 5; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if ((r + c) % 2 === 1) this.board[r][c] = { color: "red", queen: false };
    this.currentPlayer = "red";
    this.chainPiece = null;
    this.gameOver = false;
    this.winner = null;
    this.redTime = TURN_TIME;
    this.blackTime = TURN_TIME;
    this.moveHistory = [];
  }
  clone() {
    const g = new CheckersGame();
    g.board = this.board.map((row) => row.map((cell) => cell ? { ...cell } : null));
    g.currentPlayer = this.currentPlayer;
    g.chainPiece = this.chainPiece ? { ...this.chainPiece } : null;
    g.gameOver = this.gameOver;
    g.winner = this.winner;
    g.redTime = this.redTime;
    g.blackTime = this.blackTime;
    return g;
  }
  at(r, c) {
    if (r < 0 || r > 7 || c < 0 || c > 7) return void 0;
    return this.board[r][c];
  }
  _directions() {
    return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  }
  getCaptures(r, c) {
    const piece = this.at(r, c);
    if (!piece) return [];
    return piece.queen ? this._queenCaptures(r, c, piece) : this._manCaptures(r, c, piece);
  }
  _manCaptures(r, c, piece) {
    const enemy = piece.color === "red" ? "black" : "red";
    const moves = [];
    for (const [dr, dc] of this._directions()) {
      const mr = r + dr, mc = c + dc;
      const lr = r + 2 * dr, lc = c + 2 * dc;
      if (this.at(mr, mc) && this.at(mr, mc)?.color === enemy && this.at(lr, lc) === null) {
        moves.push({ toRow: lr, toCol: lc, captured: [{ row: mr, col: mc }] });
      }
    }
    return moves;
  }
  _queenCaptures(r, c, piece) {
    const enemy = piece.color === "red" ? "black" : "red";
    const moves = [];
    for (const [dr, dc] of this._directions()) {
      let dist = 1;
      while (this.at(r + dist * dr, c + dist * dc) === null) dist++;
      const mr = r + dist * dr, mc = c + dist * dc;
      if (this.at(mr, mc)?.color !== enemy) continue;
      let ldist = dist + 1;
      while (this.at(r + ldist * dr, c + ldist * dc) === null) {
        moves.push({
          toRow: r + ldist * dr,
          toCol: c + ldist * dc,
          captured: [{ row: mr, col: mc }]
        });
        ldist++;
      }
    }
    return moves;
  }
  getSimpleMoves(r, c) {
    const piece = this.at(r, c);
    if (!piece) return [];
    return piece.queen ? this._queenMoves(r, c) : this._manMoves(r, c, piece);
  }
  _manMoves(r, c, piece) {
    const forward = piece.color === "red" ? -1 : 1;
    const moves = [];
    for (const dc of [-1, 1]) {
      const nr = r + forward, nc = c + dc;
      if (this.at(nr, nc) === null) {
        moves.push({ toRow: nr, toCol: nc, captured: [] });
      }
    }
    return moves;
  }
  _queenMoves(r, c) {
    const moves = [];
    for (const [dr, dc] of this._directions()) {
      let dist = 1;
      while (this.at(r + dist * dr, c + dist * dc) === null) {
        moves.push({ toRow: r + dist * dr, toCol: c + dist * dc, captured: [] });
        dist++;
      }
    }
    return moves;
  }
  getAllCaptures(color) {
    color = color || this.currentPlayer;
    const all = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.at(r, c)?.color === color) {
          const caps = this.getCaptures(r, c);
          for (const m of caps) all.push({ fromRow: r, fromCol: c, ...m });
        }
    return all;
  }
  getValidMovesFor(r, c) {
    const piece = this.at(r, c);
    if (!piece || piece.color !== this.currentPlayer) return [];
    if (this.chainPiece && (this.chainPiece.row !== r || this.chainPiece.col !== c)) return [];
    const allCaptures = this.getAllCaptures();
    if (allCaptures.length > 0) {
      return this.getCaptures(r, c).map((m) => ({ fromRow: r, fromCol: c, ...m }));
    }
    if (this.chainPiece) return [];
    return this.getSimpleMoves(r, c).map((m) => ({ fromRow: r, fromCol: c, ...m }));
  }
  getAllValidMoves(color) {
    color = color || this.currentPlayer;
    if (this.chainPiece) {
      return this.getValidMovesFor(this.chainPiece.row, this.chainPiece.col);
    }
    const caps = this.getAllCaptures(color);
    if (caps.length > 0) return caps;
    const moves = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.at(r, c)?.color === color)
          for (const m of this.getSimpleMoves(r, c))
            moves.push({ fromRow: r, fromCol: c, ...m });
    return moves;
  }
  makeMove(fromRow, fromCol, toRow, toCol) {
    const valid = this.getValidMovesFor(fromRow, fromCol);
    const move = valid.find((m) => m.toRow === toRow && m.toCol === toCol);
    if (!move) return null;
    const piece = this.board[fromRow][fromCol];
    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;
    for (const cap of move.captured) {
      this.board[cap.row][cap.col] = null;
    }
    let promoted = false;
    if (!piece.queen) {
      if (piece.color === "red" && toRow === 0 || piece.color === "black" && toRow === 7) {
        piece.queen = true;
        promoted = true;
      }
    }
    let chainContinues = false;
    if (move.captured.length > 0 && !promoted) {
      const moreCaps = this.getCaptures(toRow, toCol);
      if (moreCaps.length > 0) {
        this.chainPiece = { row: toRow, col: toCol };
        chainContinues = true;
      }
    }
    if (!chainContinues) {
      this.chainPiece = null;
      this.currentPlayer = this.currentPlayer === "red" ? "black" : "red";
      if (this.currentPlayer === "red") this.redTime = TURN_TIME;
      else this.blackTime = TURN_TIME;
      this._checkGameOver();
    }
    this.moveHistory.push({
      fromRow,
      fromCol,
      toRow,
      toCol,
      captured: move.captured,
      promoted,
      chainContinues
    });
    return { captured: move.captured, promoted, chainContinues };
  }
  _checkGameOver() {
    const moves = this.getAllValidMoves();
    if (moves.length === 0) {
      this.gameOver = true;
      this.winner = this.currentPlayer === "red" ? "black" : "red";
    }
  }
  tickTime(seconds) {
    if (this.gameOver) return;
    if (this.currentPlayer === "red") {
      this.redTime = Math.max(0, this.redTime - seconds);
      if (this.redTime <= 0) {
        this.gameOver = true;
        this.winner = "black";
      }
    } else {
      this.blackTime = Math.max(0, this.blackTime - seconds);
      if (this.blackTime <= 0) {
        this.gameOver = true;
        this.winner = "red";
      }
    }
  }
  evaluate(color) {
    let score = 0;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = this.at(r, c);
        if (!p) continue;
        const val = p.queen ? 5 : 1;
        const posBonus = p.queen ? 0 : p.color === "red" ? (7 - r) * 0.1 : r * 0.1;
        const centerBonus = c >= 2 && c <= 5 ? 0.05 : 0;
        if (p.color === color) score += val + posBonus + centerBonus;
        else score -= val + posBonus + centerBonus;
      }
    return score;
  }
  countPieces(color) {
    let n = 0;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.at(r, c)?.color === color) n++;
    return n;
  }
}
function GameScreen($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let topColor, topTime, bottomTime, isMyTurn, statusText, spectatorCount;
    let game = new CheckersGame();
    let myColor = store_get($$store_subs ??= {}, "$gameState", gameState)?.myColor || "red";
    let mode = store_get($$store_subs ??= {}, "$gameState", gameState)?.mode || "online";
    let opponentName = store_get($$store_subs ??= {}, "$gameState", gameState)?.opponentName || "Opponent";
    const gameId = store_get($$store_subs ??= {}, "$gameState", gameState)?.gameId;
    if (store_get($$store_subs ??= {}, "$gameState", gameState)?.reconnectState) {
      const rs = store_get($$store_subs ??= {}, "$gameState", gameState).reconnectState;
      game.board = rs.board;
      game.currentPlayer = rs.currentPlayer;
      game.redTime = rs.redTime;
      game.blackTime = rs.blackTime;
      game.chainPiece = rs.chainPiece;
      game.gameOver = rs.gameOver;
      game.winner = rs.winner;
      game.moveHistory = rs.moveHistory || [];
    }
    let capturedPieces = { red: [], black: [] };
    let moveLog = [];
    let ownedEmotes = [];
    let desktopChat = window.innerWidth >= 1100;
    let emoteTimeout = null;
    let timerInterval = null;
    onDestroy(() => {
      window.removeEventListener("resize", resizeBoard);
      window.visualViewport?.removeEventListener("resize", resizeBoard);
      clearInterval(timerInterval);
      clearTimeout(emoteTimeout);
    });
    function resizeBoard() {
    }
    let redTime = game.redTime;
    let blackTime = game.blackTime;
    let currentPlayer = game.currentPlayer;
    function fmtTime(s) {
      const sec = Math.ceil(s);
      return `0:${sec.toString().padStart(2, "0")}`;
    }
    topColor = myColor === "red" ? "black" : "red";
    topTime = topColor === "red" ? redTime : blackTime;
    bottomTime = myColor === "red" ? redTime : blackTime;
    isMyTurn = currentPlayer === myColor && !game.gameOver;
    statusText = game.gameOver ? game.winner === myColor ? "Victory!" : "Defeat" : isMyTurn ? "Your turn" : mode === "bot" ? "The Colonel is thinking..." : "Opponent's turn";
    spectatorCount = store_get($$store_subs ??= {}, "$activeRoom", activeRoom)?.spectators?.length || 0;
    $$renderer2.push(`<div class="game-layout svelte-clv6ji">`);
    if (spectatorCount > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="spectator-badge svelte-clv6ji"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" class="svelte-clv6ji"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" class="svelte-clv6ji"></path><circle cx="12" cy="12" r="3" class="svelte-clv6ji"></circle></svg> ${escape_html(spectatorCount)}</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="player-bar opponent svelte-clv6ji"><div${attr_class("pinfo svelte-clv6ji", void 0, { "active": currentPlayer === topColor })}><div${attr_class(`dot ${stringify(topColor)}`, "svelte-clv6ji")}></div> <span class="pname svelte-clv6ji">${escape_html(myColor === "red" ? opponentName : store_get($$store_subs ??= {}, "$user", user)?.username)}</span> <span${attr_class("timer svelte-clv6ji", void 0, { "low": topTime <= 15, "critical": topTime <= 7 })}>${escape_html(fmtTime(topTime))}</span> <div class="tbar-track svelte-clv6ji"><div${attr_class("tbar-fill svelte-clv6ji", void 0, { "low": topTime <= 15, "critical": topTime <= 7 })}${attr_style(`width:${stringify(topTime / TURN_TIME * 100)}%`)}></div></div></div> <div class="captured svelte-clv6ji"><!--[-->`);
    const each_array = ensure_array_like(capturedPieces[topColor] || []);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let cap = each_array[$$index];
      $$renderer2.push(`<div${attr_class(`cap ${stringify(cap.color)}`, "svelte-clv6ji")}></div>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="board-wrap svelte-clv6ji"><canvas width="480" height="480" class="svelte-clv6ji"></canvas> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="player-bar self svelte-clv6ji"><div class="captured svelte-clv6ji"><!--[-->`);
    const each_array_1 = ensure_array_like(capturedPieces[myColor] || []);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let cap = each_array_1[$$index_1];
      $$renderer2.push(`<div${attr_class(`cap ${stringify(cap.color)}`, "svelte-clv6ji")}></div>`);
    }
    $$renderer2.push(`<!--]--></div> <div${attr_class("pinfo svelte-clv6ji", void 0, { "active": currentPlayer === myColor })}><div class="tbar-track svelte-clv6ji"><div${attr_class("tbar-fill svelte-clv6ji", void 0, { "low": bottomTime <= 15, "critical": bottomTime <= 7 })}${attr_style(`width:${stringify(bottomTime / TURN_TIME * 100)}%`)}></div></div> <div${attr_class(`dot ${stringify(myColor)}`, "svelte-clv6ji")}></div> <span class="pname svelte-clv6ji">${escape_html(myColor === "red" ? store_get($$store_subs ??= {}, "$user", user)?.username : opponentName)}</span> <span${attr_class("timer svelte-clv6ji", void 0, { "low": bottomTime <= 15, "critical": bottomTime <= 7 })}>${escape_html(fmtTime(bottomTime))}</span></div></div> `);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="status svelte-clv6ji">${escape_html(statusText)}</div>`);
    }
    $$renderer2.push(`<!--]--> <div class="actions svelte-clv6ji">`);
    if (!game.gameOver && mode !== "spectator") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button class="btn btn-dark btn-small svelte-clv6ji">Resign</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (mode === "online") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button${attr_class("btn btn-dark btn-small chat-toggle svelte-clv6ji", void 0, { "mobile-only": desktopChat })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" class="svelte-clv6ji"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" class="svelte-clv6ji"></path></svg> Chat `);
      if (store_get($$store_subs ??= {}, "$roomUnreadChat", roomUnreadChat) > 0 && true && !desktopChat) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="unread-badge svelte-clv6ji">${escape_html(store_get($$store_subs ??= {}, "$roomUnreadChat", roomUnreadChat) > 9 ? "9+" : store_get($$store_subs ??= {}, "$roomUnreadChat", roomUnreadChat))}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (ownedEmotes.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<!--[-->`);
      const each_array_2 = ensure_array_like(ownedEmotes);
      for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
        let e = each_array_2[$$index_2];
        $$renderer2.push(`<button class="emote-btn svelte-clv6ji"${attr("title", e.name)}>${escape_html(e.data.emoji)}</button>`);
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="moves svelte-clv6ji"><!--[-->`);
    const each_array_3 = ensure_array_like(moveLog.slice(-10));
    for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
      let m = each_array_3[$$index_3];
      $$renderer2.push(`<div class="move-pill svelte-clv6ji"><span${attr_class(`mdot ${stringify(m.color)}`, "svelte-clv6ji")}></span><span class="mtxt svelte-clv6ji">${escape_html(m.from)}${escape_html(m.capture ? "×" : "→")}${escape_html(m.to)}</span></div>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div${attr_class("left-panel svelte-clv6ji", void 0, {
      "mobile-hidden-emotes": true,
      "mobile-hidden-chat": true
    })}>`);
    if (ownedEmotes.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div${attr_class("emote-bar svelte-clv6ji", void 0, { "mobile-hidden": true })}><!--[-->`);
      const each_array_4 = ensure_array_like(ownedEmotes);
      for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
        let e = each_array_4[$$index_4];
        $$renderer2.push(`<button class="emote-btn svelte-clv6ji"${attr("title", e.name)}>${escape_html(e.data.emoji)}</button>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (mode === "online") {
      $$renderer2.push("<!--[0-->");
      if (desktopChat) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div${attr_class("game-chat card svelte-clv6ji", void 0, { "minimized": !desktopChat })}>`);
        RoomChat($$renderer2, {
          channelId: gameId ? `game:${gameId}` : null,
          closeable: true,
          readOnly: mode === "spectator"
        });
        $$renderer2.push(`<!----></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function BoardView($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let game = $$props["game"];
    let flip = fallback(
      $$props["flip"],
      false
      // view from black's perspective
    );
    let myColor = fallback($$props["myColor"], "red");
    let selectedPiece = fallback($$props["selectedPiece"], null);
    let validMoves = fallback($$props["validMoves"], () => [], true);
    let lastMove = fallback($$props["lastMove"], null);
    let lastMoveCaptured = fallback($$props["lastMoveCaptured"], () => [], true);
    let interactive = fallback($$props["interactive"], true);
    let animating = fallback($$props["animating"], false);
    let ctx;
    let CELL = 60;
    let BOARD_PX = 480;
    let introAnim = null;
    let shatterParticles = [];
    let trail = [];
    function resize() {
      resizeBoard();
    }
    function redraw() {
    }
    function playIntro() {
      introAnim = { startTime: performance.now() };
      animating = true;
      function tick() {
        const elapsed = performance.now() - introAnim.startTime;
        if (elapsed < 950) requestAnimationFrame(tick);
        else {
          introAnim = null;
          animating = false;
        }
      }
      requestAnimationFrame(tick);
    }
    async function animateMove(fromRow, fromCol, toRow, toCol, pieceColor, pieceQueen, captured) {
      const info = {
        fromRow,
        fromCol,
        toRow,
        toCol,
        pieceColor,
        pieceQueen,
        captured: captured || []
      };
      animating = true;
      await animateSlide(info);
      if (info.captured.length > 0) {
        for (const cap of info.captured) {
          const cr = flip ? 7 - cap.row : cap.row, cc = flip ? 7 - cap.col : cap.col;
          spawnShatter(cc * CELL + CELL / 2, cr * CELL + CELL / 2, cap.color);
        }
      }
      if (shatterParticles.length > 0) await animateEffects();
      animating = false;
    }
    onDestroy(() => {
      window.removeEventListener("resize", resizeBoard);
      window.visualViewport?.removeEventListener("resize", resizeBoard);
    });
    function resizeBoard() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const chromeH = vh <= 520 ? 100 : 200;
      let maxW, maxH, cap;
      if (vw >= 1100) {
        maxW = Math.min(vw - 560, 640);
        maxH = vh - 100;
        cap = 640;
      } else if (vw >= 600) {
        maxW = Math.min(vw - 24, 560);
        maxH = vh - chromeH;
        cap = 560;
      } else {
        maxW = vw - 16;
        maxH = vh - chromeH;
        cap = 480;
      }
      BOARD_PX = Math.min(maxW, maxH, cap);
      BOARD_PX = Math.max(BOARD_PX, 200);
      CELL = BOARD_PX / 8;
    }
    function drawPiece(px, py, color, isQueen, alpha) {
      const r = CELL * 0.38;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(px + 1, py + 3, r, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py + 2, r, 0, Math.PI * 2);
      ctx.fillStyle = color === "red" ? "#b91c1c" : "#1a1a1a";
      ctx.fill();
      const g = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r);
      if (color === "red") {
        g.addColorStop(0, "#f87171");
        g.addColorStop(0.7, "#ef4444");
        g.addColorStop(1, "#dc2626");
      } else {
        g.addColorStop(0, "#57534e");
        g.addColorStop(0.7, "#3d3530");
        g.addColorStop(1, "#1c1917");
      }
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = color === "red" ? "#991b1b" : "#44403c";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, r * 0.65, 0, Math.PI * 2);
      ctx.strokeStyle = color === "red" ? "rgba(252,165,165,0.3)" : "rgba(168,162,158,0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(px - r * 0.15, py - r * 0.2, r * 0.3, r * 0.15, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = color === "red" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)";
      ctx.fill();
      if (isQueen) {
        const cw = r * 0.55, ch = r * 0.35, cy = py - ch * 0.1;
        ctx.beginPath();
        ctx.moveTo(px - cw, cy + ch * 0.4);
        ctx.lineTo(px - cw, cy - ch * 0.3);
        ctx.lineTo(px - cw * 0.5, cy + ch * 0.1);
        ctx.lineTo(px, cy - ch * 0.5);
        ctx.lineTo(px + cw * 0.5, cy + ch * 0.1);
        ctx.lineTo(px + cw, cy - ch * 0.3);
        ctx.lineTo(px + cw, cy + ch * 0.4);
        ctx.closePath();
        const cg = ctx.createLinearGradient(px, cy - ch * 0.5, px, cy + ch * 0.4);
        cg.addColorStop(0, "#ffe066");
        cg.addColorStop(1, "#b8860b");
        ctx.fillStyle = cg;
        ctx.fill();
        ctx.strokeStyle = "#8B6914";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      ctx.restore();
    }
    function animateSlide(info) {
      return new Promise((resolve) => {
        const fromX = (flip ? 7 - info.fromCol : info.fromCol) * CELL + CELL / 2;
        const fromY = (flip ? 7 - info.fromRow : info.fromRow) * CELL + CELL / 2;
        const toX = (flip ? 7 - info.toCol : info.toCol) * CELL + CELL / 2;
        const toY = (flip ? 7 - info.toRow : info.toRow) * CELL + CELL / 2;
        const duration = 200, start = performance.now();
        trail = [];
        let lastT = 0;
        function tick(now) {
          const t = Math.min((now - start) / duration, 1), e = 1 - Math.pow(1 - t, 3);
          const cx = fromX + (toX - fromX) * e, cy = fromY + (toY - fromY) * e;
          if (now - lastT > 20 && t > 0.05) {
            trail.push({
              x: cx,
              y: cy,
              color: info.pieceColor,
              queen: info.pieceQueen,
              alpha: 0.2
            });
            lastT = now;
            if (trail.length > 6) trail.shift();
          }
          for (let i = 0; i < trail.length; i++) trail[i].alpha = 0.12 * (i + 1) / trail.length;
          drawPiece(cx, cy, info.pieceColor, info.pieceQueen);
          if (t < 1) requestAnimationFrame(tick);
          else {
            trail = [];
            resolve();
          }
        }
        requestAnimationFrame(tick);
      });
    }
    function spawnShatter(px, py, color) {
      const base = color === "red" ? [233, 69, 96] : [45, 45, 45];
      for (let i = 0; i < 14; i++) {
        const angle = Math.PI * 2 * i / 14 + (Math.random() - 0.5) * 0.5;
        const speed = 80 + Math.random() * 180, size = CELL * (0.04 + Math.random() * 0.08);
        const r = Math.min(255, Math.max(0, base[0] + (Math.random() - 0.5) * 50));
        const g = Math.min(255, Math.max(0, base[1] + (Math.random() - 0.5) * 50));
        const b = Math.min(255, Math.max(0, base[2] + (Math.random() - 0.5) * 50));
        shatterParticles.push({
          x: px,
          y: py,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 50,
          size,
          color: `rgb(${r | 0},${g | 0},${b | 0})`,
          life: 1,
          decay: 1.5 + Math.random(),
          gravity: 300 + Math.random() * 150,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 12
        });
      }
    }
    function animateEffects() {
      return new Promise((resolve) => {
        let last = performance.now();
        function tick(now) {
          const dt = (now - last) / 1e3;
          last = now;
          for (const p of shatterParticles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += p.gravity * dt;
            p.life -= p.decay * dt;
            p.rotation += p.rotSpeed * dt;
            p.size *= 0.98;
          }
          shatterParticles = shatterParticles.filter((p) => p.life > 0);
          if (shatterParticles.length > 0) requestAnimationFrame(tick);
          else resolve();
        }
        requestAnimationFrame(tick);
      });
    }
    $$renderer2.push(`<div class="board-wrap svelte-wha3q9"><canvas width="480" height="480" class="svelte-wha3q9"></canvas> <!--[-->`);
    slot($$renderer2, $$props, "default", {});
    $$renderer2.push(`<!--]--></div>`);
    bind_props($$props, {
      game,
      flip,
      myColor,
      selectedPiece,
      validMoves,
      lastMove,
      lastMoveCaptured,
      interactive,
      animating,
      resize,
      redraw,
      playIntro,
      animateMove
    });
  });
}
function SpectateScreen($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let game = new CheckersGame();
    let flip = false;
    let lastMove = null;
    let lastMoveCaptured = [];
    const redName = store_get($$store_subs ??= {}, "$gameState", gameState)?.spectatorRedName || "Red";
    const blackName = store_get($$store_subs ??= {}, "$gameState", gameState)?.spectatorBlackName || "Black";
    const gameId = store_get($$store_subs ??= {}, "$gameState", gameState)?.gameId;
    if (store_get($$store_subs ??= {}, "$gameState", gameState)?.reconnectState) {
      const rs = store_get($$store_subs ??= {}, "$gameState", gameState).reconnectState;
      game.board = rs.board;
      game.currentPlayer = rs.currentPlayer;
      game.redTime = rs.redTime;
      game.blackTime = rs.blackTime;
      game.chainPiece = rs.chainPiece;
      game.gameOver = rs.gameOver;
      game.winner = rs.winner;
    }
    onDestroy(() => {
    });
    function fmtTime(s) {
      const sec = Math.ceil(s);
      return `0:${sec.toString().padStart(2, "0")}`;
    }
    $$renderer2.push(`<div class="spectate-layout svelte-fo5t45"><div class="player-bar svelte-fo5t45"><div${attr_class("pinfo svelte-fo5t45", void 0, { "active": game.currentPlayer === "black" })}><div${attr_class("dot svelte-fo5t45", void 0, { "red": !flip, "black": flip })}></div> <span class="pname svelte-fo5t45">${escape_html(blackName)}</span> <span class="timer svelte-fo5t45">${escape_html(fmtTime(game.blackTime))}</span></div></div>  <div class="board-tap-zone svelte-fo5t45">`);
    BoardView($$renderer2, {
      game,
      flip,
      myColor: "red",
      interactive: false,
      selectedPiece: null,
      validMoves: [],
      lastMove,
      lastMoveCaptured,
      children: ($$renderer3) => {
        {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]-->`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="player-bar svelte-fo5t45"><div${attr_class("pinfo svelte-fo5t45", void 0, { "active": game.currentPlayer === "red" })}><div${attr_class("dot svelte-fo5t45", void 0, { "red": flip, "black": !flip })}></div> <span class="pname svelte-fo5t45">${escape_html(redName)}</span> <span class="timer svelte-fo5t45">${escape_html(fmtTime(game.redTime))}</span></div></div> <div class="spectate-actions svelte-fo5t45"><button class="btn btn-dark btn-small svelte-fo5t45"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" class="svelte-fo5t45"><polyline points="17 1 21 5 17 9" class="svelte-fo5t45"></polyline><path d="M3 11V9a4 4 0 014-4h14" class="svelte-fo5t45"></path><polyline points="7 23 3 19 7 15" class="svelte-fo5t45"></polyline><path d="M21 13v2a4 4 0 01-4 4H3" class="svelte-fo5t45"></path></svg> Flip Board</button> <button class="btn btn-dark btn-small svelte-fo5t45">Leave</button></div> <div class="spectate-label svelte-fo5t45"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" class="svelte-fo5t45"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" class="svelte-fo5t45"></path><circle cx="12" cy="12" r="3" class="svelte-fo5t45"></circle></svg> Spectating</div> <div class="spectate-chat card svelte-fo5t45">`);
    RoomChat($$renderer2, { channelId: gameId ? `game:${gameId}` : null, readOnly: true });
    $$renderer2.push(`<!----></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    if (store_get($$store_subs ??= {}, "$gameState", gameState)?.mode === "spectator") {
      $$renderer2.push("<!--[0-->");
      SpectateScreen($$renderer2);
    } else {
      $$renderer2.push("<!--[-1-->");
      GameScreen($$renderer2);
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
