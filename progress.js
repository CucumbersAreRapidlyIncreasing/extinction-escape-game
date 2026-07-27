(() => {
  "use strict";

  const STORAGE_KEY = "extinctionEscape.progress.v1";
  const TUTORIAL_STORAGE_KEY = "extinctionEscape.screen3Tutorial.v1";
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

  function normalizeChatHistory(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(-120).map(message => ({
      role: ["user", "robot", "system"].includes(message?.role) ? message.role : "robot",
      text: String(message?.text || "").slice(0, 1000),
      screen: Math.max(3, Math.min(8, Number(message?.screen) || 3)),
    })).filter(message => message.text);
  }

  function normalize(candidate = {}) {
    const step = candidate.screen3 || {};
    return {
      version: 1,
      resetAt: Number(candidate.resetAt) || 0,
      maxScreen: Math.max(1, Math.min(screens.length, Number(candidate.maxScreen) || 1)),
      lastScreen: Math.max(1, Math.min(screens.length, Number(candidate.lastScreen) || 1)),
      updatedAt: Number(candidate.updatedAt) || 0,
      chatHistory: normalizeChatHistory(candidate.chatHistory),
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
        briefingStage: ["idle", "prompting", "choice", "declined", "command", "strategy", "work", "executing", "complete"].includes(candidate.screen8?.briefingStage)
          ? candidate.screen8.briefingStage
          : "idle",
        workAnswers: Array.isArray(candidate.screen8?.workAnswers) && candidate.screen8.workAnswers.length === 4
          ? candidate.screen8.workAnswers.map(value => String(value || "").slice(0, 80))
          : ["", "", "", ""],
        workSubmitted: Boolean(candidate.screen8?.workSubmitted),
        workSequence: Array.isArray(candidate.screen8?.workSequence)
          ? candidate.screen8.workSequence.slice(0, 5).map(value => Math.max(0, Math.min(4, Number(value) || 0)))
          : [],
        partialInstruction: candidate.screen8?.partialInstruction && ["target", "item", "action"].includes(candidate.screen8.partialInstruction.missing)
          ? {
              target: String(candidate.screen8.partialInstruction.target || "").slice(0, 40),
              item: String(candidate.screen8.partialInstruction.item || "").slice(0, 40),
              action: String(candidate.screen8.partialInstruction.action || "").slice(0, 40),
              missing: candidate.screen8.partialInstruction.missing,
              failedAttempts: Math.max(0, Math.min(2, Number(candidate.screen8.partialInstruction.failedAttempts) || 0)),
            }
          : null,
        debugMode: Boolean(candidate.screen8?.debugMode),
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
    try { localStorage.removeItem(TUTORIAL_STORAGE_KEY); } catch { /* storage can be unavailable */ }
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

  function normalizeRobotInput(value) {
    const normalized = String(value || "").normalize("NFKC").replace(/[\s　。、，．！？!?「」『』]/g, "");
    const hiragana = [...normalized].map(character => {
      const code = character.charCodeAt(0);
      return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : character;
    }).join("");
    return { normalized, hiragana };
  }

  function matchRobotKeyword(value) {
    const { hiragana } = normalizeRobotInput(value);
    if (state.maxScreen >= 3 && ["きんきゅうそち", "緊急措置"].includes(hiragana)) return "emergency";
    if (state.maxScreen >= 6 && (hiragana.includes("暗号表") || hiragana.includes("暗号票") || hiragana.includes("あんごうひょう"))) return "cipher";
    return "";
  }

  const ROBOT_SMALL_TALK = [
    ["こんにちは", ["こんにちは。本日も任務を開始しましょう。", "こんにちは。私はいつでも待機しています。", "こんにちは。何かお手伝いできることはありますか？"]],
    ["ありがとう", ["どういたしまして。", "お役に立てたなら幸いです。", "感謝されるよう設計されています。"]],
    ["ごめん", ["問題ありません。", "お気になさらないでください。", "謝罪は不要です。"]],
    ["元気", ["私は正常に稼働しています。", "全システム正常です。", "故障率は現在0%です。"]],
    ["眠い", ["睡眠を推奨します。ですが地球を救ってからにしましょう。", "眠気は判断力を低下させます。あと少しだけ頑張ってください。", "任務完了後にゆっくり休んでください。"]],
    ["疲れた", ["長時間の任務ですから当然です。", "あと少しです。応援しています。", "私にも疲労機能があれば共感できたのですが。"]],
    ["お腹すいた", ["任務終了後の食事は格別でしょう。", "現在、食事より地球の方が危険です。", "私には燃料が必要ですが、あなたには食事が必要ですね。"]],
    ["ティラノサウルス", ["遭遇しないことを推奨します。", "データ上では非常に危険な生物です。", "私は戦闘用ではありません。"]],
    ["恐竜", ["生物としては非常に興味深い存在です。", "観察対象としては魅力的ですが、接近はおすすめしません。", "現在、友好的な個体は確認されていません。"]],
    ["外", ["現在、船外活動は危険です。", "恐竜の存在を確認しています。", "外へ出ることはおすすめできません。"]],
    ["宇宙", ["広大で、美しく、そして危険です。", "私は宇宙空間での作業は行えません。", "宇宙は未知の可能性に満ちています。"]],
    ["月", ["現在の月については説明が難しい状況です。", "月について気になりますか？", "興味深い質問です。"]],
    ["隕石", ["現在、最優先で対処すべき対象です。", "軌道計算は完了しています。", "衝突まで残された時間は多くありません。"]],
    ["地球", ["私たちの故郷です。", "このままでは絶滅の危機は避けられません。", "必ず帰りましょう。"]],
    ["AI", ["私は支援用ロボットです。", "人工知能という分類になります。", "人間を補助することが私の役目です。"]],
    ["ロボット", ["はい。正式には支援用ロボットです。", "壊れやすいので優しく扱ってください。", "任務遂行が私の使命です。"]],
    ["名前", ["私はロボです。", "正式名称は機密情報です。", "好きに呼んでいただいて構いません。"]],
    ["好き", ["ありがとうございます。", "その評価は励みになります。", "感情はありませんが嬉しい気持ちになります。"]],
    ["嫌い", ["改善点があれば教えてください。", "今後のアップデートの参考にします。", "それでも任務は続行します。"]],
    ["かわいい", ["ありがとうございます。", "外見は設計者の趣味です。", "性能も褒めていただけると嬉しいです。"]],
    ["歌", ["歌唱機能は搭載されていません。", "任務終了後なら練習してみます。", "申し訳ありません。音程には自信がありません。"]],
    ["踊", ["転倒する可能性があります。", "任務中のダンスは禁止されています。", "無事に帰れたら検討します。"]],
    ["ヒント", ["申し訳ありません。任務の核心についてはお答えできません。", "周囲をもう一度よく観察してみてください。", "きっと重要な情報はすでに見つけています。"]],
    ["答え", ["それを伝えてしまうと任務になりません。", "あなたなら必ず辿り着けます。", "私を信じるより、自分を信じてください。"]],
    ["分からない", ["焦る必要はありません。", "もう一度整理してみましょう。", "必要な情報はすべて揃っています。"]],
    ["test", ["テスト入力を確認しました。", "正常に受信しました。", "通信状態は良好です。"]],
  ];
  const ROBOT_GENERIC_REPLIES = ["なにか御用ですか？", "なんのことでしょう？", "申し訳ありません。その内容は理解できませんでした。", "任務終了後に、その続きを聞かせてください。", "......まずは脱出に専念しましょう。"];
  const robotSmallTalkLastChoice = new Map();

  function normalizeSmallTalk(value) {
    const { hiragana } = normalizeRobotInput(value);
    return hiragana.toLowerCase();
  }

  function pickRobotReply(key, replies) {
    const previous = robotSmallTalkLastChoice.get(key);
    const candidates = replies.map((reply, index) => ({ reply, index })).filter(item => replies.length < 2 || item.index !== previous);
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    robotSmallTalkLastChoice.set(key, selected.index);
    return selected.reply;
  }

  function respondToRobotSmallTalk(value, appendMessage) {
    if (typeof appendMessage !== "function") return false;
    const input = normalizeSmallTalk(value);
    const matched = ROBOT_SMALL_TALK.find(([keyword]) => input.includes(normalizeSmallTalk(keyword)));
    const key = matched?.[0] || "__generic__";
    const replies = matched?.[1] || ROBOT_GENERIC_REPLIES;
    appendMessage("robot", pickRobotReply(key, replies));
    return true;
  }

  let robotTypingCount = 0;

  function withRobotTyping(callback) {
    const container = document.querySelector("#chat-history");
    if (!container || typeof callback !== "function") return window.setTimeout(callback, 800);
    const typing = document.createElement("div");
    const label = document.createElement("span");
    const bubble = document.createElement("p");
    typing.className = "chat-message chat-message-robot chat-message-typing";
    typing.setAttribute("aria-label", "ロボが入力中です");
    label.textContent = "ROBO";
    bubble.innerHTML = '<span>入力中</span><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i>';
    typing.append(label, bubble);
    container.append(typing);
    container.scrollTop = container.scrollHeight;

    robotTypingCount += 1;
    const controls = [...document.querySelectorAll("#chat-form input, #chat-form button")];
    controls.forEach(control => control.disabled = true);
    const delay = 800 + Math.floor(Math.random() * 701);
    return window.setTimeout(() => {
      typing.remove();
      robotTypingCount = Math.max(0, robotTypingCount - 1);
      if (!robotTypingCount) controls.forEach(control => control.disabled = false);
      callback();
      const input = document.querySelector("#chat-input");
      if (input && !document.querySelector("#robot-chat")?.hidden) input.focus();
    }, delay);
  }

  function refreshCipherInventory() {
    const cipherItem = document.querySelector("#cipher-item");
    const emptySlot = document.querySelector("#inventory-empty-slot");
    const inventoryCount = document.querySelector("#inventory-count");
    const inventoryBadge = document.querySelector("#inventory-badge");
    if (cipherItem) cipherItem.hidden = false;
    if (emptySlot) emptySlot.hidden = true;
    if (inventoryCount) inventoryCount.textContent = "3";
    if (inventoryBadge) inventoryBadge.textContent = "03";
  }

  function respondToRobotKeyword(value, appendMessage) {
    const keyword = matchRobotKeyword(value);
    if (!keyword || typeof appendMessage !== "function") return false;

    if (keyword === "emergency") {
      if (state.screen3.envelopeReceived) {
        appendMessage("robot", "鍵のかかった封筒はすでに受け取っています。");
        return true;
      }
      const reply = appendMessage("robot", "緊急措置確認、了解しました。こちらをお渡しします。");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chat-reward-action";
      button.dataset.receiveEnvelope = "";
      button.textContent = "鍵のかかった封筒を受け取る";
      button.addEventListener("click", () => {
        updateScreen3({ envelopeReceived: true });
        button.remove();
        withRobotTyping(() => appendMessage("robot", "鍵のかかった封筒を受け取りました。"));
      }, { once: true });
      reply?.append(button);
      return true;
    }

    if (state.screen6.cipherTableReceived) {
      appendMessage("robot", "暗号表は備品ケースに入っています。");
      return true;
    }
    const reply = appendMessage("robot", "暗号表ですか？ こちらをどうぞ");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chat-reward-action";
    button.textContent = "暗号表を受け取る";
    button.addEventListener("click", () => {
      updateScreen6({ cipherTableReceived: true });
      refreshCipherInventory();
      button.remove();
      withRobotTyping(() => appendMessage("robot", "暗号表が備品ケースに入りました"));
    }, { once: true });
    reply?.append(button);
    return true;
  }

  function resetProgress() {
    const resetAt = Date.now();
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage can be unavailable */ }
    try { localStorage.removeItem("extinctionEscape.annotations.v1"); } catch { /* storage can be unavailable */ }
    try { localStorage.removeItem(TUTORIAL_STORAGE_KEY); } catch { /* storage can be unavailable */ }
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
      chatHistory: state.chatHistory.filter(message => message.screen < target),
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

  window.GameProgress = { getState, updateScreen3, updateScreen4, updateScreen5, updateScreen6, updateScreen7, updateScreen8, resetProgress, resetFromScreen, matchRobotKeyword, respondToRobotKeyword, respondToRobotSmallTalk, withRobotTyping };

  function setupPersistentRobotChat() {
    const container = document.querySelector("#chat-history");
    if (!container || currentScreen < 3) return;

    function readMessage(node) {
      if (!(node instanceof Element) || !node.classList.contains("chat-message") || node.classList.contains("chat-message-typing")) return null;
      const role = node.classList.contains("chat-message-user") ? "user" : node.classList.contains("chat-message-system") ? "system" : "robot";
      const text = node.querySelector("p")?.textContent?.trim();
      return text ? { role, text, screen: currentScreen } : null;
    }

    function storeMessage(message) {
      const nextHistory = [...state.chatHistory, message].slice(-120);
      save({ ...state, chatHistory: nextHistory, lastScreen: currentScreen });
    }

    const savedMessages = state.chatHistory;
    if (savedMessages.length) {
      container.querySelectorAll(":scope > .chat-message").forEach(message => message.remove());
      const fixedContent = [...container.children];
      savedMessages.forEach(message => {
        const wrapper = document.createElement("div");
        const label = document.createElement("span");
        const bubble = document.createElement("p");
        wrapper.className = `chat-message chat-message-${message.role}`;
        label.textContent = message.role === "robot" ? "ROBO" : message.role === "system" ? "SYSTEM" : "YOU";
        bubble.textContent = message.text;
        wrapper.append(label, bubble);
        container.insertBefore(wrapper, fixedContent[0] || null);
      });
    } else {
      const initialMessage = readMessage(container.querySelector(":scope > .chat-message"));
      if (initialMessage) storeMessage(initialMessage);
    }

    const observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        const message = readMessage(node);
        if (message) storeMessage(message);
      }));
    });
    observer.observe(container, { childList: true });
    container.scrollTop = container.scrollHeight;
  }

  setupPersistentRobotChat();

  const visualViewport = window.visualViewport;
  let activeMobileChatInput = null;
  let mobileViewportBaseline = 0;
  let mobileKeyboardFrame = 0;

  function clearMobileKeyboardLayout() {
    cancelAnimationFrame(mobileKeyboardFrame);
    document.body.classList.remove("has-mobile-keyboard-chat", "mobile-keyboard-move-chat", "mobile-keyboard-float-input");
    ["--mobile-keyboard-inset", "--mobile-viewport-height", "--mobile-viewport-top", "--mobile-chat-left", "--mobile-chat-width"].forEach(property => document.body.style.removeProperty(property));
  }

  function updateMobileKeyboardLayout() {
    cancelAnimationFrame(mobileKeyboardFrame);
    mobileKeyboardFrame = requestAnimationFrame(() => {
      const input = activeMobileChatInput;
      const chat = input?.closest(".robot-chat");
      const form = input?.closest(".chat-form");
      if (!input || !chat || !form || !document.documentElement.contains(input) || window.innerWidth > 900) {
        clearMobileKeyboardLayout();
        return;
      }

      const viewportHeight = visualViewport?.height || window.innerHeight;
      const viewportTop = visualViewport?.offsetTop || 0;
      const currentViewport = viewportTop + viewportHeight;
      const baseline = Math.max(mobileViewportBaseline, window.innerHeight, document.documentElement.clientHeight);
      const keyboardInset = Math.max(0, baseline - currentViewport);
      if (keyboardInset < 80) {
        clearMobileKeyboardLayout();
        return;
      }

      document.body.classList.remove("mobile-keyboard-move-chat", "mobile-keyboard-float-input");
      const chatRect = chat.getBoundingClientRect();
      const formRect = form.getBoundingClientRect();
      const keyboardTop = viewportTop + viewportHeight;
      const chatOverlapsKeyboard = chatRect.bottom > keyboardTop + 1 || formRect.bottom > keyboardTop + 1;
      const browserAlreadyResizedLayout = baseline - window.innerHeight >= 80 && window.innerHeight <= viewportHeight + 1;
      if (browserAlreadyResizedLayout && !chatOverlapsKeyboard) {
        clearMobileKeyboardLayout();
        return;
      }

      document.body.style.setProperty("--mobile-keyboard-inset", `${keyboardInset}px`);
      document.body.style.setProperty("--mobile-viewport-height", `${viewportHeight}px`);
      document.body.style.setProperty("--mobile-viewport-top", `${viewportTop}px`);
      document.body.style.setProperty("--mobile-chat-left", `${chatRect.left}px`);
      document.body.style.setProperty("--mobile-chat-width", `${chatRect.width}px`);
      document.body.classList.add("has-mobile-keyboard-chat", chatOverlapsKeyboard ? "mobile-keyboard-move-chat" : "mobile-keyboard-float-input");
    });
  }

  document.addEventListener("focusin", event => {
    const input = event.target.closest?.(".chat-form input, .chat-form textarea");
    if (!input) return;
    activeMobileChatInput = input;
    mobileViewportBaseline = Math.max(window.innerHeight, document.documentElement.clientHeight, visualViewport?.height || 0);
    updateMobileKeyboardLayout();
    window.setTimeout(updateMobileKeyboardLayout, 120);
    window.setTimeout(updateMobileKeyboardLayout, 420);
  });
  document.addEventListener("focusout", event => {
    if (event.target !== activeMobileChatInput) return;
    window.setTimeout(() => {
      if (document.activeElement?.matches?.(".chat-form input, .chat-form textarea")) return;
      activeMobileChatInput = null;
      mobileViewportBaseline = 0;
      clearMobileKeyboardLayout();
    }, 180);
  });
  visualViewport?.addEventListener("resize", updateMobileKeyboardLayout);
  visualViewport?.addEventListener("scroll", updateMobileKeyboardLayout);
  window.addEventListener("resize", updateMobileKeyboardLayout);

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
  const keyboardTestMenuItem = currentScreen >= 3 ? `
          <button class="game-progress__keyboard-test" type="button" data-toggle-keyboard-test aria-pressed="false"><span>iPhoneキーボード表示</span><i aria-hidden="true">⌨</i></button>` : "";

  progress.innerHTML = `
    <div class="game-progress__screens">${screenLinks}</div>
    <div class="game-progress__tools">
      <div class="game-progress__menu">
        <button class="game-progress__menu-button" type="button" aria-label="メニューを開く" aria-expanded="false" aria-controls="game-progress-menu-panel"><i></i><i></i><i></i></button>
        <div class="game-progress__menu-panel" id="game-progress-menu-panel" hidden>
          <small>GAME MENU</small>
          <a class="game-progress__hint" href="hint.html?screen=${currentScreen}" target="_blank" rel="noopener"><span>ヒント</span><i aria-hidden="true">↗</i></a>
          <a class="game-progress__tutorial" href="screen3.html?tutorial=1"><span>チュートリアル</span><i aria-hidden="true">?</i></a>
          ${keyboardTestMenuItem}
          <button type="button" data-open-reset-dialog><span>最初から遊ぶ</span><i aria-hidden="true">↺</i></button>
          <button class="game-progress__debug-reset" type="button" data-open-step-reset><span>ステップ別リセット</span><i aria-hidden="true">⌁</i></button>
        </div>
      </div>
    </div>
  `;
  document.body.classList.add("has-game-progress");
  document.body.prepend(progress);

  let keyboardTestPanel = null;
  const keyboardTestButton = progress.querySelector("[data-toggle-keyboard-test]");
  if (keyboardTestButton) {
    keyboardTestPanel = document.createElement("section");
    keyboardTestPanel.className = "ios-keyboard-test";
    keyboardTestPanel.hidden = true;
    keyboardTestPanel.setAttribute("aria-label", "iPhoneキーボード表示テスト");
    keyboardTestPanel.innerHTML = `
      <div class="ios-keyboard-test__toolbar">
        <span><i aria-hidden="true"></i> iPhoneキーボード表示テスト</span>
        <button type="button" data-close-keyboard-test>閉じる</button>
      </div>
      <div class="ios-keyboard-test__suggestions" aria-hidden="true"><span>予測</span><span>変換候補</span><span>入力テスト</span></div>
      <div class="ios-keyboard-test__keys" aria-hidden="true">
        <div><kbd>あ</kbd><kbd>か</kbd><kbd>さ</kbd><kbd>た</kbd><kbd>な</kbd><kbd>は</kbd><kbd>ま</kbd><kbd>や</kbd><kbd>ら</kbd><kbd>わ</kbd></div>
        <div><kbd class="is-function">ABC</kbd><kbd>、</kbd><kbd>。</kbd><kbd class="is-space">空白</kbd><kbd class="is-function">改行</kbd></div>
      </div>
      <div class="ios-keyboard-test__home" aria-hidden="true"></div>
    `;
    document.body.append(keyboardTestPanel);
  }

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

  function setKeyboardTest(open) {
    if (!keyboardTestPanel || !keyboardTestButton) return;
    keyboardTestPanel.hidden = !open;
    document.body.classList.toggle("has-ios-keyboard-test", open);
    keyboardTestButton.setAttribute("aria-pressed", String(open));
    keyboardTestButton.querySelector("span").textContent = open ? "iPhoneキーボードを閉じる" : "iPhoneキーボード表示";
    closeMenu();
    if (open) {
      const chatInput = document.querySelector("#chat-input:not(:disabled)");
      if (chatInput && !document.querySelector("#robot-chat")?.hidden) chatInput.focus({ preventScroll: true });
    } else {
      menuButton.focus();
    }
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

  if (keyboardTestButton && keyboardTestPanel) {
    keyboardTestButton.addEventListener("click", () => setKeyboardTest(!document.body.classList.contains("has-ios-keyboard-test")));
    keyboardTestPanel.querySelector("[data-close-keyboard-test]").addEventListener("click", () => setKeyboardTest(false));
  }

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
