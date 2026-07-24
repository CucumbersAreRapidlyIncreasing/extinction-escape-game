(() => {
  "use strict";

  const STORAGE_KEY = "extinctionEscape.progress.v1";
  const WINDOW_PREFIX = "EXTINCTION_ESCAPE_STATE:";
  const currentScreen = Math.max(1, Number(document.body.dataset.gameScreen) || 1);
  const screens = [
    { id: 1, label: "プロローグ", href: "index.html" },
    { id: 2, label: "オープニング", href: "screen2.html" },
    { id: 3, label: "ファイルの謎", href: "screen3.html" },
    { id: 4, label: "電源復旧", href: "screen4.html" },
    { id: 5, label: "エンジン起動", href: "screen5.html" },
    { id: 6, label: "タイムマシンテスト", href: "screen6.html" },
    { id: 7, label: "帰還準備", href: "screen7.html" },
    { id: 8, label: "地球脱出", href: "screen8.html" },
  ];
  const collisionMinutesByProgress = { 3: 50, 4: 40, 5: 30, 6: 20, 7: 10, 8: 10 };

  function normalize(candidate = {}) {
    const step = candidate.screen3 || {};
    return {
      version: 1,
      resetAt: Number(candidate.resetAt) || 0,
      maxScreen: Math.max(1, Math.min(screens.length, Number(candidate.maxScreen) || 1)),
      lastScreen: Math.max(1, Math.min(screens.length, Number(candidate.lastScreen) || 1)),
      updatedAt: Number(candidate.updatedAt) || 0,
      screen3: {
        envelopeReceived: Boolean(step.envelopeReceived),
        envelopeUnlocked: Boolean(step.envelopeUnlocked),
        solvedPuzzles: Array.isArray(step.solvedPuzzles)
          ? [...new Set(step.solvedPuzzles.filter(value => ["A", "B", "C", "D", "E", "F", "G"].includes(value)))]
          : [],
        dials: Array.isArray(step.dials) && step.dials.length === 4
          ? step.dials.map(value => Math.max(1, Math.min(9, Number(value) || 1)))
          : [1, 1, 1, 1],
      },
      screen4: {
        powerRestored: Boolean(candidate.screen4?.powerRestored),
        dials: Array.isArray(candidate.screen4?.dials) && candidate.screen4.dials.length === 5
          ? candidate.screen4.dials.map(value => Math.max(1, Math.min(6, Number(value) || 1)))
          : [1, 1, 1, 1, 1],
      },
      screen5: {
        engineStarted: Boolean(candidate.screen5?.engineStarted),
      },
      screen6: {
        timeMachineTested: Boolean(candidate.screen6?.timeMachineTested),
        cipherTableReceived: Boolean(candidate.screen6?.cipherTableReceived),
      },
      screen7: {
        palmScanCompleted: Boolean(candidate.screen7?.palmScanCompleted),
      },
      screen8: {
        timeMachinePrepared: Boolean(candidate.screen8?.timeMachinePrepared),
        engineStarted: Boolean(candidate.screen8?.engineStarted),
        ending: ["true", "bad"].includes(candidate.screen8?.ending) ? candidate.screen8.ending : "",
      },
    };
  }

  function parse(value) {
    if (!value) return null;
    try { return normalize(JSON.parse(value)); } catch { return null; }
  }

  function readTransfer() {
    if (location.protocol !== "file:") return null;
    const encoded = new URLSearchParams(location.search).get("gp");
    if (!encoded) return null;
    try {
      let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) base64 += "=";
      return normalize(JSON.parse(atob(base64)));
    } catch { return null; }
  }

  function readLocal() {
    try { return parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
  }

  function readWindowName() {
    if (!window.name.startsWith(WINDOW_PREFIX)) return null;
    try { return normalize(JSON.parse(decodeURIComponent(window.name.slice(WINDOW_PREFIX.length)))); } catch { return null; }
  }

  function advancement(state) {
    if (state.screen8.engineStarted) return 7;
    if (state.screen7.palmScanCompleted) return 6;
    if (state.screen6.timeMachineTested) return 5;
    if (state.screen5.engineStarted) return 4;
    if (state.screen4.powerRestored) return 3;
    if (state.screen3.envelopeUnlocked) return 2;
    if (state.screen3.envelopeReceived) return 1;
    return 0;
  }

  function readState() {
    const candidates = [readLocal(), readWindowName(), readTransfer()].filter(Boolean);
    if (!candidates.length) return normalize();
    const latestReset = Math.max(...candidates.map(item => item.resetAt));
    const validCandidates = candidates.filter(item => item.updatedAt >= latestReset);
    const newest = [...validCandidates].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const mostAdvanced = [...validCandidates].sort((a, b) => advancement(b) - advancement(a) || b.updatedAt - a.updatedAt)[0];
    const merged = normalize(newest);
    merged.resetAt = latestReset;
    merged.maxScreen = Math.max(...validCandidates.map(item => item.maxScreen));
    merged.screen3 = mostAdvanced.screen3;
    merged.screen4 = mostAdvanced.screen4;
    merged.screen5 = mostAdvanced.screen5;
    merged.screen6 = mostAdvanced.screen6;
    merged.screen7 = mostAdvanced.screen7;
    merged.screen8 = mostAdvanced.screen8;
    return merged;
  }

  const resetRequested = new URLSearchParams(location.search).has("resetProgress");
  if (resetRequested) {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage can be unavailable */ }
    try { window.name = ""; } catch { /* optional same-tab storage */ }
  }
  let state = resetRequested ? normalize({ resetAt: Date.now() }) : readState();

  function save(nextState) {
    state = normalize(nextState);
    state.updatedAt = Date.now();
    const serialized = JSON.stringify(state);
    try { localStorage.setItem(STORAGE_KEY, serialized); } catch { /* file preview can restrict storage */ }
    try { window.name = WINDOW_PREFIX + encodeURIComponent(serialized); } catch { /* optional same-tab fallback */ }
    window.dispatchEvent(new CustomEvent("gameprogresschange", { detail: getState() }));
  }

  function getState() {
    return JSON.parse(JSON.stringify(state));
  }

  function updateScreen3(patch) {
    save({
      ...state,
      maxScreen: Math.max(state.maxScreen, 3),
      lastScreen: currentScreen,
      screen3: { ...state.screen3, ...patch },
    });
  }

  function updateScreen4(patch) {
    save({
      ...state,
      maxScreen: Math.max(state.maxScreen, 4),
      lastScreen: currentScreen,
      screen4: { ...state.screen4, ...patch },
    });
  }

  function updateScreen5(patch) {
    save({
      ...state,
      maxScreen: Math.max(state.maxScreen, 5),
      lastScreen: currentScreen,
      screen5: { ...state.screen5, ...patch },
    });
  }

  function updateScreen6(patch) {
    save({
      ...state,
      maxScreen: Math.max(state.maxScreen, 6),
      lastScreen: currentScreen,
      screen6: { ...state.screen6, ...patch },
    });
  }

  function updateScreen7(patch) {
    save({
      ...state,
      maxScreen: Math.max(state.maxScreen, 7),
      lastScreen: currentScreen,
      screen7: { ...state.screen7, ...patch },
    });
  }

  function updateScreen8(patch) {
    save({
      ...state,
      maxScreen: Math.max(state.maxScreen, 8),
      lastScreen: currentScreen,
      screen8: { ...state.screen8, ...patch },
    });
  }

  function resetProgress() {
    const resetAt = Date.now();
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage can be unavailable */ }
    try { localStorage.removeItem("extinctionEscape.annotations.v1"); } catch { /* storage can be unavailable */ }
    try { window.name = ""; } catch { /* optional same-tab storage */ }
    state = normalize({ resetAt });
    save(state);
    const prologue = new URL("index.html", location.href);
    prologue.search = "";
    prologue.hash = "";
    prologue.searchParams.set("resetProgress", String(resetAt));
    location.replace(prologue.href);
  }

  function resetFromScreen(screenId) {
    const target = Math.max(1, Math.min(screens.length, Number(screenId) || 1));
    const resetAt = Date.now();
    const baseline = normalize();
    try { localStorage.removeItem("extinctionEscape.annotations.v1"); } catch { /* storage can be unavailable */ }
    const nextState = {
      ...state,
      resetAt,
      maxScreen: target,
      lastScreen: 1,
    };
    if (target <= 3) nextState.screen3 = baseline.screen3;
    if (target <= 4) nextState.screen4 = baseline.screen4;
    if (target <= 5) nextState.screen5 = baseline.screen5;
    if (target <= 6) nextState.screen6 = baseline.screen6;
    if (target <= 7) nextState.screen7 = baseline.screen7;
    if (target <= 8) nextState.screen8 = baseline.screen8;
    save(nextState);
    location.replace(transferHref("index.html"));
  }

  state.maxScreen = Math.max(state.maxScreen, currentScreen);
  state.lastScreen = currentScreen;
  save(state);

  if (resetRequested) {
    try { history.replaceState(null, "", location.pathname + location.hash); } catch { /* file preview may restrict history */ }
  }

  window.GameProgress = { getState, updateScreen3, updateScreen4, updateScreen5, updateScreen6, updateScreen7, updateScreen8, resetProgress, resetFromScreen };

  function transferHref(rawHref) {
    if (location.protocol !== "file:" || !rawHref || rawHref.startsWith("#")) return rawHref;
    const url = new URL(rawHref, location.href);
    const filename = url.pathname.split("/").pop();
    if (!screens.some(screen => screen.href === filename) && !["control-room.html", "engine-control-room.html", "time-machine-control-room.html", "true-end.html", "bad-end.html", "hint.html"].includes(filename)) return rawHref;
    const encoded = btoa(JSON.stringify(state)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    url.searchParams.set("gp", encoded);
    return url.href;
  }

  document.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (!link) return;
    link.href = transferHref(link.getAttribute("href"));
  }, true);

  const progress = document.createElement("nav");
  progress.className = "game-progress";
  progress.setAttribute("aria-label", "到達済み画面への移動");
  progress.style.setProperty("--visible-screens", String(state.maxScreen));

  const screenLinks = screens.filter(screen => screen.id <= state.maxScreen).map(screen => {
    const current = screen.id === currentScreen ? ' aria-current="page"' : "";
    return `<a href="${screen.href}"${current}><b>${screen.id}</b><em>${screen.label}</em></a>`;
  }).join("");

  progress.innerHTML = `
    <div class="game-progress__screens">${screenLinks}</div>
    <div class="game-progress__tools">
      <div class="game-progress__menu">
        <button class="game-progress__menu-button" type="button" aria-label="メニューを開く" aria-expanded="false" aria-controls="game-progress-menu-panel"><i></i><i></i><i></i></button>
        <div class="game-progress__menu-panel" id="game-progress-menu-panel" hidden>
          <small>GAME MENU</small>
          <a class="game-progress__hint" href="hint.html?screen=${currentScreen}" target="_blank" rel="noopener"><span>ヒント</span><i aria-hidden="true">↗</i></a>
          <a class="game-progress__tutorial" href="screen3.html?tutorial=1"><span>チュートリアル</span><i aria-hidden="true">?</i></a>
          <button type="button" data-open-reset-dialog><span>最初から遊ぶ</span><i aria-hidden="true">↺</i></button>
          <button class="game-progress__debug-reset" type="button" data-open-step-reset><span>ステップ別リセット</span><i aria-hidden="true">⌁</i></button>
        </div>
      </div>
    </div>
  `;
  document.body.classList.add("has-game-progress");
  document.body.prepend(progress);

  const resetDialog = document.createElement("section");
  resetDialog.className = "game-reset-dialog";
  resetDialog.hidden = true;
  resetDialog.innerHTML = `
    <button class="game-reset-dialog__backdrop" type="button" data-cancel-reset aria-label="リセットをキャンセル"></button>
    <div class="game-reset-dialog__window" role="alertdialog" aria-modal="true" aria-labelledby="game-reset-title" aria-describedby="game-reset-description">
      <small>RESET PROGRESS</small>
      <h2 id="game-reset-title">最初から遊びますか？</h2>
      <p id="game-reset-description">これまでの進行状況と、各画面で保存された操作状態がすべてリセットされます。</p>
      <div>
        <button type="button" data-cancel-reset>キャンセル</button>
        <button class="game-reset-dialog__confirm" type="button" data-confirm-reset>リセットする</button>
      </div>
    </div>
  `;
  document.body.append(resetDialog);

  const stepResetDialog = document.createElement("section");
  stepResetDialog.className = "game-reset-dialog game-step-reset-dialog";
  stepResetDialog.hidden = true;
  const stepResetButtons = screens.filter(screen => screen.id <= state.maxScreen).map(screen => `
    <button type="button" data-reset-to-screen="${screen.id}">
      <b>${screen.id}</b><span>${screen.label}</span>${screen.id === 1 ? "<small>全消去</small>" : ""}
    </button>
  `).join("");
  stepResetDialog.innerHTML = `
    <button class="game-reset-dialog__backdrop" type="button" data-cancel-step-reset aria-label="ステップ別リセットをキャンセル"></button>
    <div class="game-reset-dialog__window game-step-reset-dialog__window" role="dialog" aria-modal="true" aria-labelledby="game-step-reset-title" aria-describedby="game-step-reset-description">
      <small>DEBUG RESET</small>
      <h2 id="game-step-reset-title">どのステップから<br>やり直しますか？</h2>
      <p id="game-step-reset-description">選択したステップと、それ以降の操作状態を削除します。それ以前のクリア状態は残り、リセット後はプロローグへ移動します。</p>
      <div class="game-step-reset-dialog__steps">${stepResetButtons}</div>
      <button class="game-step-reset-dialog__cancel" type="button" data-cancel-step-reset>キャンセル</button>
    </div>
  `;
  document.body.append(stepResetDialog);

  const initialCollisionMinutes = collisionMinutesByProgress[state.maxScreen];
  let trajectorySimulator = null;
  let trajectoryLaunchButton = null;
  if (initialCollisionMinutes) {
    trajectoryLaunchButton = document.createElement("button");
    trajectoryLaunchButton.className = "trajectory-launch";
    trajectoryLaunchButton.type = "button";
    trajectoryLaunchButton.setAttribute("aria-haspopup", "dialog");
    trajectoryLaunchButton.setAttribute("aria-controls", "trajectory-simulator");
    trajectoryLaunchButton.innerHTML = '<i aria-hidden="true">◎</i><span>軌道予測</span>';
    document.body.classList.add("has-trajectory-launch");
    if (document.querySelector(".inventory-launch")) document.body.classList.add("has-trajectory-inventory");
    document.body.append(trajectoryLaunchButton);

    trajectorySimulator = document.createElement("section");
    trajectorySimulator.className = "trajectory-simulator";
    trajectorySimulator.id = "trajectory-simulator";
    trajectorySimulator.hidden = true;
    trajectorySimulator.innerHTML = `
      <button class="trajectory-simulator__backdrop" type="button" data-close-trajectory aria-label="軌道予測を閉じる"></button>
      <div class="trajectory-simulator__window" role="dialog" aria-modal="true" aria-labelledby="trajectory-title" aria-describedby="trajectory-guide">
        <header class="trajectory-simulator__header">
          <div><small>ORBITAL TIME SIMULATOR</small><h2 id="trajectory-title">地球・隕石 軌道予測</h2></div>
          <button type="button" data-close-trajectory aria-label="閉じる">×</button>
        </header>
        <div class="trajectory-simulator__readout">
          <div><span>現在から</span><strong data-trajectory-time>0<small>分後</small></strong></div>
          <p data-trajectory-status><i></i><span>衝突まで ${initialCollisionMinutes}分</span></p>
        </div>
        <div class="trajectory-simulator__stage" data-trajectory-stage>
          <svg viewBox="0 0 1000 560" preserveAspectRatio="xMidYMin meet" role="img" aria-labelledby="trajectory-map-title trajectory-map-desc">
            <title id="trajectory-map-title">地球と隕石の軌道予測図</title>
            <desc id="trajectory-map-desc">地球は左から右、隕石は上から下へ、10分でグリッド1マス移動します。</desc>
            <defs><pattern id="trajectory-grid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="8 8"/></pattern></defs>
            <rect class="trajectory-grid" width="1000" height="560" fill="url(#trajectory-grid)"/>
            <line class="trajectory-track trajectory-track--earth" x1="0" y1="360" x2="1000" y2="360"/>
            <line class="trajectory-track trajectory-track--asteroid" x1="750" y1="0" x2="750" y2="560"/>
            <g class="trajectory-earth" data-trajectory-earth tabindex="0" role="slider" aria-label="地球の時間位置" aria-valuemin="0" aria-valuemax="${initialCollisionMinutes + 20}" aria-valuenow="0" aria-valuetext="現在から0分後">
              <circle data-earth-body cx="${750 - initialCollisionMinutes * 10}" cy="360" r="100"/>
              <circle class="trajectory-earth__handle" data-earth-handle cx="${750 - initialCollisionMinutes * 10}" cy="360" r="19"/>
              <text data-earth-label x="${750 - initialCollisionMinutes * 10}" y="220" text-anchor="middle">地球</text>
            </g>
            <g class="trajectory-asteroid" data-trajectory-asteroid>
              <circle data-asteroid-glow cx="750" cy="${260 - initialCollisionMinutes * 10}" r="22"/>
              <circle data-asteroid-body cx="750" cy="${260 - initialCollisionMinutes * 10}" r="12"/>
              <text data-asteroid-label x="780" y="${250 - initialCollisionMinutes * 10}">隕石</text>
            </g>
          </svg>
          <div class="trajectory-simulator__impact" data-trajectory-impact hidden><b>WARNING</b><span>隕石が地球に接触</span></div>
        </div>
        <div class="trajectory-simulator__controls">
          <button type="button" data-trajectory-step="-1" aria-label="1分戻す">−</button>
          <input data-trajectory-range type="range" min="0" max="${initialCollisionMinutes + 20}" step="1" value="0" aria-label="現在から何分後か">
          <button type="button" data-trajectory-step="1" aria-label="1分進める">＋</button>
          <button class="trajectory-simulator__reset" type="button" data-trajectory-reset>現在位置に戻す</button>
        </div>
        <p class="trajectory-simulator__guide" id="trajectory-guide"><i aria-hidden="true">↔</i><span>地球を左右にドラッグしてください</span><small>1目盛り＝1分 ／ グリッド1マス＝10分</small></p>
      </div>
    `;
    document.body.append(trajectorySimulator);
  }

  const menuButton = progress.querySelector(".game-progress__menu-button");
  const menuPanel = progress.querySelector(".game-progress__menu-panel");
  const cancelResetButton = resetDialog.querySelector(".game-reset-dialog__window [data-cancel-reset]");
  const cancelStepResetButton = stepResetDialog.querySelector(".game-step-reset-dialog__window [data-cancel-step-reset]");

  if (trajectorySimulator) {
    const simulatorButton = trajectoryLaunchButton;
    const simulatorWindow = trajectorySimulator.querySelector(".trajectory-simulator__window");
    const stage = trajectorySimulator.querySelector("[data-trajectory-stage]");
    const earth = trajectorySimulator.querySelector("[data-trajectory-earth]");
    const earthBody = trajectorySimulator.querySelector("[data-earth-body]");
    const earthHandle = trajectorySimulator.querySelector("[data-earth-handle]");
    const earthLabel = trajectorySimulator.querySelector("[data-earth-label]");
    const asteroidBody = trajectorySimulator.querySelector("[data-asteroid-body]");
    const asteroidGlow = trajectorySimulator.querySelector("[data-asteroid-glow]");
    const asteroidLabel = trajectorySimulator.querySelector("[data-asteroid-label]");
    const timeReadout = trajectorySimulator.querySelector("[data-trajectory-time]");
    const statusReadout = trajectorySimulator.querySelector("[data-trajectory-status]");
    const impactAlert = trajectorySimulator.querySelector("[data-trajectory-impact]");
    const range = trajectorySimulator.querySelector("[data-trajectory-range]");
    const maxFuture = initialCollisionMinutes + 20;
    let futureMinutes = 0;
    let wasColliding = false;
    let pointerId = null;

    function playImpactAlert() {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const audio = new AudioContextClass();
        [0, .16].forEach((delay, index) => {
          const oscillator = audio.createOscillator();
          const gain = audio.createGain();
          oscillator.type = "square";
          oscillator.frequency.value = index ? 520 : 390;
          gain.gain.setValueAtTime(.045, audio.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + delay + .12);
          oscillator.connect(gain).connect(audio.destination);
          oscillator.start(audio.currentTime + delay);
          oscillator.stop(audio.currentTime + delay + .13);
        });
        window.setTimeout(() => audio.close(), 500);
      } catch { /* sound is an optional enhancement */ }
    }

    function setFutureMinutes(value, announceImpact = true) {
      futureMinutes = Math.max(0, Math.min(maxFuture, Math.round(Number(value) || 0)));
      const earthX = 750 - initialCollisionMinutes * 10 + futureMinutes * 10;
      const asteroidY = 260 - initialCollisionMinutes * 10 + futureMinutes * 10;
      const relativeX = earthX - 750;
      const relativeY = 360 - asteroidY;
      const distance = Math.hypot(relativeX, relativeY);
      const isEntryContact = futureMinutes === initialCollisionMinutes;
      const colliding = isEntryContact || (futureMinutes > initialCollisionMinutes && distance < 99.99);
      const hasPassed = futureMinutes > initialCollisionMinutes && !colliding;
      const untilCollision = initialCollisionMinutes - futureMinutes;

      [earthBody, earthHandle].forEach(node => node.setAttribute("cx", String(earthX)));
      earthLabel.setAttribute("x", String(earthX));
      [asteroidBody, asteroidGlow].forEach(node => node.setAttribute("cy", String(asteroidY)));
      asteroidLabel.setAttribute("y", String(asteroidY - 10));
      timeReadout.innerHTML = `${futureMinutes}<small>分後</small>`;
      range.value = String(futureMinutes);
      earth.setAttribute("aria-valuenow", String(futureMinutes));
      earth.setAttribute("aria-valuetext", `現在から${futureMinutes}分後`);

      trajectorySimulator.classList.toggle("is-danger", colliding);
      trajectorySimulator.classList.toggle("is-passed", hasPassed);
      impactAlert.hidden = !colliding;
      if (futureMinutes < initialCollisionMinutes) {
        statusReadout.innerHTML = `<i></i><span>衝突まで ${untilCollision}分</span>`;
      } else if (colliding && futureMinutes === initialCollisionMinutes) {
        statusReadout.innerHTML = "<i></i><span>衝突開始</span>";
      } else if (colliding) {
        statusReadout.innerHTML = "<i></i><span>隕石が地球内部を通過中</span>";
      } else {
        statusReadout.innerHTML = "<i></i><span>隕石が地球を通過</span>";
      }
      if (colliding && !wasColliding && announceImpact) playImpactAlert();
      wasColliding = colliding;
    }

    function setFromPointer(clientX) {
      const svg = stage.querySelector("svg");
      const rect = svg.getBoundingClientRect();
      const viewX = (clientX - rect.left) / rect.width * 1000;
      const initialEarthX = 750 - initialCollisionMinutes * 10;
      setFutureMinutes((viewX - initialEarthX) / 10);
    }

    earth.addEventListener("pointerdown", event => {
      pointerId = event.pointerId;
      earth.setPointerCapture(pointerId);
      earth.classList.add("is-dragging");
      setFromPointer(event.clientX);
      event.preventDefault();
    });
    earth.addEventListener("pointermove", event => {
      if (event.pointerId !== pointerId) return;
      setFromPointer(event.clientX);
    });
    function endDrag(event) {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      earth.classList.remove("is-dragging");
    }
    earth.addEventListener("pointerup", endDrag);
    earth.addEventListener("pointercancel", endDrag);
    earth.addEventListener("keydown", event => {
      const delta = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
      if (delta) { event.preventDefault(); setFutureMinutes(futureMinutes + delta); }
      else if (event.key === "Home") { event.preventDefault(); setFutureMinutes(0); }
      else if (event.key === "End") { event.preventDefault(); setFutureMinutes(maxFuture); }
    });
    range.addEventListener("input", () => setFutureMinutes(range.value));
    trajectorySimulator.querySelectorAll("[data-trajectory-step]").forEach(button => button.addEventListener("click", () => setFutureMinutes(futureMinutes + Number(button.dataset.trajectoryStep))));
    trajectorySimulator.querySelector("[data-trajectory-reset]").addEventListener("click", () => setFutureMinutes(0));

    function openTrajectorySimulator() {
      closeMenu();
      trajectorySimulator.hidden = false;
      document.body.classList.add("has-open-simulator");
      setFutureMinutes(0, false);
      trajectorySimulator.querySelector("[data-close-trajectory]:not(.trajectory-simulator__backdrop)").focus();
    }
    function closeTrajectorySimulator() {
      trajectorySimulator.hidden = true;
      document.body.classList.remove("has-open-simulator");
      simulatorButton.focus();
    }
    simulatorButton.addEventListener("click", openTrajectorySimulator);
    trajectorySimulator.querySelectorAll("[data-close-trajectory]").forEach(button => button.addEventListener("click", closeTrajectorySimulator));
    simulatorWindow.addEventListener("keydown", event => {
      if (event.key === "Escape") closeTrajectorySimulator();
    });
    setFutureMinutes(0, false);
  }

  function closeMenu() {
    menuPanel.hidden = true;
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "メニューを開く");
  }

  function closeResetDialog() {
    resetDialog.hidden = true;
    menuButton.focus();
  }

  function closeStepResetDialog() {
    stepResetDialog.hidden = true;
    menuButton.focus();
  }

  menuButton.addEventListener("click", () => {
    const willOpen = menuPanel.hidden;
    menuPanel.hidden = !willOpen;
    menuButton.setAttribute("aria-expanded", String(willOpen));
    menuButton.setAttribute("aria-label", willOpen ? "メニューを閉じる" : "メニューを開く");
  });

  progress.querySelector("[data-open-reset-dialog]").addEventListener("click", () => {
    closeMenu();
    resetDialog.hidden = false;
    cancelResetButton.focus();
  });
  resetDialog.querySelectorAll("[data-cancel-reset]").forEach(button => button.addEventListener("click", closeResetDialog));
  resetDialog.querySelector("[data-confirm-reset]").addEventListener("click", resetProgress);
  progress.querySelector("[data-open-step-reset]").addEventListener("click", () => {
    closeMenu();
    stepResetDialog.hidden = false;
    cancelStepResetButton.focus();
  });
  stepResetDialog.querySelectorAll("[data-cancel-step-reset]").forEach(button => button.addEventListener("click", closeStepResetDialog));
  stepResetDialog.querySelectorAll("[data-reset-to-screen]").forEach(button => button.addEventListener("click", () => resetFromScreen(button.dataset.resetToScreen)));

  document.addEventListener("click", event => {
    if (!progress.querySelector(".game-progress__menu").contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (!stepResetDialog.hidden) closeStepResetDialog();
    else if (!resetDialog.hidden) closeResetDialog();
    else closeMenu();
  });
})();
