/**
 * Reactive decision engine for phantom players.
 *
 * Event-driven, not timer-driven. Phantoms respond to what's happening:
 * - Real player searching → phantom joins matchmaking
 * - Phantom room waiting → another phantom joins
 * - Chat quiet → chatty phantom speaks
 * - No activity → orchestrate phantom-vs-phantom game
 *
 * Loop prevention via single-reactor rule, per-phantom cooldowns,
 * scenario locks, and concurrency caps.
 */

import { rand } from './personality.js';
import { generateChat } from './chat.js';

export class Brain {
  /**
   * @param {Map<string, import('./player.js').PhantomPlayer>} phantoms - username → PhantomPlayer
   * @param {object} config - { ollamaUrl, ollamaModel, activeCount }
   */
  constructor(phantoms, config) {
    this.phantoms = phantoms;
    this.config = config;

    // Track which phantoms are online
    this.onlineSet = new Set();

    // Concurrency locks
    this.phantomInMatchmaking = null;   // username or null
    this.phantomWaitingRoom = null;     // username or null (phantom whose room is waiting)
    this.orchestrating = false;         // true while setting up a phantom-vs-phantom game

    // Cooldowns
    this.lastAmbientCheck = 0;
    this.lastChatTime = 0;
    this.eventLocks = new Map();        // eventKey → timestamp (prevents double-reacting)

    // Ambient timers
    this.ambientInterval = null;
    this.sessionTimers = new Map();     // username → timeout for going offline
    this.offlineUntil = new Map();      // username → timestamp when they can come back online
    this.leavingInProgress = new Set(); // usernames currently in the leaving sequence

    // Track presence for detecting real player activity
    this.lastPresenceStats = { online: 0, lookingToPlay: 0 };
    this.phantomsSearching = 0;

    // Matchmaking timeout trackers
    this.matchmakingTimers = new Map(); // username → timeout

    // Ready-up tracking: prevent spamming ready on repeated room:updated events
    this.readyScheduled = new Set();    // roomId:username keys

    // Phantom-to-phantom banter tracking: "phantomA:phantomB" → exchange count
    this.banterCount = new Map();
    this.banterResetTimer = null;

    // Game history between phantoms for banter context
    this.recentResults = [];  // [{ winner, loser, timestamp }] last ~20 results
  }

  // ---- Lifecycle ----

  start() {
    // Wire up event callbacks on all phantoms
    for (const player of this.phantoms.values()) {
      this._wireEvents(player);
    }

    // Ambient check every 15 seconds
    this.ambientInterval = setInterval(() => this._ambientCheck(), 15000);
    console.log('[Brain] Started');
  }

  stop() {
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
    for (const timer of this.sessionTimers.values()) {
      clearTimeout(timer);
    }
    this.sessionTimers.delete;
    for (const timer of this.matchmakingTimers.values()) {
      clearTimeout(timer);
    }
    this.matchmakingTimers.clear();
    if (this.banterResetTimer) {
      clearInterval(this.banterResetTimer);
      this.banterResetTimer = null;
    }
    console.log('[Brain] Stopped');
  }

  // ---- Event wiring ----

  _wireEvents(player) {
    player.onPhaseChange = (p, newPhase) => this._onPhaseChange(p, newPhase);
    player.onPresenceStats = (p, stats) => this._onPresenceStats(p, stats);
    player.onChatMessage = (p, msg) => this._onChatMessage(p, msg);
    player.onGameEnded = (p, data) => this._onGameEnded(p, data);
    player.onRoomUpdate = (p, data) => this._onRoomUpdate(p, data);
  }

  // ---- Event handlers ----

  _onPhaseChange(player, newPhase) {
    if (newPhase === 'idle') {
      // Phantom became idle — clear any matchmaking tracking
      if (this.phantomInMatchmaking === player.name) {
        this.phantomInMatchmaking = null;
        this.phantomsSearching = Math.max(0, this.phantomsSearching - 1);
      }
      if (this.phantomWaitingRoom === player.name) {
        this.phantomWaitingRoom = null;
      }
      // Clear matchmaking timeout
      const mmTimer = this.matchmakingTimers.get(player.name);
      if (mmTimer) {
        clearTimeout(mmTimer);
        this.matchmakingTimers.delete(player.name);
      }
    }

    if (newPhase === 'matchmaking') {
      this.phantomInMatchmaking = player.name;
      this.phantomsSearching++;

      // Set matchmaking timeout — leave after 45s if no match
      const timer = setTimeout(() => {
        this.matchmakingTimers.delete(player.name);
        if (player.phase === 'matchmaking') {
          console.log(`[Brain] ${player.name} matchmaking timeout, leaving`);
          player.leaveMatchmaking();
        }
      }, 45000);
      this.matchmakingTimers.set(player.name, timer);
    }

    if (newPhase === 'in-room') {
      // If this phantom created the room, track it
      if (!this.phantomWaitingRoom) {
        this.phantomWaitingRoom = player.name;
      }
    }

    if (newPhase === 'in-game') {
      this.orchestrating = false; // Unlock if game started
    }
  }

  _onPresenceStats(player, stats) {
    const prev = this.lastPresenceStats;
    this.lastPresenceStats = stats;

    // Detect: lookingToPlay increased and there's no phantom in queue
    // This likely means a real player entered matchmaking
    if (stats.lookingToPlay > prev.lookingToPlay && !this.phantomInMatchmaking) {
      this._reactToSearchingPlayer(player);
    }
  }

  _onChatMessage(_player, msg) {
    // Don't react to system messages
    if (msg.system || msg.senderId === 0) return;

    const fromPhantom = this._isPhantom(msg.username);

    // Check if any phantom was @mentioned
    const mentions = (msg.content || '').match(/@(\w+)/g);
    const mentionedPhantoms = mentions
      ? mentions.map(m => m.slice(1)).filter(name => this._isPhantom(name))
      : [];

    const fromHuman = !fromPhantom;

    // Priority 1: A phantom was directly @mentioned
    if (mentionedPhantoms.length > 0) {
      for (const mentionedName of mentionedPhantoms) {
        if (mentionedName === msg.username) continue; // don't reply to self-mention
        this._reactToMention(mentionedName, msg, fromHuman);
      }
      return;
    }

    // Priority 2: Human chatted without mention — moderate chance of responding
    if (fromHuman) {
      if (Math.random() < 0.45) { // 45% chance to consider replying to a real person
        this._reactToChat(msg);
      }
      return;
    }

    // Priority 3: Phantom-to-phantom banter (unprompted, very rare)
    if (Math.random() < 0.08) { // 8% chance
      this._reactToPhantomChat(msg);
    }
  }

  _onGameEnded(player, data) {
    // Track results for banter context
    if (data.result === 'RED_WIN' || data.result === 'BLACK_WIN') {
      const winner = data.result === 'RED_WIN' ? data.redPlayer : data.blackPlayer;
      const loser = data.result === 'RED_WIN' ? data.blackPlayer : data.redPlayer;
      this.recentResults.push({ winner, loser, timestamp: Date.now() });
      if (this.recentResults.length > 20) this.recentResults.shift();

      // Post-game global chat — phantom comments on their game
      this._postGameChat(player, winner, loser);
    }
  }

  async _postGameChat(player, winner, loser) {
    // Only if this phantom was in the game
    if (player.name !== winner && player.name !== loser) return;

    // 60% chance to say something in global after a game
    if (Math.random() > 0.6) return;

    const won = player.name === winner;
    const opponent = won ? loser : winner;
    const context = won ? 'won_game' : 'lost_game';
    const banterContext = `You just ${won ? 'beat' : 'lost to'} ${opponent} in a game.`;

    const delay = rand(3000, 8000);
    setTimeout(async () => {
      if (!player.connected) return;
      const message = await generateChat(
        player.p, context, player.recentChat, this.config, banterContext, this._describeState(player)
      );
      if (message) {
        player.sendChat('global', message);
        this.lastChatTime = Date.now();
        console.log(`[Brain] ${player.name} post-game chat: "${message}"`);
      }
    }, delay);
  }

  _onRoomUpdate(_player, data) {
    // Room update — check if a phantom's room got a second player
    const room = data.room || data;
    if (!room || !room.id || room.closed) return;

    // If a phantom is waiting in a room and it now has 2 players, ready up (once)
    if (room.players?.length === 2 && room.status === 'waiting') {
      for (const rp of room.players) {
        if (!this._isPhantom(rp.username)) continue;
        if (rp.ready) continue; // already ready on server

        const readyKey = `${room.id}:${rp.username}`;
        if (this.readyScheduled.has(readyKey)) continue; // already scheduled
        this.readyScheduled.add(readyKey);

        const phantomPlayer = this.phantoms.get(rp.username);
        if (!phantomPlayer || phantomPlayer.phase !== 'in-room') continue;

        const delay = rand(phantomPlayer.p.readyDelay[0], phantomPlayer.p.readyDelay[1]) * 1000;
        setTimeout(() => {
          this.readyScheduled.delete(readyKey);
          if (phantomPlayer.phase === 'in-room') {
            phantomPlayer.readyUp();
            console.log(`[Brain] ${phantomPlayer.name} readied up`);
          }
        }, delay);
      }
    }

    // Clean up ready tracking when room closes or game starts
    if (room.closed || room.status === 'playing') {
      for (const key of this.readyScheduled) {
        if (key.startsWith(`${room.id}:`)) this.readyScheduled.delete(key);
      }
    }
  }

  // ---- Reactive decisions ----

  async _reactToSearchingPlayer(_triggerPlayer) {
    const eventKey = 'react_matchmaking';
    if (this._isLocked(eventKey, 30000)) return;
    this._lock(eventKey);

    // Pick the best idle phantom to respond
    const candidate = this._pickReactor();
    if (!candidate) return;

    // Delay based on reactivity (lower reactivity = longer delay)
    const delay = rand(5000, 15000) / candidate.p.reactivity;

    setTimeout(() => {
      if (!candidate.isIdle || this.phantomInMatchmaking) return;
      console.log(`[Brain] ${candidate.name} reacting to searching player → joining matchmaking`);
      candidate.joinMatchmaking(candidate.p.skill * 200 + 600); // rough ELO estimate
    }, Math.min(delay, 15000));
  }

  async _reactToChat(msg) {
    const eventKey = `react_chat_${msg.id || Date.now()}`;
    if (this._isLocked(eventKey, 30000)) return;
    this._lock(eventKey);

    // Pick a chatty idle phantom
    const candidates = this._getOnlineIdle()
      .filter(p => Date.now() - p.lastChatTime > 30000) // respect rate limit
      .sort((a, b) => b.p.chattiness - a.p.chattiness);

    if (candidates.length === 0) return;
    const chosen = candidates[0];

    // Roll against chattiness
    if (Math.random() > chosen.p.chattiness) return;

    const delay = rand(3000, 12000);
    setTimeout(async () => {
      if (!chosen.isIdle && chosen.phase !== 'in-room' && chosen.phase !== 'matchmaking') return;

      const message = await generateChat(
        chosen.p, 'responding', chosen.recentChat, this.config, null, this._describeState(chosen)
      );
      if (message) {
        chosen.sendChat('global', message);
        console.log(`[Brain] ${chosen.name} replied in chat: "${message}"`);
      }
    }, delay);
  }

  async _reactToMention(mentionedName, msg, fromHuman) {
    const mentioned = this.phantoms.get(mentionedName);
    if (!mentioned || !mentioned.connected) return;

    // If from another phantom, check banter limits
    if (!fromHuman) {
      const banterKey = [msg.username, mentionedName].sort().join(':');
      const count = this.banterCount.get(banterKey) || 0;
      if (count >= 2) return; // Max 2 exchanges per phantom pair, then stop
      this.banterCount.set(banterKey, count + 1);

      if (!this.banterResetTimer) {
        this.banterResetTimer = setInterval(() => this.banterCount.clear(), 300000);
      }
    }

    // Rate limit — tighter for phantom-to-phantom, looser for human mentions
    const cooldown = fromHuman ? 5000 : 15000;
    if (Date.now() - mentioned.lastChatTime < cooldown) return;

    // Human mentions: fast reply (1-4s). Phantom mentions: slower (4-10s)
    const delay = fromHuman ? rand(1000, 4000) : rand(4000, 10000);

    setTimeout(async () => {
      if (!mentioned.connected) return;

      const context = this._buildBanterContext(mentionedName, msg.username);
      const message = await generateChat(
        mentioned.p, 'mention_reply', mentioned.recentChat, this.config, context, this._describeState(mentioned)
      );
      if (message) {
        mentioned.sendChat('global', message);
        const src = fromHuman ? 'human' : 'phantom';
        console.log(`[Brain] ${mentioned.name} replied to @mention (${src}) from ${msg.username}: "${message}"`);
      }
    }, delay);
  }

  async _reactToPhantomChat(msg) {
    const eventKey = `phantom_banter_${Date.now()}`;
    if (this._isLocked(eventKey, 45000)) return;
    this._lock(eventKey);

    // Pick a different phantom to chime in
    const candidates = [...this.phantoms.values()]
      .filter(p => p.connected && p.name !== msg.username)
      .filter(p => Date.now() - p.lastChatTime > 30000);

    if (candidates.length === 0) return;
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];

    // Check banter limit between these two
    const banterKey = [msg.username, chosen.name].sort().join(':');
    const count = this.banterCount.get(banterKey) || 0;
    if (count >= 2) return;
    this.banterCount.set(banterKey, count + 1);

    if (!this.banterResetTimer) {
      this.banterResetTimer = setInterval(() => this.banterCount.clear(), 300000);
    }

    const delay = rand(4000, 15000);
    setTimeout(async () => {
      if (!chosen.connected) return;

      const context = this._buildBanterContext(chosen.name, msg.username);
      const message = await generateChat(
        chosen.p, 'responding', chosen.recentChat, this.config, context, this._describeState(chosen)
      );
      if (message) {
        chosen.sendChat('global', message);
        console.log(`[Brain] ${chosen.name} banter with ${msg.username}: "${message}"`);
      }
    }, delay);
  }

  /**
   * Build banter context string from game history between two phantoms.
   */
  _buildBanterContext(responderName, otherName) {
    const games = this.recentResults.filter(
      r => (r.winner === responderName && r.loser === otherName) ||
           (r.winner === otherName && r.loser === responderName)
    );

    if (games.length === 0) return null;

    const last = games[games.length - 1];
    const responderWon = last.winner === responderName;
    const wins = games.filter(g => g.winner === responderName).length;
    const losses = games.filter(g => g.loser === responderName).length;

    return `You recently played ${otherName}. Record: ${wins}W-${losses}L. ${responderWon ? 'You won the last game.' : 'They beat you last game.'}`;
  }

  // ---- Ambient behavior ----

  async _ambientCheck() {
    const now = Date.now();
    this.lastAmbientCheck = now;

    const onlineIdle = this._getOnlineIdle();

    // 1. No phantom games or rooms → orchestrate a phantom-vs-phantom game
    if (!this.orchestrating && !this.phantomInMatchmaking && !this.phantomWaitingRoom) {
      const inGame = [...this.phantoms.values()].filter(p => p.isInGame);
      if (inGame.length === 0 && onlineIdle.length >= 2) {
        this._orchestrateGame(onlineIdle);
      }
    }

    // 2. Chat quiet for too long → have a phantom say something
    const chatQuietThreshold = 180000; // 3 minutes
    if (now - this.lastChatTime > chatQuietThreshold) {
      const chatty = onlineIdle
        .filter(p => Date.now() - p.lastChatTime > 60000)
        .filter(p => p.p.chattiness > 0.4)
        .sort(() => Math.random() - 0.5);

      if (chatty.length > 0) {
        const chosen = chatty[0];
        const context = chosen.phase === 'idle' ? 'idle_bored' : 'just_joined';
        const message = await generateChat(chosen.p, context, chosen.recentChat, this.config, null, this._describeState(chosen));
        if (message) {
          chosen.sendChat('global', message);
          this.lastChatTime = now;
          console.log(`[Brain] ${chosen.name} ambient chat: "${message}"`);
        }
      }
    }

    // 3. A phantom has been in a room alone too long → have another join or leave
    if (this.phantomWaitingRoom) {
      const waiting = this.phantoms.get(this.phantomWaitingRoom);
      if (waiting && waiting.phase === 'in-room') {
        const waitTime = now - waiting.lastActionTime;
        if (waitTime > 20000 && onlineIdle.length > 0) {
          // Another phantom should join
          const joiner = onlineIdle.find(p => p.name !== waiting.name);
          if (joiner && waiting.currentRoomId) {
            console.log(`[Brain] ${joiner.name} joining ${waiting.name}'s room`);
            joiner.joinRoom(waiting.currentRoomId);
          }
        } else if (waitTime > 60000) {
          // Nobody joined, give up
          console.log(`[Brain] ${waiting.name} room timeout, leaving`);
          waiting.leaveRoom();
        }
      }
    }
  }

  async _orchestrateGame(idlePlayers) {
    if (idlePlayers.length < 2) return;
    this.orchestrating = true;

    // Pick two random idle phantoms
    const shuffled = [...idlePlayers].sort(() => Math.random() - 0.5);
    const creator = shuffled[0];
    const joiner = shuffled[1];

    console.log(`[Brain] Orchestrating game: ${creator.name} vs ${joiner.name}`);

    // Step 1: Creator makes a room
    creator.createRoom();

    // Step 2: After a delay, joiner finds and joins the room
    const joinDelay = rand(5000, 10000);
    setTimeout(async () => {
      if (creator.phase !== 'in-room' || !creator.currentRoomId) {
        this.orchestrating = false;
        return;
      }
      if (!joiner.isIdle) {
        this.orchestrating = false;
        return;
      }

      console.log(`[Brain] ${joiner.name} joining ${creator.name}'s room ${creator.currentRoomId}`);
      joiner.joinRoom(creator.currentRoomId);

      // Step 3: Both ready up after their personality delay
      const creatorReadyDelay = rand(creator.p.readyDelay[0], creator.p.readyDelay[1]) * 1000;
      const joinerReadyDelay = rand(joiner.p.readyDelay[0], joiner.p.readyDelay[1]) * 1000 + 1000;

      setTimeout(() => {
        if (creator.phase === 'in-room') creator.readyUp();
      }, creatorReadyDelay + 2000); // Give joiner time to actually join

      setTimeout(() => {
        if (joiner.phase === 'in-room') joiner.readyUp();
      }, joinerReadyDelay + 2000);
    }, joinDelay);
  }

  // ---- Session management (called by PhantomManager) ----

  onPhantomOnline(player) {
    this.onlineSet.add(player.name);
    this.leavingInProgress.delete(player.name);
    this._wireEvents(player);

    // Schedule going offline after sessionLength
    const duration = rand(player.p.sessionLength[0], player.p.sessionLength[1]) * 60000;
    const timer = setTimeout(() => {
      this.sessionTimers.delete(player.name);
      if (player.connected && !this.leavingInProgress.has(player.name)) {
        this._phantomLeaving(player);
      }
    }, duration);
    this.sessionTimers.set(player.name, timer);

    // Send a join chat message after a short delay
    setTimeout(async () => {
      if (!player.connected) return;
      const message = await generateChat(player.p, 'just_joined', player.recentChat, this.config, null, 'Just came online');
      if (message) {
        player.sendChat('global', message);
        this.lastChatTime = Date.now();
        console.log(`[Brain] ${player.name} join chat: "${message}"`);
      }
    }, rand(3000, 10000));
  }

  async _phantomLeaving(player) {
    // Guard: don't run leaving sequence twice
    if (this.leavingInProgress.has(player.name)) return;
    this.leavingInProgress.add(player.name);

    // Set offline cooldown — phantom can't come back for breakLength minutes
    const breakDuration = rand(player.p.breakLength[0], player.p.breakLength[1]) * 60000;
    this.offlineUntil.set(player.name, Date.now() + breakDuration);

    // Maybe send a leaving message
    const message = await generateChat(player.p, 'leaving', player.recentChat, this.config, null, 'About to log off');
    if (message && player.connected) {
      player.sendChat('global', message);
      console.log(`[Brain] ${player.name} leaving chat: "${message}"`);
    }

    // Disconnect after a small delay
    setTimeout(() => {
      this.onlineSet.delete(player.name);
      if (player.connected) {
        player.disconnect();
      }
    }, rand(2000, 5000));
  }

  onPhantomOffline(player) {
    this.onlineSet.delete(player.name);
    this.leavingInProgress.delete(player.name);
    if (this.phantomInMatchmaking === player.name) {
      this.phantomInMatchmaking = null;
      this.phantomsSearching = Math.max(0, this.phantomsSearching - 1);
    }
    if (this.phantomWaitingRoom === player.name) {
      this.phantomWaitingRoom = null;
    }
    const timer = this.sessionTimers.get(player.name);
    if (timer) {
      clearTimeout(timer);
      this.sessionTimers.delete(player.name);
    }
  }

  /** Is a given phantom ready for session-end disconnect? */
  isSessionExpired(playerName) {
    // Only "expired" if we don't have a timer AND they're not currently leaving
    return !this.sessionTimers.has(playerName) && !this.leavingInProgress.has(playerName);
  }

  /** Is a phantom currently on a forced break (cannot reconnect)? */
  isOnBreak(playerName) {
    const until = this.offlineUntil.get(playerName);
    if (!until) return false;
    if (Date.now() >= until) {
      this.offlineUntil.delete(playerName);
      return false;
    }
    return true;
  }

  // ---- Helpers ----

  _isPhantom(username) {
    return this.phantoms.has(username);
  }

  /** Describe what a phantom is currently doing, for LLM context. */
  _describeState(player) {
    switch (player.phase) {
      case 'idle': return 'Hanging out in the lobby, not in a game';
      case 'matchmaking': return 'Searching for an opponent in matchmaking queue';
      case 'in-room': return 'Waiting in a room for someone to join and play';
      case 'in-game': {
        if (!player.localGame) return 'Playing a game of checkers';
        const score = player.localGame.evaluate(player.myColor);
        if (score > 5) return 'Playing a game and winning';
        if (score < -5) return 'Playing a game and losing';
        return 'Playing a close game of checkers';
      }
      default: return 'In the lobby';
    }
  }

  _getOnlineIdle() {
    return [...this.phantoms.values()].filter(p => p.isIdle);
  }

  _pickReactor() {
    const candidates = this._getOnlineIdle()
      .filter(p => p.canAct())
      .sort((a, b) => b.p.reactivity - a.p.reactivity);
    return candidates.length > 0 ? candidates[0] : null;
  }

  _isLocked(eventKey, durationMs) {
    const locked = this.eventLocks.get(eventKey);
    if (locked && Date.now() - locked < durationMs) return true;
    return false;
  }

  _lock(eventKey) {
    this.eventLocks.set(eventKey, Date.now());
    // Cleanup old locks periodically
    if (this.eventLocks.size > 100) {
      const now = Date.now();
      for (const [key, time] of this.eventLocks) {
        if (now - time > 120000) this.eventLocks.delete(key);
      }
    }
  }
}
