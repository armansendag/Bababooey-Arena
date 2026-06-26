(function () {
  "use strict";

  const app = document.getElementById("app");
  const FONT_OPTIONS = [
    ["default", "Default (Poppins)", "Poppins, Arial, Helvetica, sans-serif"],
    ["inter", "Inter", "Inter, Arial, Helvetica, sans-serif"],
    ["roboto", "Roboto", "Roboto, Arial, Helvetica, sans-serif"],
    ["open_sans", "Open Sans", "\"Open Sans\", Arial, Helvetica, sans-serif"],
    ["montserrat", "Montserrat", "Montserrat, Arial, Helvetica, sans-serif"],
    ["poppins", "Poppins", "Poppins, Arial, Helvetica, sans-serif"],
    ["nunito", "Nunito", "Nunito, Arial, Helvetica, sans-serif"],
    ["merriweather", "Merriweather", "Merriweather, Georgia, serif"],
    ["comic_sans", "Comic Sans", "\"Comic Sans MS\", \"Comic Sans\", cursive, Arial, sans-serif"],
    ["pixel_retro", "Pixel/Retro", "\"Courier New\", Consolas, monospace"]
  ];
  const FONT_MAP = new Map(FONT_OPTIONS.map(([id, label, stack]) => [id, { id, label, stack }]));
  const state = {
    view: "home",
    token: null,
    profile: null,
    authMode: "register",
    authForm: {
      email: "",
      password: "",
      username: ""
    },
    friendIdentifier: "",
    cards: [],
    collection: [],
    loadouts: [],
    quests: [],
    packs: [],
    friends: [],
    challenges: [],
    onlineMatches: [],
    onlineMatch: null,
    queueStatus: { status: "idle", mode: null, matchId: null },
    rankedProfile: null,
    leaderboards: { ranked: [], casual: [] },
    socket: null,
    connectionStatus: "offline",
    opponentDisconnected: false,
    reconnectTimer: null,
    loadoutDraft: {},
    loadoutCoreCardId: "core_starter",
    loadoutValidation: null,
    loadoutWarning: "",
    packReveal: null,
    cardFilters: {
      query: "",
      type: "all",
      faction: "all",
      rarity: "all",
      maxCost: "all",
      ownedFirst: false
    },
    loadoutOwnedFirst: false,
    match: null,
    battleMode: "local",
    battlePhase: "start",
    selected: null,
    detailCard: null,
    tutorialOpen: false,
    settingsOpen: false,
    feedback: null,
    message: "",
    messageFading: false,
    settings: {
      sound: false,
      animationSpeed: "normal",
      reducedMotion: false,
      font: localStorage.getItem("bababooey_font") || "poppins"
    }
  };
  let messageTimer = null;
  let messageFadeTimer = null;
  let messageTimerKey = "";

  const navItems = [
    ["home", "H", "Home"],
    ["collection", "C", "Collection"],
    ["loadout", "L", "Loadouts"],
    ["packs", "P", "Packs"],
    ["quests", "Q", "Quests"],
    ["online", "O", "Online"],
    ["battle", "B", "Battle"]
  ];

  function api(path, options = {}) {
    const headers = { "content-type": "application/json", ...(options.headers || {}) };
    if (state.token) headers.authorization = `Bearer ${state.token}`;
    return fetch(path, {
      ...options,
      headers,
      body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const details = Array.isArray(payload.details) ? ` ${payload.details.join(" ")}` : "";
        throw new Error(`${payload.error || "Request failed."}${details}`);
      }
      return payload;
    });
  }

  function card(cardId) {
    return state.cards.find((item) => item.id === cardId) || state.collection.find((item) => item.id === cardId);
  }

  function activePlayer() {
    return state.match?.players.find((player) => player.id === state.match.activePlayerId);
  }

  function opponentPlayer() {
    return state.match?.players.find((player) => player.id !== state.match.activePlayerId);
  }

  function viewerPlayer() {
    if (!state.match) return null;
    if (state.battleMode === "online" && state.profile?.userId) {
      return state.match.players.find((player) => player.id === state.profile.userId) || state.match.players[0];
    }
    return activePlayer();
  }

  function viewerOpponent() {
    const viewer = viewerPlayer();
    return state.match?.players.find((player) => player.id !== viewer?.id) || null;
  }

  function authHeaders() {
    return state.token ? { authorization: `Bearer ${state.token}` } : {};
  }

  function connectOnlineSocket() {
    if (!state.token || (state.socket && state.socket.readyState === WebSocket.OPEN)) return;
    if (state.socket) state.socket.close();
    state.connectionStatus = "connecting";
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${protocol}://${location.host}/ws?token=${encodeURIComponent(state.token)}`);
    state.socket = socket;

    socket.addEventListener("open", () => {
      state.connectionStatus = "connected";
      state.opponentDisconnected = false;
      if (state.onlineMatch?.id) socket.send(JSON.stringify({ type: "subscribe_match", matchId: state.onlineMatch.id }));
      render();
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      handleSocketMessage(message);
    });

    socket.addEventListener("close", () => {
      state.connectionStatus = "reconnecting";
      render();
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = setTimeout(connectOnlineSocket, 800);
    });

    socket.addEventListener("error", () => {
      state.connectionStatus = "reconnecting";
      render();
    });
  }

  function handleSocketMessage(message) {
    if (message.type === "connected") {
      state.challenges = message.challenges || state.challenges;
      state.onlineMatches = message.matches || state.onlineMatches;
      state.queueStatus = message.queue || state.queueStatus;
      state.rankedProfile = message.ranked || state.rankedProfile;
    }
    if (message.type === "queue_joined" || message.type === "queue_cancelled") {
      state.queueStatus = message.queue || state.queueStatus;
    }
    if (message.type === "queue_matched") {
      state.queueStatus = message.queue || { status: "matched", mode: message.match?.mode, matchId: message.match?.id };
      if (message.match) openOnlineMatch(message.match);
    }
    if (message.type === "challenge_received" || message.type === "challenge_sent" || message.type === "challenge_declined") {
      refreshOnlineData();
    }
    if (message.type === "match_created" || message.type === "match_snapshot" || message.type === "match_state" || message.type === "player_connected" || message.type === "player_disconnected") {
      const match = message.match;
      const previous = state.match;
      state.onlineMatch = match;
      state.match = match.state;
      state.battleMode = "online";
      state.battlePhase = match.status === "finished" ? "ended" : "playing";
      state.opponentDisconnected = (match.disconnectedPlayerIds || []).some((id) => id !== state.profile?.userId);
      if (message.type === "match_state") {
        state.feedback = buildFeedback(previous, match.state, null);
      }
    }
    if (message.type === "error") {
      state.message = message.error;
    }
    render();
  }

  async function refreshOnlineData() {
    if (!state.token) return;
    const [friends, challenges, matches, queue, ranked, leaderboards] = await Promise.all([
      api("/friends"),
      api("/friend-challenges"),
      api("/online-matches"),
      api("/queue/status"),
      api("/ranked/profile"),
      api("/leaderboards")
    ]);
    state.friends = friends;
    state.challenges = challenges;
    state.onlineMatches = matches;
    state.queueStatus = queue;
    state.rankedProfile = ranked;
    state.leaderboards = leaderboards;
  }

  function reportMatchBug() {
    const matchId = state.onlineMatch?.id || state.match?.id || null;
    const message = prompt("What went wrong in this match?");
    if (!message) return;
    api("/match-bug-reports", { method: "POST", body: { matchId, message } })
      .then(() => setMessage("Bug report sent. Thank you, that helps testing a lot."))
      .catch((error) => setMessage(error.message));
  }

  function setView(view) {
    state.view = view;
    state.selected = null;
    render();
  }

  function setMessage(message) {
    clearMessageTimers();
    state.message = message;
    state.messageFading = false;
    render();
  }

  function clearMessageTimers() {
    clearTimeout(messageTimer);
    clearTimeout(messageFadeTimer);
    messageTimer = null;
    messageFadeTimer = null;
    messageTimerKey = "";
  }

  function scheduleMessageDismiss() {
    if (!state.message) {
      clearMessageTimers();
      state.messageFading = false;
      return;
    }
    if (messageTimerKey === state.message) return;
    clearMessageTimers();
    messageTimerKey = state.message;
    messageFadeTimer = setTimeout(() => {
      if (messageTimerKey !== state.message) return;
      state.messageFading = true;
      render();
    }, 2400);
    messageTimer = setTimeout(() => {
      if (messageTimerKey !== state.message) return;
      state.message = "";
      state.messageFading = false;
      clearMessageTimers();
      render();
    }, 3200);
  }

  function playerName(playerId) {
    if (playerId === "player_1") return "Player 1";
    if (playerId === "player_2") return "Player 2";
    const onlinePlayer = state.onlineMatch?.players?.find((player) => player.userId === playerId);
    if (onlinePlayer) return onlinePlayer.displayName;
    return playerId || "Player";
  }

  function typeIcon(type) {
    return {
      troop: "T",
      spell: "S",
      enchantment: "E",
      core: "C"
    }[type] || "?";
  }

  function cardDescription(cardData) {
    return cardData.rulesText || cardData.text || (cardData.perks || []).join(" | ") || "No special rules.";
  }

  function rarityRank(rarity) {
    return ["common", "uncommon", "rare", "epic", "legendary", "mythic", "bababooey"].indexOf(rarity);
  }

  function sortedCards(items, options = {}) {
    return [...items].sort((a, b) => {
      if (options.ownedFirst) {
        const ownedDelta = Number((b.ownedCount || 0) > 0) - Number((a.ownedCount || 0) > 0);
        if (ownedDelta !== 0) return ownedDelta;
      }
      const rarityDelta = rarityRank(b.rarity) - rarityRank(a.rarity);
      if (rarityDelta !== 0) return rarityDelta;
      const costDelta = (a.manaCost || 0) - (b.manaCost || 0);
      if (costDelta !== 0) return costDelta;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  function friendlyEvent(event) {
    if (!event) return "";
    const actor = playerName(event.playerId);
    const payload = event.payload || {};
    const played = card(payload.cardId)?.name || payload.cardId;
    if (event.type === "turn_started") return `${actor} starts turn ${event.turnNumber}.`;
    if (event.type === "turn_ended") return `${actor} ends the turn.`;
    if (event.type === "troop_played") return `${actor} summons ${played}.`;
    if (event.type === "enchantment_played") return `${actor} activates ${played}.`;
    if (event.type === "enchantment_destroyed") return `${card(payload.cardId)?.name || "Enchantment"} breaks and enters cooldown.`;
    if (event.type === "troop_defeated") return `${card(payload.cardId)?.name || "Troop"} is defeated and returns to cooldown.`;
    if (event.type === "spell_cast") return `${actor} casts ${card(payload.cardId)?.name || payload.cardId}.`;
    if (event.type === "troop_attacked") {
      const attacker = card(payload.attackerCardId)?.name || "Troop";
      const target = payload.result?.targetType || "target";
      return `${actor}'s ${attacker} hits ${target} for ${payload.result?.damage ?? 0}.`;
    }
    if (event.type === "match_finished") return `${playerName(payload.winnerId)} wins the match.`;
    return `${actor} ${event.type.replaceAll("_", " ")}.`;
  }

  function buildFeedback(previous, next, command) {
    const event = next.eventLog[next.eventLog.length - 1];
    if (!event) return null;
    const result = event.payload?.result || {};
    const feedback = {
      sequence: event.sequence,
      type: event.type,
      text: friendlyEvent(event),
      damage: result.damage || result.selfCoreDamage || 0,
      target: command?.target || event.payload?.target || null,
      attackerInstanceId: command?.attackerInstanceId || event.payload?.attackerInstanceId || null
    };
    if (event.type === "troop_defeated") feedback.deathInstanceId = event.payload.instanceId;
    if (event.type === "enchantment_destroyed") feedback.breakInstanceId = event.payload.instanceId;
    if (event.type === "match_finished") feedback.matchEnd = true;
    return feedback;
  }

  function motionClass() {
    return `motion-${state.settings.animationSpeed}${state.settings.reducedMotion ? " reduce-motion" : ""}`;
  }

  function normalizeFont(fontId) {
    return FONT_MAP.has(fontId) ? fontId : "poppins";
  }

  function currentFont() {
    const fontId = normalizeFont(state.settings.font);
    return FONT_MAP.get(fontId);
  }

  function applyFontPreference(fontId = state.settings.font) {
    const safeFont = normalizeFont(fontId);
    state.settings.font = safeFont;
    document.documentElement.style.setProperty("--ui-font", FONT_MAP.get(safeFont).stack);
    localStorage.setItem("bababooey_font", safeFont);
    return safeFont;
  }

  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  function iconButton(label, text, disabled, onClick) {
    const button = el("button", "", `<span aria-hidden="true">${label}</span> ${text}`);
    button.disabled = Boolean(disabled);
    button.addEventListener("click", onClick);
    return button;
  }

  function shell(content) {
    document.querySelectorAll(".modal-backdrop, .floating-detail").forEach((node) => node.remove());
    app.innerHTML = "";
    const root = el("div", `app ${motionClass()}`);
    const sidebar = el("aside", "sidebar");
    sidebar.appendChild(el("div", "brand", `
      <img class="brand-logo" src="/assets/fairs-logo.jpg" alt="Bababooey Arena logo">
      <div><div class="brand-title">Bababooey Arena</div><div class="brand-sub">Local prototype</div></div>
    `));
    const nav = el("div", "nav");
    for (const [view, symbol, label] of navItems) {
      const button = iconButton(symbol, label, false, () => setView(view));
      if (state.view === view) button.classList.add("active");
      nav.appendChild(button);
    }
    sidebar.appendChild(nav);
    const main = el("main", "main");
    if (state.message) {
      main.appendChild(el("div", `section toast-message ${state.messageFading ? "fading" : ""}`, `<strong>${escapeHtml(state.message)}</strong>`));
      scheduleMessageDismiss();
    }
    main.appendChild(content);
    root.append(sidebar, main);
    app.appendChild(root);
    renderOverlays();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function titleBar(title, actions = []) {
    const bar = el("div", "topbar");
    bar.appendChild(el("h1", "", escapeHtml(title)));
    const tools = el("div", "toolbar");
    tools.appendChild(iconButton("?", "Tutorial", false, () => {
      state.tutorialOpen = true;
      render();
    }));
    tools.appendChild(iconButton("G", "Settings", false, () => {
      state.settingsOpen = true;
      render();
    }));
    actions.forEach((action) => tools.appendChild(action));
    bar.appendChild(tools);
    return bar;
  }

  function renderDetailOnly() {
    document.querySelectorAll(".floating-detail").forEach((node) => node.remove());
    if (!state.detailCard) return;
    document.body.appendChild(cardDetailOverlay(state.detailCard, false));
  }

  function cardDetailOverlay(cardData, modal) {
    const wrapper = el("div", modal ? "modal-backdrop" : "floating-detail");
    const panel = el("section", `detail-panel ${cardData.rarity || "common"}`);
    panel.innerHTML = `
      <div class="detail-top">
        <div class="mana">${cardData.manaCost}</div>
        <div>
          <h2>${escapeHtml(cardData.name)}</h2>
          <div class="label"><span class="type-icon">${typeIcon(cardData.type)}</span> ${escapeHtml(cardData.rarity)} ${escapeHtml(cardData.type)} / ${escapeHtml(cardData.faction || "neutral")}</div>
        </div>
      </div>
      <div class="stats detail-stats">
        ${cardData.attack !== undefined ? `<span class="stat">Attack ${cardData.attack}</span>` : ""}
        ${cardData.defense !== undefined ? `<span class="stat">Defense ${cardData.defense}</span>` : ""}
        ${cardData.hp !== undefined ? `<span class="stat">HP ${cardData.hp}</span>` : ""}
        <span class="stat">Cooldown ${cardData.cooldown}</span>
        <span class="stat">Copy ${escapeHtml(cardData.copyTag || "standard")}</span>
      </div>
      <div class="detail-rules">
        <h3>What it does</h3>
        <p>${escapeHtml(cardDescription(cardData))}</p>
      </div>
      ${(cardData.perks || []).length ? `<p class="small">Tags: ${escapeHtml((cardData.perks || []).join(" | "))}</p>` : ""}
    `;
    if (modal) {
      panel.appendChild(iconButton("X", "Close", false, () => {
        state.detailCard = null;
        render();
      }));
      wrapper.addEventListener("click", (event) => {
        if (event.target === wrapper) {
          state.detailCard = null;
          render();
        }
      });
    }
    wrapper.appendChild(panel);
    return wrapper;
  }

  function renderOverlays() {
    if (state.detailCard) document.body.appendChild(cardDetailOverlay(state.detailCard, true));
    if (state.tutorialOpen) document.body.appendChild(tutorialOverlay());
    if (state.settingsOpen) document.body.appendChild(settingsOverlay());
  }

  function tutorialOverlay() {
    const wrapper = el("div", "modal-backdrop");
    const panel = el("section", "modal-panel tutorial-panel");
    panel.innerHTML = `
      <h2>Battle Basics</h2>
      <div class="tutorial-grid">
        <div><strong>Mana</strong><p>Mana is banked. You keep unspent mana, gain 1/2/3/4/5 by owner turn, and the bank caps at 20.</p></div>
        <div><strong>Cooldowns</strong><p>Defeated troops, destroyed enchantments, and used spells return after owner-turn cooldown ticks.</p></div>
        <div><strong>Troops</strong><p>Troops need a full turn before attacking unless they have Haste. Select your troop, then a highlighted target.</p></div>
        <div><strong>Spells</strong><p>Spells are reusable. Some resolve instantly, while targeted spells ask for a valid target.</p></div>
        <div><strong>Enchantments</strong><p>You can keep up to 3 active enchantments. Enchantments have HP and can be attacked.</p></div>
        <div><strong>Core HP</strong><p>Each Core starts at 20 HP. Enemy troops block Core attacks until they are cleared.</p></div>
        <div><strong>End Turn</strong><p>Use End Turn when you are finished spending mana and attacking.</p></div>
      </div>
    `;
    panel.appendChild(iconButton("X", "Close", false, () => {
      state.tutorialOpen = false;
      render();
    }));
    wrapper.addEventListener("click", (event) => {
      if (event.target === wrapper) {
        state.tutorialOpen = false;
        render();
      }
    });
    wrapper.appendChild(panel);
    return wrapper;
  }

  function settingsOverlay() {
    const wrapper = el("div", "modal-backdrop");
    const panel = el("section", "modal-panel settings-panel");
    const selectedFont = currentFont();
    panel.innerHTML = `
      <h2>Settings</h2>
      <label class="setting-row"><span>Username<span class="small">3-16 letters, numbers, or underscores. Changes are limited to once every 30 days.</span></span><input data-username-edit value="${escapeHtml(state.profile?.username || state.profile?.displayName || "")}"></label>
      <div class="setting-row">
        <span>Font<span class="small">Current: ${escapeHtml(selectedFont.label)}</span></span>
        <select data-font-select>
          ${FONT_OPTIONS.map(([id, label]) => `<option value="${escapeHtml(id)}" ${state.settings.font === id ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
        </select>
      </div>
      <div class="font-preview" data-font-preview>
        <strong>Sample Card Name</strong>
        <div class="stats"><span class="stat">ATK 4</span><span class="stat">DEF 2</span><span class="stat">HP 7</span></div>
        <span class="small">Sample game text: Clear enemy troops before striking the Core.</span>
      </div>
      <div class="toolbar"><button data-reset-font>Reset Font to Default</button></div>
      <label class="setting-row"><span>Sound</span><input type="checkbox" data-setting="sound" ${state.settings.sound ? "checked" : ""}></label>
      <label class="setting-row"><span>Reduced motion</span><input type="checkbox" data-setting="reducedMotion" ${state.settings.reducedMotion ? "checked" : ""}></label>
      <label class="setting-row"><span>Animation speed</span><select data-setting="animationSpeed">
        <option value="slow" ${state.settings.animationSpeed === "slow" ? "selected" : ""}>Slow</option>
        <option value="normal" ${state.settings.animationSpeed === "normal" ? "selected" : ""}>Normal</option>
        <option value="fast" ${state.settings.animationSpeed === "fast" ? "selected" : ""}>Fast</option>
      </select></label>
    `;
    panel.querySelectorAll("[data-setting]").forEach((control) => {
      control.addEventListener("change", () => {
        const key = control.getAttribute("data-setting");
        state.settings[key] = control.type === "checkbox" ? control.checked : control.value;
        render();
      });
    });
    const usernameInput = panel.querySelector("[data-username-edit]");
    usernameInput.addEventListener("change", () => updateUsername(usernameInput.value));
    usernameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") updateUsername(usernameInput.value);
    });
    panel.querySelector("[data-font-select]").addEventListener("change", (event) => updateFontPreference(event.target.value));
    panel.querySelector("[data-reset-font]").addEventListener("click", () => updateFontPreference("poppins"));
    panel.appendChild(el("div", "setting-row danger-zone", `
      <span><strong>Reset my stats</strong><span class="small">Coins, collection, loadouts, quests, ratings, friends, and match history reset to starter state.</span></span>
      <button data-reset-stats>Reset</button>
    `));
    panel.querySelector("[data-reset-stats]").addEventListener("click", resetMyStats);
    panel.appendChild(iconButton("X", "Close", false, () => {
      state.settingsOpen = false;
      render();
    }));
    wrapper.addEventListener("click", (event) => {
      if (event.target === wrapper) {
        state.settingsOpen = false;
        render();
      }
    });
    wrapper.appendChild(panel);
    return wrapper;
  }

  async function resetMyStats() {
    const confirmation = "RESET MY STATS";
    const typed = prompt(`Type ${confirmation} to reset your own account progress.`);
    if (typed !== confirmation) {
      setMessage("Reset cancelled.");
      return;
    }
    try {
      const result = await api("/me/reset", { method: "POST", body: { confirmation: typed } });
      state.profile = result.profile;
      state.collection = result.collection;
      state.settingsOpen = false;
      state.loadoutDraft = {};
      state.loadoutValidation = null;
      state.packReveal = null;
      await refreshAccountData();
      await refreshOnlineData();
      state.view = "home";
      state.message = "Your stats were reset to the starter account state.";
      render();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateUsername(username) {
    try {
      state.profile = await api("/me", { method: "PATCH", body: { username } });
      state.message = "Username updated.";
      await refreshOnlineData();
      render();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateFontPreference(fontId) {
    const safeFont = applyFontPreference(fontId);
    try {
      if (state.token) {
        state.profile = await api("/me", { method: "PATCH", body: { settings: { font: safeFont } } });
        state.settings.font = normalizeFont(state.profile?.settings?.font);
        applyFontPreference(state.settings.font);
      }
      state.message = `Font set to ${currentFont().label}.`;
      render();
    } catch (error) {
      setMessage(error.message);
      render();
    }
  }

  function renderCard(cardData, options = {}) {
    const disabled = options.disabled ? "disabled" : "";
    const node = el("div", `game-card ${cardData.rarity || "common"} ${options.selected ? "selected" : ""} ${disabled}`);
    if (options.reveal) node.classList.add("pack-result-card");
    if (options.reveal && rarityRank(cardData.rarity) >= rarityRank("rare")) node.classList.add("big-reveal");
    if (options.reveal && rarityRank(cardData.rarity) >= rarityRank("epic")) node.classList.add("slam-reveal");
    const stats = [];
    if (cardData.attack !== undefined) stats.push(`<span class="stat">ATK ${cardData.attack}</span>`);
    if (cardData.defense !== undefined) stats.push(`<span class="stat">DEF ${cardData.defense}</span>`);
    if (cardData.hp !== undefined) stats.push(`<span class="stat">HP ${cardData.hp}</span>`);
    stats.push(`<span class="stat">CD ${cardData.cooldown}</span>`);
    const description = cardDescription(cardData);
    const needsMore = description.length > 150;
    node.innerHTML = `
      <div class="rarity-frame"></div>
      <div class="card-head">
        <div class="mana">${cardData.manaCost}</div>
        <div class="rarity-badge">${escapeHtml(cardData.rarity || "common")}</div>
        <div class="card-title-block">
          <div class="card-name">${escapeHtml(cardData.name)}</div>
          <div class="label"><span class="type-icon">${typeIcon(cardData.type)}</span> ${escapeHtml(cardData.type)}</div>
        </div>
      </div>
      <div class="faction-label">${escapeHtml(cardData.faction || "neutral")}</div>
      <div class="card-description">${escapeHtml(description)}</div>
      ${needsMore ? `<button class="show-more" data-show-more>Show more</button>` : ""}
      <div class="stats">${stats.join("")}</div>
    `;
    const showMore = node.querySelector("[data-show-more]");
    if (showMore) {
      showMore.addEventListener("pointerdown", (event) => event.stopPropagation());
      showMore.addEventListener("click", (event) => {
        event.stopPropagation();
        state.detailCard = cardData;
        render();
      });
    }
    if (options.actions) {
      const actions = el("div", "card-actions");
      options.actions.forEach((action) => actions.appendChild(action));
      actions.addEventListener("pointerdown", (event) => event.stopPropagation());
      actions.addEventListener("click", (event) => event.stopPropagation());
      node.appendChild(actions);
    }
    node.addEventListener("click", (event) => {
      if (options.onClick) {
        options.onClick(event);
        return;
      }
      state.detailCard = cardData;
      render();
    });
    return node;
  }

  function renderHome() {
    const page = el("div", "grid");
    page.appendChild(titleBar("Home"));
    page.appendChild(el("section", "hero", `
      <img class="hero-logo" src="/assets/fairs-logo.jpg" alt="Bababooey Arena logo">
      <h1>Bababooey Arena</h1>
      <p>Your account starts with a legal beginner deck, 1000 coins, and three free Starter Packs. Build the rest over time.</p>
    `));
    const onboarding = el("section", "section onboarding-panel");
    onboarding.innerHTML = `
      <h2>First Match Checklist</h2>
      <div class="onboarding-steps">
        <div><strong>1. Open packs</strong><span class="small">Use your three free Starter Packs, then spend coins carefully.</span></div>
        <div><strong>2. Check your deck</strong><span class="small">Your beginner loadout is legal, but your collection starts small.</span></div>
        <div><strong>3. Play the turn</strong><span class="small">Spend mana, summon troops, attack valid targets, then press E to end turn.</span></div>
      </div>
    `;
    onboarding.appendChild(iconButton("P", "Open Packs", false, () => setView("packs")));
    onboarding.appendChild(iconButton("L", "Open Loadouts", false, () => setView("loadout")));
    page.appendChild(onboarding);
    const stats = el("div", "grid three");
    stats.appendChild(el("section", "section", `<h2>Profile</h2><div class="pill-row"><span class="pill">@${escapeHtml(state.profile?.username || state.profile?.displayName || "Demo")}</span><span class="pill">${escapeHtml(state.profile?.friendCode || "")}</span><span class="pill">${state.profile?.coins ?? 0} coins</span></div>`));
    stats.appendChild(el("section", "section", `<h2>Collection</h2><div class="pill-row"><span class="pill">${state.collection.filter((item) => item.ownedCount > 0).length} owned cards</span><span class="pill">${state.cards.length} catalog cards</span></div>`));
    stats.appendChild(el("section", "section", `<h2>Battle</h2><div class="pill-row"><span class="pill">${state.match ? "Match ready" : "No match"}</span><span class="pill">${state.match?.status || "idle"}</span></div>`));
    page.appendChild(stats);
    shell(page);
  }

  function renderCollection() {
    const page = el("div", "grid");
    page.appendChild(titleBar("Collection"));
    page.appendChild(cardFilterPanel());
    const grid = el("div", "card-grid");
    filteredCollection().forEach((item) => {
      grid.appendChild(renderCard(item, {
        actions: [el("span", "pill", `Owned ${item.ownedCount}`)]
      }));
    });
    if (!grid.children.length) grid.appendChild(el("div", "empty", "No cards match those filters."));
    page.appendChild(grid);
    shell(page);
  }

  function uniqueValues(field) {
    return Array.from(new Set(state.cards.map((item) => item[field]).filter(Boolean))).sort();
  }

  function cardFilterPanel() {
    const panel = el("section", "section card-filter-panel");
    const filters = state.cardFilters;
    panel.innerHTML = `
      <h2>Search Cards</h2>
      <div class="filter-grid">
        <input data-card-filter="query" placeholder="Search name or perk" value="${escapeHtml(filters.query)}">
        <select data-card-filter="type">
          <option value="all">All types</option>
          ${uniqueValues("type").map((value) => `<option value="${escapeHtml(value)}" ${filters.type === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}
        </select>
        <select data-card-filter="faction">
          <option value="all">All factions</option>
          ${uniqueValues("faction").map((value) => `<option value="${escapeHtml(value)}" ${filters.faction === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}
        </select>
        <select data-card-filter="rarity">
          <option value="all">All rarities</option>
          ${uniqueValues("rarity").map((value) => `<option value="${escapeHtml(value)}" ${filters.rarity === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}
        </select>
        <select data-card-filter="maxCost">
          <option value="all">Any cost</option>
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => `<option value="${value}" ${String(filters.maxCost) === String(value) ? "selected" : ""}>${value} or less</option>`).join("")}
        </select>
        <label class="checkbox-filter"><input data-card-filter="ownedFirst" type="checkbox" ${filters.ownedFirst ? "checked" : ""}> Owned first</label>
      </div>
    `;
    panel.querySelectorAll("[data-card-filter]").forEach((control) => {
      control.addEventListener("input", () => {
        updateCardFilter(control);
      });
      control.addEventListener("change", () => {
        updateCardFilter(control);
      });
    });
    return panel;
  }

  function updateCardFilter(control) {
    const key = control.getAttribute("data-card-filter");
    const shouldRestoreFocus = key === "query" && document.activeElement === control;
    const selectionStart = control.selectionStart;
    const selectionEnd = control.selectionEnd;
    state.cardFilters[key] = control.type === "checkbox" ? control.checked : control.value;
    render();
    if (shouldRestoreFocus) {
      restoreCardFilterFocus(key, selectionStart, selectionEnd);
    }
  }

  function restoreCardFilterFocus(key, selectionStart, selectionEnd) {
    const nextControl = document.querySelector(`[data-card-filter="${key}"]`);
    if (!nextControl) return;
    nextControl.focus();
    if (typeof nextControl.setSelectionRange === "function" && selectionStart !== null && selectionEnd !== null) {
      nextControl.setSelectionRange(selectionStart, selectionEnd);
    }
  }

  function filteredCollection() {
    const filters = state.cardFilters;
    const query = filters.query.trim().toLowerCase();
    return sortedCards(state.collection.filter((item) => {
      if (filters.type !== "all" && item.type !== filters.type) return false;
      if (filters.faction !== "all" && item.faction !== filters.faction) return false;
      if (filters.rarity !== "all" && item.rarity !== filters.rarity) return false;
      if (filters.maxCost !== "all" && item.manaCost > Number(filters.maxCost)) return false;
      if (!query) return true;
      return `${item.name} ${(item.perks || []).join(" ")} ${cardDescription(item)}`.toLowerCase().includes(query);
    }), { ownedFirst: filters.ownedFirst });
  }

  function draftCount(cardId) {
    return state.loadoutDraft[cardId] || 0;
  }

  function draftSummary(extraCardId = null) {
    const summary = { total: 0, troop: 0, spell: 0, enchantment: 0 };
    const entries = { ...state.loadoutDraft };
    if (extraCardId) entries[extraCardId] = (entries[extraCardId] || 0) + 1;
    Object.entries(entries).forEach(([cardId, quantity]) => {
      const item = card(cardId);
      if (!item || item.type === "core") return;
      summary.total += quantity;
      if (summary[item.type] !== undefined) summary[item.type] += quantity;
    });
    return summary;
  }

  function loadoutLimitMessage(item) {
    const currentCount = draftCount(item.id);
    if (currentCount >= (item.ownedCount || 0)) return `You only own ${item.ownedCount || 0} copies of ${item.name}.`;
    const next = draftSummary(item.id);
    if (next.total > 12) return "Deck is full. Remove a card before adding another one.";
    if (item.type === "troop" && next.troop > 8) return "Deck already has 8 troops. Remove a troop before adding another one.";
    if (item.type === "spell" && next.spell > 2) return "Deck already has 2 spells. Remove a spell before adding another one.";
    if (item.type === "enchantment" && next.enchantment > 2) return "Deck already has 2 enchantments. Remove an enchantment before adding another one.";
    return "";
  }

  function updateDraft(cardId, delta) {
    if (delta > 0) {
      const item = card(cardId);
      const warning = item ? loadoutLimitMessage(item) : "That card cannot be added to this deck.";
      if (warning) {
        state.loadoutWarning = warning;
        render();
        return;
      }
    }
    state.loadoutDraft[cardId] = Math.max(0, draftCount(cardId) + delta);
    if (state.loadoutDraft[cardId] === 0) delete state.loadoutDraft[cardId];
    state.loadoutWarning = "";
    validateDraft();
  }

  function validateDraft() {
    return api("/loadouts/validate", {
      method: "POST",
      body: { name: "Prototype Loadout", coreCardId: state.loadoutCoreCardId, cards: state.loadoutDraft }
    }).then((result) => {
      state.loadoutValidation = result;
      render();
    }).catch((error) => setMessage(error.message));
  }

  async function saveActiveLoadout() {
    try {
      const saved = await api("/loadouts", {
        method: "POST",
        body: { name: "Custom Deck", coreCardId: state.loadoutCoreCardId, cards: state.loadoutDraft }
      });
      await api(`/loadouts/${saved.id}/activate`, { method: "POST" });
      await refreshAccountData();
      state.loadoutValidation = await api("/loadouts/validate", {
        method: "POST",
        body: { name: saved.name, coreCardId: state.loadoutCoreCardId, cards: state.loadoutDraft }
      });
      state.message = "Deck saved and activated. Queues will use this deck.";
      render();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function autoFillLoadout() {
    const owned = new Map(state.collection.map((item) => [item.id, item.ownedCount || 0]));
    const starterDraft = {
      troop_mana_goblin: 3,
      troop_mana_slime: 3,
      troop_mana_golem: 2,
      spell_emergency_funding: 2,
      enchant_mana_spring: 2
    };
    state.loadoutCoreCardId = owned.get("core_starter") > 0 ? "core_starter" : state.collection.find((item) => item.type === "core" && item.ownedCount > 0)?.id || "core_starter";
    state.loadoutDraft = Object.fromEntries(
      Object.entries(starterDraft)
        .filter(([cardId]) => (owned.get(cardId) || 0) > 0)
        .map(([cardId, quantity]) => [cardId, Math.min(quantity, owned.get(cardId) || 0)])
    );
    state.loadoutWarning = "";
    validateDraft();
  }

  function renderLoadout() {
    const page = el("div", "grid");
    const validation = state.loadoutValidation;
    page.appendChild(titleBar("Loadout Builder", [
      iconButton("+", "Autofill", false, autoFillLoadout),
      iconButton("V", "Validate", false, validateDraft),
      iconButton("S", "Save Deck", validation?.valid !== true, saveActiveLoadout)
    ]));
    page.appendChild(el("section", "section onboarding-panel", `
      <h2>Deck Builder</h2>
      <p>Build exactly 8 troops, 2 spells, and 2 enchantments, then Save Deck to activate it for casual, ranked, and friend matches.</p>
    `));
    const layout = el("div", "builder");
    const cardPanel = el("section", "section");
    cardPanel.appendChild(el("h2", "", "Available Cards"));
    const sortToggle = el("label", "checkbox-filter loadout-sort-toggle", `<input data-loadout-owned-first type="checkbox" ${state.loadoutOwnedFirst ? "checked" : ""}> Owned first`);
    sortToggle.querySelector("[data-loadout-owned-first]").addEventListener("change", (event) => {
      state.loadoutOwnedFirst = event.target.checked;
      render();
    });
    cardPanel.appendChild(sortToggle);
    const grid = el("div", "card-grid");
    const ownedLoadoutCards = sortedCards(state.collection.filter((item) => item.type !== "core" && item.ownedCount > 0), { ownedFirst: state.loadoutOwnedFirst });
    ownedLoadoutCards.forEach((item) => {
      grid.appendChild(renderCard(item, {
        actions: [
          iconButton("-", "", draftCount(item.id) === 0, (event) => {
            event.stopPropagation();
            updateDraft(item.id, -1);
          }),
          el("span", "pill", `${draftCount(item.id)} / ${item.ownedCount}`),
          iconButton("+", "", false, (event) => {
            event.stopPropagation();
            updateDraft(item.id, 1);
          })
        ]
      }));
    });
    if (!ownedLoadoutCards.length) grid.appendChild(el("div", "empty", "No owned non-core cards yet. Open packs to expand your loadout options."));
    cardPanel.appendChild(grid);

    const selected = el("section", "section");
    selected.appendChild(el("h2", "", "Draft"));
    const coreChoices = state.collection.filter((item) => item.type === "core" && item.ownedCount > 0);
    const coreSelect = el("label", "setting-row", `<span>Core</span><select data-core-select>${coreChoices.map((item) => `<option value="${escapeHtml(item.id)}" ${state.loadoutCoreCardId === item.id ? "selected" : ""}>${escapeHtml(item.name)} (${item.hp} HP)</option>`).join("")}</select>`);
    coreSelect.querySelector("[data-core-select]").addEventListener("change", (event) => {
      state.loadoutCoreCardId = event.target.value;
      validateDraft();
    });
    selected.appendChild(coreSelect);
    selected.appendChild(el("div", "pill-row", `
      <span class="pill">Total ${validation?.summary?.total || 0}/12</span>
      <span class="pill">Troops ${validation?.summary?.troops || 0}/8</span>
      <span class="pill">Spells ${validation?.summary?.spells || 0}/2</span>
      <span class="pill">Enchantments ${validation?.summary?.enchantments || 0}/2</span>
      <span class="pill">${validation?.valid ? "Valid" : "Needs work"}</span>
    `));
    if (state.loadoutWarning) selected.appendChild(el("div", "loadout-warning", escapeHtml(state.loadoutWarning)));
    const list = el("div", "selected-list");
    Object.entries(state.loadoutDraft).forEach(([cardId, quantity]) => {
      const item = card(cardId);
      list.appendChild(el("div", "selected-row", `<strong>${escapeHtml(item?.name || cardId)}</strong><span class="pill">${quantity}</span><span class="small">${escapeHtml(item?.type || "")}</span>`));
    });
    if (Object.keys(state.loadoutDraft).length === 0) list.appendChild(el("div", "empty", "No cards selected."));
    selected.appendChild(list);
    if (validation?.errors?.length) {
      selected.appendChild(el("div", "section", validation.errors.map(escapeHtml).join("<br>")));
    }
    selected.appendChild(iconButton("S", "Save & Activate Deck", validation?.valid !== true, saveActiveLoadout));
    if (state.loadouts.length) {
      selected.appendChild(el("div", "small", `Active saved deck: ${escapeHtml(state.loadouts.find((loadout) => loadout.isActive)?.name || "None")}`));
    }
    layout.append(cardPanel, selected);
    page.appendChild(layout);
    shell(page);
  }

  function renderPacks() {
    const page = el("div", "grid");
    page.appendChild(titleBar("Pack Opening"));
    if (state.packReveal) {
      const reveal = el("section", "section pack-reveal-stage");
      const best = state.packReveal.cards
        .map((result) => result.card)
        .sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity))[0];
      reveal.innerHTML = `
        <div class="pack-reveal-header">
          <div>
            <span class="pack-reveal-kicker">Pack opened</span>
            <h2>${escapeHtml(state.packReveal.pack?.name || "Pack")} Reveal</h2>
            <p class="small">${best ? `Best pull charging: ${escapeHtml(best.rarity)} ${escapeHtml(best.name)}` : "Cards added to your collection."}</p>
          </div>
          <div class="pill-row">
            <span class="pill">${state.packReveal.opening?.free ? "Free pack" : `${state.packReveal.pack?.price || 0} coins`}</span>
            <span class="pill">${state.packReveal.opening?.duplicateCoins || 0} duplicate coins</span>
          </div>
        </div>
        <div class="pack-drumroll">
          <span></span><span></span><span></span><strong>Revealing cards...</strong>
        </div>
        ${best ? `<div class="pack-spotlight ${escapeHtml(best.rarity || "common")}"><span>Biggest pull</span><strong>${escapeHtml(best.name)}</strong><em>${escapeHtml(best.rarity || "common")}</em></div>` : ""}
      `;
      const row = el("div", "reveal-row pack-results-grid");
      state.packReveal.cards.forEach((result, index) => {
        const node = renderCard(result.card, { reveal: true });
        node.style.animationDelay = `${650 + index * 420}ms`;
        node.style.setProperty("--reveal-index", index);
        const resultNote = result.added
          ? `Added to collection (x${result.ownedCount})`
          : `Duplicate converted: +${result.duplicateCoins} coins`;
        node.appendChild(el("div", "pack-card-result", escapeHtml(resultNote)));
        row.appendChild(node);
      });
      reveal.appendChild(row);
      page.appendChild(reveal);
    }
    const stage = el("section", "section pack-stage");
    stage.appendChild(el("h2", "", "Pack Shop"));
    stage.appendChild(el("p", "small", "Packs are rolled server-side. Copies 1-10 stay in your collection; only copy 11+ converts to coins."));
    const packGrid = el("div", "grid two");
    state.packs.forEach((pack) => {
      const freeCount = state.profile?.freePacks?.[pack.id] || 0;
      const canOpen = freeCount > 0 || (state.profile?.coins || 0) >= pack.price;
      const packNode = el("section", "queue-card");
      const odds = (pack.dropTable || []).map((entry) => `${entry.rarity}: ${entry.weight}`).join(" / ");
      const guarantees = (pack.guaranteedSlots || []).length
        ? pack.guaranteedSlots.map((slot) => slot.rarity ? `${slot.rarity} slot` : `${slot.type} slot`).join(", ")
        : "None";
      packNode.innerHTML = `
        <h3>${escapeHtml(pack.name)}</h3>
        <p>${escapeHtml(pack.description || "")}</p>
        <div class="pill-row">
          <span class="pill">${pack.price} coins</span>
          <span class="pill">${pack.cardsPerPack} cards</span>
          ${freeCount ? `<span class="pill">${freeCount} free</span>` : ""}
        </div>
        <div class="small">Odds: ${escapeHtml(odds)}</div>
        <div class="small">Guaranteed: ${escapeHtml(guarantees)}</div>
      `;
      packNode.appendChild(iconButton("O", freeCount ? "Open Free Pack" : "Open Pack", !canOpen, () => openPack(pack.id)));
      packGrid.appendChild(packNode);
    });
    stage.appendChild(packGrid);
    page.appendChild(stage);
    shell(page);
  }

  function openPack(packId) {
    api(`/shop/packs/${packId}/open`, { method: "POST" })
      .then(async (result) => {
        state.packReveal = result;
        await refreshAccountData();
        state.view = "packs";
        render();
      })
      .catch((error) => setMessage(error.message));
  }

  function renderAuth() {
    app.innerHTML = "";
    const page = el("main", "main");
    const panel = el("section", "section");
    panel.innerHTML = `
      <img class="auth-logo" src="/assets/fairs-logo.jpg" alt="Bababooey Arena logo">
      <h1>Bababooey Arena</h1>
      <p class="small">Create an account or log in. Your username, collection, coins, loadouts, and match history are saved.</p>
      <div class="grid">
        ${state.authMode === "register" ? `<input data-auth="username" placeholder="Username" value="${escapeHtml(state.authForm.username)}">` : ""}
        <input data-auth="email" placeholder="Email" value="${escapeHtml(state.authForm.email)}">
        <input data-auth="password" placeholder="Password" type="password" value="${escapeHtml(state.authForm.password)}">
      </div>
      <label class="setting-row"><span>Remember me<span class="small">This device keeps your session token in local storage.</span></span><input type="checkbox" checked disabled></label>
      <div class="toolbar" style="margin-top: 12px;">
        <button data-auth-submit>${state.authMode === "register" ? "Create Account" : "Log In"}</button>
        <button data-auth-toggle>${state.authMode === "register" ? "I already have an account" : "Create a new account"}</button>
      </div>
    `;
    panel.querySelectorAll("[data-auth]").forEach((input) => {
      input.addEventListener("input", () => {
        state.authForm[input.getAttribute("data-auth")] = input.value;
      });
    });
    panel.querySelector("[data-auth-submit]").addEventListener("click", submitAuth);
    panel.querySelector("[data-auth-toggle]").addEventListener("click", () => {
      state.authMode = state.authMode === "register" ? "login" : "register";
      renderAuth();
    });
    page.appendChild(panel);
    if (state.message) {
      page.appendChild(el("section", `section toast-message ${state.messageFading ? "fading" : ""}`, `<strong>${escapeHtml(state.message)}</strong>`));
      scheduleMessageDismiss();
    }
    app.appendChild(page);
  }

  async function submitAuth() {
    try {
      const endpoint = state.authMode === "register" ? "/auth/register" : "/auth/login";
      const payload = {
        email: state.authForm.email,
        password: state.authForm.password
      };
      if (state.authMode === "register") payload.username = state.authForm.username;
      const account = await api(endpoint, { method: "POST", body: payload });
      state.token = account.token;
      localStorage.setItem("bababooey_token", account.token);
      await refreshAccountData();
      connectOnlineSocket();
      await startMatch({ navigate: false });
      state.view = "home";
      autoFillLoadout();
      render();
    } catch (error) {
      setMessage(error.message);
      renderAuth();
    }
  }

  function renderQuests() {
    const page = el("div", "grid");
    page.appendChild(titleBar("Quests"));
    const list = el("div", "grid two");
    state.quests.forEach((quest) => {
      const complete = quest.progress >= quest.targetValue;
      const panel = el("section", `section ${complete ? "winner" : ""}`);
      panel.appendChild(el("h2", "", escapeHtml(quest.name)));
      panel.appendChild(el("div", "pill-row", `<span class="pill">${escapeHtml(quest.period)}</span><span class="pill">${quest.progress}/${quest.targetValue}</span><span class="pill">${quest.rewardCoins} coins</span>`));
      panel.appendChild(iconButton("$", quest.claimedAt ? "Claimed" : "Claim", !complete || quest.claimedAt, () => claimQuest(quest.id)));
      list.appendChild(panel);
    });
    page.appendChild(list);
    shell(page);
  }

  function renderOnline() {
    const page = el("div", "grid");
    page.appendChild(titleBar("Online Play", [
      iconButton("R", "Refresh", false, () => refreshOnlineData().then(render)),
      iconButton("W", "Connect", state.connectionStatus === "connected", () => {
        connectOnlineSocket();
        render();
      })
    ]));

    page.appendChild(el("section", `section ${state.connectionStatus === "connected" ? "winner" : ""}`, `
      <div class="pill-row">
        <span class="pill">Socket ${escapeHtml(state.connectionStatus)}</span>
        <span class="pill">${state.challenges.filter((challenge) => challenge.status === "pending").length} pending challenges</span>
        <span class="pill">${state.onlineMatches.length} online matches</span>
        <span class="pill">Rank ${escapeHtml(state.rankedProfile?.tier || "Silver")} ${state.rankedProfile?.rating ?? 1000}</span>
      </div>
    `));
    page.appendChild(el("section", "section onboarding-panel", `
      <h2>Friend Testing Flow</h2>
      <div class="onboarding-steps">
        <div><strong>Use your friend code</strong><span class="small">Share ${escapeHtml(state.profile?.friendCode || "your code")} with a friend, then accept the request.</span></div>
        <div><strong>Add friends</strong><span class="small">Search by username or friend code. Your username is @${escapeHtml(state.profile?.username || state.profile?.displayName || "you")}.</span></div>
        <div><strong>Challenge or queue</strong><span class="small">Starter Decks are active by default, so new players can play immediately.</span></div>
        <div><strong>Report issues</strong><span class="small">Use Report Bug during or after a match so the debug panel captures the match context.</span></div>
      </div>
    `));

    const matchmaking = el("section", "section matchmaking-panel");
    const queue = state.queueStatus || { status: "idle" };
    matchmaking.innerHTML = `
      <h2>Matchmaking</h2>
      <div class="queue-grid">
        <div class="queue-card">
          <h3>Casual Queue</h3>
          <p>Unranked public match. Win 50 coins, loss 10 coins.</p>
        </div>
        <div class="queue-card ranked">
          <h3>Ranked Queue</h3>
          <p>${escapeHtml(state.rankedProfile?.tier || "Silver")} rating ${state.rankedProfile?.rating ?? 1000}. Win +25, loss -15.</p>
        </div>
      </div>
      <div class="pill-row queue-status">
        <span class="pill">Status ${escapeHtml(queue.status || "idle")}</span>
        ${queue.mode ? `<span class="pill">${escapeHtml(queue.mode)}</span>` : ""}
        ${queue.joinedAt ? `<span class="pill">Searching since ${escapeHtml(new Date(queue.joinedAt).toLocaleTimeString())}</span>` : ""}
        ${queue.matchId ? `<span class="pill">Match found</span>` : ""}
      </div>
    `;
    const queueActions = el("div", "toolbar");
    queueActions.appendChild(iconButton("C", "Casual", queue.status === "searching", () => joinQueue("casual")));
    queueActions.appendChild(iconButton("R", "Ranked", queue.status === "searching", () => joinQueue("ranked")));
    queueActions.appendChild(iconButton("X", "Cancel Search", queue.status !== "searching", () => cancelQueue()));
    if (queue.matchId) {
      const match = state.onlineMatches.find((item) => item.id === queue.matchId);
      queueActions.appendChild(iconButton("P", "Open Match", !match, () => openOnlineMatch(match)));
    }
    matchmaking.appendChild(queueActions);
    page.appendChild(matchmaking);

    const pending = el("section", "section");
    pending.appendChild(el("h2", "", "Pending Challenges"));
    const pendingList = el("div", "selected-list");
    const pendingChallenges = state.challenges.filter((challenge) => challenge.status === "pending");
    if (!pendingChallenges.length) pendingList.appendChild(el("div", "empty", "No pending challenges."));
    pendingChallenges.forEach((challenge) => {
      const incoming = challenge.challenged.userId === state.profile?.userId;
      const row = el("div", "selected-row", `<strong>${incoming ? "From" : "To"} ${escapeHtml(incoming ? challenge.challenger.displayName : challenge.challenged.displayName)}</strong><span class="pill">${challenge.status}</span>`);
      if (incoming) {
        row.appendChild(iconButton("A", "Accept", false, () => acceptChallenge(challenge.id)));
        row.appendChild(iconButton("D", "Decline", false, () => declineChallenge(challenge.id)));
      }
      pendingList.appendChild(row);
    });
    pending.appendChild(pendingList);

    const friends = el("section", "section");
    friends.appendChild(el("h2", "", "Friends"));
    const addFriendRow = el("div", "toolbar");
    const friendInput = el("input", "", "");
    friendInput.placeholder = "Username or friend code";
    friendInput.value = state.friendIdentifier;
    friendInput.addEventListener("input", () => {
      state.friendIdentifier = friendInput.value;
    });
    friendInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") addFriend();
    });
    addFriendRow.appendChild(friendInput);
    addFriendRow.appendChild(iconButton("+", "Add Friend", false, addFriend));
    friends.appendChild(addFriendRow);
    const friendRows = el("div", "selected-list");
    const acceptedFriends = state.friends.filter((friendship) => friendship.status === "accepted");
    if (!acceptedFriends.length) friendRows.appendChild(el("div", "empty", "No accepted friends yet."));
    acceptedFriends.forEach((friendship) => {
      const friend = friendship.requester.userId === state.profile?.userId ? friendship.addressee : friendship.requester;
      const row = el("div", "selected-row", `<strong>@${escapeHtml(friend.username || friend.displayName)}</strong><span class="small">${escapeHtml(friend.friendCode)}</span>`);
      row.appendChild(iconButton("C", "Challenge", false, () => sendChallenge(friend.userId)));
      friendRows.appendChild(row);
    });
    friends.appendChild(friendRows);

    const matches = el("section", "section");
    matches.appendChild(el("h2", "", "Online Matches"));
    const matchRows = el("div", "selected-list");
    if (!state.onlineMatches.length) matchRows.appendChild(el("div", "empty", "No online matches."));
    state.onlineMatches.forEach((match) => {
      const opponent = match.players.find((player) => player.userId !== state.profile?.userId);
      const row = el("div", "selected-row", `<strong>${escapeHtml(opponent?.displayName || "Opponent")}</strong><span class="pill">${escapeHtml(match.mode || "friend")}</span><span class="pill">${escapeHtml(match.status)}</span>`);
      row.appendChild(iconButton("P", match.status === "finished" ? "Review" : "Play", false, () => openOnlineMatch(match)));
      matchRows.appendChild(row);
    });
    matches.appendChild(matchRows);

    const boards = el("div", "grid two");
    const rankedBoard = el("section", "section leaderboard");
    rankedBoard.appendChild(el("h2", "", "Ranked Leaders"));
    const rankedRows = el("div", "selected-list");
    (state.leaderboards.ranked || []).slice(0, 8).forEach((entry, index) => {
      rankedRows.appendChild(el("div", "selected-row", `<strong>#${index + 1} ${escapeHtml(entry.displayName)}</strong><span class="pill">${escapeHtml(entry.tier)}</span><span class="pill">${entry.rating}</span>`));
    });
    if (!rankedRows.children.length) rankedRows.appendChild(el("div", "empty", "No ranked games yet."));
    rankedBoard.appendChild(rankedRows);
    const casualBoard = el("section", "section leaderboard");
    casualBoard.appendChild(el("h2", "", "Casual Wins"));
    const casualRows = el("div", "selected-list");
    (state.leaderboards.casual || []).slice(0, 8).forEach((entry, index) => {
      casualRows.appendChild(el("div", "selected-row", `<strong>#${index + 1} ${escapeHtml(entry.displayName)}</strong><span class="pill">${entry.wins} wins</span>`));
    });
    if (!casualRows.children.length) casualRows.appendChild(el("div", "empty", "No casual wins yet."));
    casualBoard.appendChild(casualRows);
    boards.append(rankedBoard, casualBoard);

    page.appendChild(el("div", "grid two"));
    page.lastChild.append(pending, friends);
    page.appendChild(matches);
    page.appendChild(boards);
    shell(page);
  }

  function joinQueue(mode) {
    api(`/queue/${mode}/join`, { method: "POST" })
      .then((response) => {
        state.queueStatus = response.queue;
        if (response.match) openOnlineMatch(response.match);
        return refreshOnlineData();
      })
      .then(render)
      .catch((error) => setMessage(error.message));
  }

  function cancelQueue() {
    api("/queue/cancel", { method: "POST" })
      .then((queue) => {
        state.queueStatus = queue;
        return refreshOnlineData();
      })
      .then(render)
      .catch((error) => setMessage(error.message));
  }

  function addFriend() {
    const identifier = state.friendIdentifier.trim();
    if (!identifier) {
      setMessage("Enter a username or friend code.");
      return;
    }
    api("/friends", { method: "POST", body: { identifier } })
      .then(() => {
        state.friendIdentifier = "";
        return refreshOnlineData();
      })
      .then(render)
      .catch((error) => setMessage(error.message));
  }

  function sendChallenge(challengedId) {
    api("/friend-challenges", { method: "POST", body: { challengedId } })
      .then(refreshOnlineData)
      .then(render)
      .catch((error) => setMessage(error.message));
  }

  function acceptChallenge(id) {
    api(`/friend-challenges/${id}/accept`, { method: "POST" })
      .then((match) => {
        openOnlineMatch(match);
        return refreshOnlineData();
      })
      .then(render)
      .catch((error) => setMessage(error.message));
  }

  function declineChallenge(id) {
    api(`/friend-challenges/${id}/decline`, { method: "POST" })
      .then(refreshOnlineData)
      .then(render)
      .catch((error) => setMessage(error.message));
  }

  function openOnlineMatch(match) {
    state.onlineMatch = match;
    state.match = match.state;
    state.battleMode = "online";
    state.battlePhase = match.status === "active" ? "playing" : "ended";
    state.view = "battle";
    state.selected = null;
    localStorage.setItem("bababooey_online_match_id", match.id);
    connectOnlineSocket();
    if (state.socket?.readyState === WebSocket.OPEN) {
      state.socket.send(JSON.stringify({ type: "subscribe_match", matchId: match.id }));
    }
    render();
  }

  function claimQuest(id) {
    api(`/quests/${id}/claim`, { method: "POST" })
      .then(refreshAccountData)
      .then(render)
      .catch((error) => setMessage(error.message));
  }

  function miniCardForRoster(entry, player) {
    const item = card(entry.cardId);
    const cooldown = entry.zone === "cooldown" || player.spellCooldowns[entry.cardId];
    const spellCooldown = player.spellCooldowns[entry.cardId];
    const disabled = state.match.status !== "active" || player.id !== state.match.activePlayerId || cooldown || player.currentMana < item.manaCost;
    const selected = state.selected?.kind === "spell" && state.selected.cardId === item.id;
    const reason = cooldown ? "Cooling down" : player.currentMana < item.manaCost ? "Need mana" : entry.zone !== "ready" ? entry.zone : "";
    const node = el("div", `mini-card ${item.rarity || "common"} ${disabled ? "disabled" : ""} ${selected ? "selected" : ""}`);
    node.innerHTML = `
      <div class="rarity-frame"></div>
      <div class="mana">${item.manaCost}</div>
      <strong>${escapeHtml(item.name)}</strong>
      <div class="label"><span class="type-icon">${typeIcon(item.type)}</span> ${escapeHtml(item.type)} / ${escapeHtml(item.faction || "neutral")}</div>
      <div class="stats">${item.attack !== undefined ? `<span class="stat">A ${item.attack}</span>` : ""}${item.defense !== undefined ? `<span class="stat">D ${item.defense}</span>` : ""}${item.hp !== undefined ? `<span class="stat">H ${item.hp}</span>` : ""}</div>
      ${disabled && reason ? `<div class="disabled-reason">${escapeHtml(reason)}</div>` : ""}
    `;
    if (cooldown) node.appendChild(el("div", "cooldown-badge", `CD ${entry.cooldownRemaining || spellCooldown}`));
    node.addEventListener("mouseenter", () => {
      state.detailCard = item;
      renderDetailOnly();
    });
    node.addEventListener("mouseleave", () => {
      if (state.detailCard?.id === item.id) {
        state.detailCard = null;
        renderDetailOnly();
      }
    });
    node.addEventListener("dblclick", () => {
      state.detailCard = item;
      render();
    });
    node.addEventListener("click", () => {
      if (disabled) return;
      if (item.type === "troop") return sendBattleCommand({ type: "playTroop", playerId: player.id, cardId: item.id });
      if (item.type === "enchantment") return sendBattleCommand({ type: "playEnchantment", playerId: player.id, cardId: item.id });
      if (item.type === "spell") {
        if (item.id !== "spell_disenchant") return sendBattleCommand({ type: "castSpell", playerId: player.id, cardId: item.id });
        state.selected = { kind: "spell", playerId: player.id, cardId: item.id };
        render();
      }
    });
    return node;
  }

  function renderUnit(unit, owner, type) {
    const item = card(unit.cardId);
    const isSelected = state.selected?.instanceId === unit.instanceId;
    const isAttacker = state.feedback?.attackerInstanceId === unit.instanceId;
    const isDamaged = state.feedback?.target?.instanceId === unit.instanceId || state.feedback?.deathInstanceId === unit.instanceId || state.feedback?.breakInstanceId === unit.instanceId;
    const node = el("div", `unit ${item.rarity || "common"} ${isSelected ? "selected" : ""} ${isAttacker ? "attack-lunge" : ""} ${isDamaged ? "damage" : ""} ${state.feedback?.deathInstanceId === unit.instanceId ? "death" : ""} ${state.feedback?.breakInstanceId === unit.instanceId ? "break" : ""}`);
    node.innerHTML = `
      <div class="rarity-frame"></div>
      <strong>${escapeHtml(item.name)}</strong>
      <div class="label"><span class="type-icon">${typeIcon(type)}</span> ${type}</div>
      <div class="stats">${item.attack !== undefined ? `<span class="stat">A ${item.attack}</span>` : ""}${unit.currentDefense !== undefined ? `<span class="stat">D ${unit.currentDefense}</span>` : ""}<span class="stat">HP ${unit.hp}</span></div>
      ${isDamaged && state.feedback?.damage ? `<div class="damage-number">-${state.feedback.damage}</div>` : ""}
    `;
    const active = activePlayer();
    const enemy = owner.id !== active?.id;
    if (type === "troop" && owner.id === active?.id && unit.canAttack && state.match.status === "active") {
      node.classList.add("can-act");
      node.addEventListener("click", () => {
        state.selected = { kind: "attacker", playerId: owner.id, instanceId: unit.instanceId };
        render();
      });
    } else if (enemy && state.selected?.kind === "attacker") {
      node.classList.add("targetable");
      node.setAttribute("title", "Valid attack target");
      node.addEventListener("click", () => sendBattleCommand({
        type: "attack",
        playerId: state.selected.playerId,
        attackerInstanceId: state.selected.instanceId,
        target: { type, instanceId: unit.instanceId }
      }));
    } else if (enemy && state.selected?.kind === "spell" && state.selected.cardId === "spell_disenchant" && type === "enchantment") {
      node.classList.add("targetable");
      node.setAttribute("title", "Valid spell target");
      node.addEventListener("click", () => sendBattleCommand({
        type: "castSpell",
        playerId: state.selected.playerId,
        cardId: state.selected.cardId,
        target: { type: "enchantment", instanceId: unit.instanceId }
      }));
    }
    node.addEventListener("mouseenter", () => {
      state.detailCard = item;
      renderDetailOnly();
    });
    node.addEventListener("mouseleave", () => {
      if (state.detailCard?.id === item.id) {
        state.detailCard = null;
        renderDetailOnly();
      }
    });
    return node;
  }

  function playerZone(player, top) {
    const active = state.match.activePlayerId === player.id;
    const zone = el("div", "player-zone");
    const coreHit = state.feedback?.target?.type === "core" && state.feedback.target.playerId === player.id;
    const core = el("div", `core ${active ? "active" : ""} ${coreHit ? "damage core-hit" : ""}`);
    const maxCoreHp = card(player.coreCardId)?.hp || 20;
    const manaCap = player.manaBankCap || player.baseMaxMana || 20;
    core.innerHTML = `<strong>${playerName(player.id)} Core</strong><div class="core-orb">CORE</div><div class="hp"><span style="width:${Math.max(0, Math.min(100, (player.coreHp / maxCoreHp) * 100))}%"></span></div><div>${player.coreHp} / ${maxCoreHp} HP</div><div class="small">Bank ${player.currentMana}/${manaCap}${player.temporaryMana ? ` (+${player.temporaryMana} temp)` : ""}</div>${coreHit && state.feedback?.damage ? `<div class="damage-number core-damage">-${state.feedback.damage}</div>` : ""}`;
    if (player.id !== activePlayer()?.id && state.selected?.kind === "attacker" && player.troops.length === 0) {
      core.classList.add("targetable");
      core.setAttribute("title", "Valid core target");
      core.addEventListener("click", () => sendBattleCommand({
        type: "attack",
        playerId: state.selected.playerId,
        attackerInstanceId: state.selected.instanceId,
        target: { type: "core", playerId: player.id }
      }));
    }
    const lane = el("div", "lane");
    const enchantments = el("div", "slot-row");
    player.enchantments.forEach((item) => enchantments.appendChild(renderUnit(item, player, "enchantment")));
    if (!player.enchantments.length) enchantments.appendChild(el("div", "empty", "No enchantments"));
    const troops = el("div", "slot-row");
    player.troops.forEach((item) => troops.appendChild(renderUnit(item, player, "troop")));
    if (!player.troops.length) troops.appendChild(el("div", "empty", "No troops"));
    if (top) lane.append(enchantments, troops);
    else lane.append(troops, enchantments);
    const info = el("div", "section");
    info.innerHTML = `<h3>Status</h3><div class="pill-row"><span class="pill">${active ? "Active" : "Waiting"}</span><span class="pill">Troops ${player.troops.length}</span><span class="pill">Enchant ${player.enchantments.length}/3</span>${player.coinAvailable ? `<span class="pill">Coin ready</span>` : ""}</div>`;
    zone.append(core, lane, info);
    return zone;
  }

  function loadoutPreview(player) {
    const counts = {};
    player.roster.forEach((entry) => {
      counts[entry.cardId] = (counts[entry.cardId] || 0) + 1;
    });
    const preview = el("div", "loadout-preview");
    Object.entries(counts)
      .sort(([a], [b]) => rarityRank(card(b)?.rarity) - rarityRank(card(a)?.rarity))
      .slice(0, 8)
      .forEach(([cardId, count]) => {
        const item = card(cardId);
        preview.appendChild(el("div", `preview-card ${item?.rarity || "common"}`, `<span class="type-icon">${typeIcon(item?.type)}</span><strong>${escapeHtml(item?.name || cardId)}</strong><span>x${count}</span>`));
      });
    return preview;
  }

  function renderMatchStartScreen() {
    const section = el("section", "match-stage");
    const p1 = state.match.players[0];
    const p2 = state.match.players[1];
    section.innerHTML = `
      <div class="versus-title">
        <h2>Local Match Ready</h2>
        <p>Two players. Two 20 HP Cores. Clear troops first, then crack the Core.</p>
      </div>
      <div class="versus-grid">
        <div class="versus-player"><h3>Player 1</h3><div class="core-orb">20</div><div class="pill-row"><span class="pill">Starts first</span><span class="pill">${p1.roster.length} cards</span></div></div>
        <div class="versus-mark">VS</div>
        <div class="versus-player"><h3>Player 2</h3><div class="core-orb">20</div><div class="pill-row"><span class="pill">Coin spell</span><span class="pill">${p2.roster.length} cards</span></div></div>
      </div>
    `;
    const previews = el("div", "grid two");
    const left = el("section", "section");
    left.appendChild(el("h3", "", "Player 1 Loadout"));
    left.appendChild(loadoutPreview(p1));
    const right = el("section", "section");
    right.appendChild(el("h3", "", "Player 2 Loadout"));
    right.appendChild(loadoutPreview(p2));
    previews.append(left, right);
    section.appendChild(previews);
    section.appendChild(iconButton("S", "Start Battle", false, () => {
      state.battlePhase = "playing";
      state.feedback = null;
      render();
    }));
    return section;
  }

  function renderMatchEndScreen() {
    const winner = playerName(state.match.winnerId);
    const mode = state.onlineMatch?.mode || state.battleMode;
    const rewardText = mode === "casual"
      ? "Casual rewards: winner 50 coins, loser 10 coins."
      : mode === "ranked"
        ? "Ranked rewards: winner 100 coins, loser 25 coins, with rating updated."
        : "Rewards preview: winner 100 coins, loser 25 coins.";
    const summary = state.match.eventLog.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {});
    const panel = el("section", "match-stage winner-stage");
    panel.innerHTML = `
      <div class="versus-title">
        <h2>${escapeHtml(winner)} Wins</h2>
        <p>${escapeHtml(rewardText)}</p>
      </div>
      <div class="grid three">
        <div class="section"><h3>Turns</h3><div class="big-number">${state.match.turnNumber}</div></div>
        <div class="section"><h3>Actions</h3><div class="big-number">${state.match.eventLog.length}</div></div>
        <div class="section"><h3>Core Finish</h3><div class="big-number">${Math.max(0, state.match.players.find((p) => p.id !== state.match.winnerId)?.coreHp || 0)}</div></div>
      </div>
    `;
    const events = el("div", "event-summary");
    Object.entries(summary).forEach(([type, count]) => {
      events.appendChild(el("span", "pill", `${type.replaceAll("_", " ")}: ${count}`));
    });
    panel.appendChild(events);
    panel.appendChild(iconButton("!", "Report Bug", false, reportMatchBug));
    panel.appendChild(iconButton("N", "New Match", false, () => startMatch({ navigate: true })));
    return panel;
  }

  function renderBattle() {
    const page = el("div", "battle");
    page.appendChild(titleBar(state.battleMode === "online" ? "Online Battle" : "Local Battle", [
      iconButton("N", state.battleMode === "online" ? "Leave Online" : "New Match", false, () => {
        if (state.battleMode === "online") {
          state.battleMode = "local";
          state.onlineMatch = null;
          localStorage.removeItem("bababooey_online_match_id");
          startMatch({ navigate: true });
        } else {
          startMatch();
        }
      }),
      iconButton("!", "Report Bug", !state.match, reportMatchBug),
      iconButton("F", "Forfeit", !canForfeit(), forfeitMatch),
      iconButton("E", "End Turn", !canEndTurn(), endActiveTurn)
    ]));
    if (!state.match) {
      page.appendChild(el("section", "hero", `<h1>Local Match</h1><p>Create a local two-player match powered by the Phase 2 deterministic battle engine.</p>`));
      shell(page);
      return;
    }
    if (state.battlePhase === "start") {
      page.appendChild(renderMatchStartScreen());
      shell(page);
      return;
    }
    if (state.match.status === "finished") {
      page.appendChild(renderMatchEndScreen());
      shell(page);
      return;
    }
    const active = activePlayer();
    const bottomPlayer = viewerPlayer();
    const topPlayer = viewerOpponent();
    const activeManaCap = active.manaBankCap || active.baseMaxMana || 20;
    const summary = el("section", `section battle-summary ${state.match.status === "finished" ? "winner" : ""}`, `<div class="pill-row"><span class="pill">${state.battleMode === "online" ? `Online ${escapeHtml(state.onlineMatch?.mode || "friend")} match` : "Local battle"}</span><span class="pill">Connection ${escapeHtml(state.battleMode === "online" ? state.connectionStatus : "local")}</span>${state.opponentDisconnected ? `<span class="pill">Opponent disconnected</span>` : ""}<span class="pill">Turn ${state.match.turnNumber}</span><span class="pill">Active ${playerName(active.id)}</span><span class="pill">Bank ${active.currentMana}/${activeManaCap}</span><span class="pill">${state.match.status}</span>${state.match.winnerId ? `<span class="pill">Winner ${playerName(state.match.winnerId)}</span>` : ""}</div>${state.connectionStatus === "reconnecting" && state.battleMode === "online" ? `<div class="feedback-banner">Reconnecting to online match...</div>` : ""}${state.feedback ? `<div class="feedback-banner">${escapeHtml(state.feedback.text)}</div>` : ""}`);
    page.appendChild(summary);
    const arena = el("section", "arena");
    arena.appendChild(playerZone(topPlayer, true));
    arena.appendChild(el("div", `targeting-guide ${state.selected ? "active" : ""}`, state.selected ? selectedText() : "Select a ready troop to attack, or play a card from the roster."));
    arena.appendChild(playerZone(bottomPlayer, false));
    page.appendChild(arena);
    page.appendChild(renderBattleActionBar(active));

    const controls = el("div", "controls");
    const rosterPanel = el("section", "section roster");
    const rosterPlayer = state.battleMode === "online" ? bottomPlayer : active;
    rosterPanel.appendChild(el("h2", "", `${playerName(rosterPlayer.id)} Available Roster`));
    const roster = el("div", "roster-list");
    rosterPlayer.roster.forEach((entry) => roster.appendChild(miniCardForRoster(entry, rosterPlayer)));
    if (rosterPlayer.coinAvailable) {
      const coin = el("div", "mini-card");
      coin.innerHTML = `<div class="mana">0</div><strong>Coin</strong><div class="label">spell</div><div class="small">+1 temporary mana</div>`;
      if (rosterPlayer.id !== state.match.activePlayerId || state.match.status !== "active") coin.classList.add("disabled");
      coin.addEventListener("click", () => {
        if (rosterPlayer.id !== state.match.activePlayerId || state.match.status !== "active") return;
        sendBattleCommand({ type: "castSpell", playerId: rosterPlayer.id, cardId: "spell_coin" });
      });
      roster.prepend(coin);
    }
    rosterPanel.appendChild(roster);
    const logPanel = el("section", "section");
    logPanel.appendChild(el("h2", "", "Event Log"));
    const log = el("div", "event-log");
    state.match.eventLog.forEach((event) => log.appendChild(el("div", "event", `#${event.sequence} ${escapeHtml(event.type)} ${escapeHtml(event.playerId || "")}`)));
    logPanel.appendChild(log);
    controls.append(rosterPanel, logPanel);
    page.appendChild(controls);
    shell(page);
  }

  function canEndTurn() {
    if (!state.match || state.match.status !== "active" || state.battlePhase !== "playing") return false;
    if (state.battleMode !== "online") return true;
    return state.match.activePlayerId === state.profile?.userId;
  }

  function canForfeit() {
    return state.battleMode === "online" && state.onlineMatch?.id && state.match?.status === "active";
  }

  function endActiveTurn() {
    if (!canEndTurn()) return;
    sendBattleCommand({ type: "endTurn", playerId: state.match.activePlayerId });
  }

  function forfeitMatch() {
    if (!canForfeit()) return;
    if (!confirm("Forfeit this match? This gives your opponent the win.")) return;
    sendBattleCommand({ type: "forfeit", playerId: state.profile.userId });
  }

  function renderBattleActionBar(active) {
    const bar = el("section", "battle-action-bar");
    const hint = state.battleMode === "online" && !canEndTurn()
      ? "Waiting for opponent."
      : "Press E to end turn.";
    bar.appendChild(el("div", "battle-action-copy", `<strong>${escapeHtml(playerName(active.id))}'s turn</strong><span class="small">${escapeHtml(hint)}</span>`));
    if (canForfeit()) bar.appendChild(iconButton("F", "Forfeit", false, forfeitMatch));
    bar.appendChild(iconButton("E", "End Turn", !canEndTurn(), endActiveTurn));
    return bar;
  }

  function selectedText() {
    if (state.selected.kind === "attacker") return "Choose an enemy troop or enchantment. Core opens when enemy troops are gone.";
    if (state.selected.kind === "spell" && state.selected.cardId === "spell_disenchant") return "Disenchant selected: choose a glowing enemy enchantment.";
    if (state.selected.kind === "spell") return "Spell selected: choose a highlighted valid target.";
    return "";
  }

  function sendBattleCommand(command) {
    if (state.selected?.kind === "spell" && command.type !== "castSpell") state.selected = null;
    if (state.battleMode === "online" && state.onlineMatch?.id) {
      const intent = { ...command };
      delete intent.playerId;
      if (state.socket?.readyState === WebSocket.OPEN) {
        state.socket.send(JSON.stringify({ type: "command", matchId: state.onlineMatch.id, command: intent }));
        return;
      }
      api(`/online-matches/${state.onlineMatch.id}/commands`, { method: "POST", body: intent })
        .then(({ match }) => {
          const previous = state.match;
          state.onlineMatch = match;
          state.match = match.state;
          state.feedback = buildFeedback(previous, match.state, command);
          if (match.status === "finished") state.battlePhase = "ended";
          state.selected = null;
          state.message = "";
          render();
        })
        .catch((error) => setMessage(error.message));
      return;
    }
    api(`/local-matches/${state.match.id}/commands`, { method: "POST", body: command })
      .then(({ state: next }) => {
        const previous = state.match;
        state.match = next;
        state.feedback = buildFeedback(previous, next, command);
        if (next.status === "finished") state.battlePhase = "ended";
        state.selected = null;
        state.message = "";
        render();
      })
      .catch((error) => setMessage(error.message));
  }

  function startMatch(options = {}) {
    const navigate = options.navigate !== false;
    return api("/local-matches", { method: "POST" })
      .then((match) => {
        state.match = match;
        state.battleMode = "local";
        state.onlineMatch = null;
        state.battlePhase = "start";
        state.feedback = null;
        state.selected = null;
        if (navigate) state.view = "battle";
        render();
      })
      .catch((error) => setMessage(error.message));
  }

  function render() {
    if (state.view === "home") return renderHome();
    if (state.view === "collection") return renderCollection();
    if (state.view === "loadout") return renderLoadout();
    if (state.view === "packs") return renderPacks();
    if (state.view === "quests") return renderQuests();
    if (state.view === "online") return renderOnline();
    if (state.view === "battle") return renderBattle();
  }

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() !== "e" || event.repeat) return;
    const target = event.target;
    if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
    if (state.view !== "battle" || state.tutorialOpen || state.settingsOpen || state.detailCard) return;
    if (!canEndTurn()) return;
    event.preventDefault();
    endActiveTurn();
  });

  async function refreshAccountData() {
    const [profile, cards, collection, quests, packs, loadouts] = await Promise.all([
      api("/me"),
      api("/cards"),
      api("/collection"),
      api("/quests"),
      api("/shop/packs"),
      api("/loadouts")
    ]);
    state.profile = profile;
    state.settings.font = normalizeFont(profile.settings?.font || state.settings.font);
    applyFontPreference(state.settings.font);
    state.cards = cards;
    state.collection = collection;
    state.quests = quests;
    state.packs = packs;
    state.loadouts = loadouts;
    await refreshOnlineData();
  }

  async function boot() {
    try {
      applyFontPreference(state.settings.font);
      const savedToken = localStorage.getItem("bababooey_token");
      if (savedToken) {
        state.token = savedToken;
        try {
          await refreshAccountData();
        } catch {
          state.token = null;
          localStorage.removeItem("bababooey_token");
        }
      }
      if (!state.token) return renderAuth();
      connectOnlineSocket();
      const savedMatchId = localStorage.getItem("bababooey_online_match_id");
      if (savedMatchId) {
        try {
          const match = await api(`/online-matches/${savedMatchId}`);
          if (match.status === "active") {
            openOnlineMatch(match);
            return;
          }
          localStorage.removeItem("bababooey_online_match_id");
        } catch {
          localStorage.removeItem("bababooey_online_match_id");
        }
      }
      await startMatch({ navigate: false });
      state.view = "home";
      autoFillLoadout();
    } catch (error) {
      app.innerHTML = `<div class="section"><strong>${escapeHtml(error.message)}</strong></div>`;
    }
  }

  boot();
}());
