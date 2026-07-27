(() => {
  "use strict";

  const body = document.body;
  const initialState = window.GameProgress?.getState() || {};
  const savedScreen8 = initialState.screen8 || {};
  const cipherReceived = Boolean(initialState.screen6?.cipherTableReceived);
  const chatPanel = document.querySelector("#robot-chat");
  const chatHistory = document.querySelector("#chat-history");
  const chatInput = document.querySelector("#chat-input");
  const chatForm = document.querySelector("#chat-form");
  const robotLaunch = document.querySelector(".robot-launch");
  const workPanel = document.querySelector("#work-form-panel");
  const workForm = document.querySelector("#work-form");
  const workFeedback = document.querySelector("#work-feedback");
  const leverBank = document.querySelector("#mini-lever-bank");
  const leverButtons = [...document.querySelectorAll("[data-mini-lever]")];
  const sequenceSlots = [...document.querySelectorAll("#mini-sequence li")];
  const leverField = document.querySelector("#work-lever-answer");
  const engineButton = document.querySelector("#engine-start");
  const engineConfirm = document.querySelector("#engine-confirm");
  const inventoryLayer = document.querySelector("#inventory-layer");
  const inventoryList = document.querySelector("#inventory-list");
  const inventoryDetails = [...document.querySelectorAll(".inventory-detail")];
  const lightbox = document.querySelector("#image-lightbox");
  const lightboxImage = document.querySelector("#lightbox-image");
  const lightboxTitle = document.querySelector("#lightbox-title");

  const INTRO_MESSAGE = "あとはエンジンを起動するだけですね。\n\n早く起動して地球から脱出しましょう。\n\n……\n\nそれとも、まだ何かやることがあるのですか？";
  const COMMAND_GUIDE = "そうですか。\n\nですが外には恐竜がいるため、あなたは宇宙船から出ることはできません。\n\n私でよければ代わりに作業を行います。\n\n何か私にして欲しいことがある場合は\n\n『〇〇 に ✕✕ を △△ して』\n\nの形でお申し付けください。";
  const INSUFFICIENT_MESSAGE = "指示の内容が分かりません。\n\n『〇〇 に ✕✕ を △△ して』の形で、対象・使用する機器・必要な作業を教えてください。";
  const PARTIAL_RESET_MESSAGE = "それでは正しく作業が行えません。\n\n状況を整理して、なにか私にしてほしいことがある場合は\n\n『〇〇 に ✕✕ を △△ して』\n\nの形でお申し付けください。";
  const WORK_MESSAGE = "内容を確認しました。\n\n次に具体的な作業内容を教えてください。";
  const DIRECT_WORK_MESSAGE = "かしこまりました。では具体的な作業内容を教えてください。";
  const EXECUTION_MESSAGE = "作業内容を確認しました。\n\n・使用機器：3号システム\n\n・設置場所：地球\n\n・移動時間：20分\n\n・起動操作：赤→黒→青→黒→赤\n\nこの内容で作業を実行します。";

  let lastFocus = null;
  let introTimer = null;
  let reminderTimer = null;
  let preparing = false;
  let timeMachinePrepared = Boolean(savedScreen8.timeMachinePrepared);
  let stage = timeMachinePrepared ? "complete" : (savedScreen8.briefingStage || "idle");
  if (stage === "strategy") stage = "command";
  let workSubmitted = Boolean(savedScreen8.workSubmitted);
  let sequence = Array.isArray(savedScreen8.workSequence) ? [...savedScreen8.workSequence] : [];
  let activeLever = sequence.at(-1) ?? null;
  let debugMode = Boolean(savedScreen8.debugMode);
  let debugSnapshot = null;
  let awaitingChoice = stage === "choice";
  let partialInstruction = savedScreen8.partialInstruction || null;

  function appendMessage(role, text) {
    const wrapper = document.createElement("div");
    const label = document.createElement("span");
    const bubble = document.createElement("p");
    wrapper.className = `chat-message chat-message-${role}`;
    label.textContent = role === "robot" ? "ROBO" : role === "system" ? "SYSTEM" : "YOU";
    bubble.textContent = text;
    wrapper.append(label, bubble);
    chatHistory.append(wrapper);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return wrapper;
  }

  function saveScreen8(patch = {}) {
    window.GameProgress?.updateScreen8({
      briefingStage: stage,
      workAnswers: workInputs.map(input => input.value),
      workSubmitted,
      workSequence: [...sequence],
      partialInstruction,
      ...patch,
    });
  }

  function setStage(nextStage, patch = {}) {
    stage = nextStage;
    saveScreen8({ briefingStage: nextStage, ...patch });
  }

  function setChatInputAvailable(available) {
    chatInput.disabled = !available;
    chatForm.querySelector("button").disabled = !available;
  }

  function normalize(value) {
    const compact = String(value || "").normalize("NFKC").replace(/[\s　。、，．！？!?「」『』・]/g, "").toLowerCase();
    return [...compact].map(character => {
      const code = character.charCodeAt(0);
      return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : character;
    }).join("");
  }

  function includesAny(text, words) {
    return words.some(word => text.includes(normalize(word)));
  }

  function includesEarthTarget(text) {
    return includesAny(text, ["地球", "地面", "この星"]);
  }

  function analyzeEarthOrder(value) {
    const text = normalize(value);
    const targetTypes = [
      { words: ["地球"], label: "地球" },
      { words: ["地面"], label: "地面" },
      { words: ["この星"], label: "この星" },
    ];
    const matchedTarget = targetTypes.find(type => includesAny(text, type.words));
    const hasEarth = Boolean(matchedTarget);
    const hasAsteroid = includesAny(text, ["隕石", "いんせき", "インセキ"]);
    const hasSystem3 = includesAny(text, ["3号システム", "三号システム", "さんごうしすてむ"]);
    const penTypes = [
      { words: ["壊れた3色ボールペン", "壊れた三色ボールペン"], label: "壊れた3色ボールペン" },
      { words: ["3色ボールペン", "三色ボールペン"], label: "3色ボールペン" },
      { words: ["ボールペン"], label: "ボールペン" },
    ];
    const matchedPen = penTypes.find(type => includesAny(text, type.words));
    const hasPen = Boolean(matchedPen);
    const hasGenericTimeMachine = includesAny(text, ["タイムマシン"]) && !hasSystem3;
    const actionTypes = [
      { words: ["設置"], label: "設置" },
      { words: ["刺す", "挿す", "さす", "刺して", "挿して", "さして"], label: "刺す" },
    ];
    const matchedAction = actionTypes.find(type => includesAny(text, type.words));
    const hasInstall = Boolean(matchedAction);
    const hasWeakAction = includesAny(text, ["置く", "おく", "持っていく", "持って行く", "もっていく", "持っていって", "持って行って", "もっていって"]);
    return {
      hasEarth,
      targetLabel: matchedTarget?.label || "",
      hasAsteroid,
      hasSystem3,
      hasPen,
      penLabel: matchedPen?.label || "",
      itemLabel: hasSystem3 ? "3号システム" : matchedPen?.label || "",
      hasItem: hasSystem3 || hasPen,
      hasGenericTimeMachine,
      hasInstall,
      actionLabel: matchedAction?.label || "",
      hasWeakAction,
    };
  }

  function markField(input, correct) {
    const field = input.closest("[data-answer-field]");
    field.classList.toggle("is-correct", correct);
    field.classList.toggle("is-wrong", !correct);
    input.setAttribute("aria-invalid", String(!correct));
    return correct;
  }

  function showChoiceInput() {
    awaitingChoice = true;
    chatForm.classList.add("is-choice-prompt");
    chatInput.placeholder = "「はい」または「いいえ」と入力してください";
    setChatInputAvailable(true);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  function hideChoiceInput() {
    awaitingChoice = false;
    chatForm.classList.remove("is-choice-prompt");
    chatInput.placeholder = "指示を入力してください";
  }

  function showPanel(panel, afterMessage) {
    workPanel.hidden = false;
    if (afterMessage) afterMessage.after(panel);
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    panel.querySelector("input:not(:disabled)")?.focus();
  }

  function setFormLocked(form, locked) {
    form.querySelectorAll("input,button").forEach(control => control.disabled = locked);
  }

  function restoreNormalPanels() {
    workPanel.hidden = true;
    setFormLocked(workForm, workSubmitted || preparing || timeMachinePrepared);
    workPanel.classList.toggle("is-complete", workSubmitted || timeMachinePrepared);
    if (workSubmitted || timeMachinePrepared) {
      workInputs.forEach(input => markField(input, true));
      leverField.classList.add("is-correct");
      leverField.classList.remove("is-wrong");
    }
    if (["work", "executing"].includes(stage)) {
      workPanel.hidden = false;
    }
    if (stage === "complete") {
      workPanel.hidden = !workSubmitted;
    }
  }

  function askFinalQuestion() {
    if (timeMachinePrepared || preparing || stage === "choice") return;
    window.clearTimeout(introTimer);
    setStage("prompting");
    setChatInputAvailable(false);
    introTimer = window.setTimeout(() => {
      window.GameProgress.withRobotTyping(() => {
        const message = appendMessage("robot", INTRO_MESSAGE);
        setStage("choice");
        showChoiceInput(message);
      });
    }, 700);
  }

  function scheduleReminder() {
    window.clearTimeout(reminderTimer);
    robotLaunch.classList.remove("has-reminder");
    if (stage !== "declined" || !chatPanel.hidden) return;
    reminderTimer = window.setTimeout(() => robotLaunch.classList.add("has-reminder"), 60000);
  }

  function addDebugControls() {
    if (chatHistory.querySelector(".final-debug-controls")) return;
    const wrapper = appendMessage("system", "デバッグモード中です。確認したい表示を選択してください。");
    const controls = document.createElement("div");
    controls.className = "final-debug-controls";
    controls.innerHTML = [
      '<button type="button" data-debug-view="choice">確認質問</button>',
      '<button type="button" data-debug-view="work">作業内容フォーム</button>',
      '<button type="button" data-debug-view="complete">作業完了表示</button>',
    ].join("");
    wrapper.append(controls);
  }

  function startDebugMode() {
    if (debugMode) {
      addDebugControls();
      return;
    }
    debugSnapshot = {
      workAnswers: workInputs.map(input => input.value),
      sequence: [...sequence],
    };
    debugMode = true;
    saveScreen8({ debugMode: true });
    hideChoiceInput();
    setFormLocked(workForm, false);
    setChatInputAvailable(true);
    addDebugControls();
  }

  function endDebugMode() {
    if (!debugMode) return;
    debugMode = false;
    chatHistory.querySelectorAll(".final-debug-controls").forEach(controls => controls.closest(".chat-message")?.remove());
    if (debugSnapshot) {
      workInputs.forEach((input, index) => input.value = debugSnapshot.workAnswers[index] || "");
      sequence = [...debugSnapshot.sequence];
    }
    debugSnapshot = null;
    workInputs.forEach(input => {
      input.closest("[data-answer-field]")?.classList.remove("is-correct", "is-wrong");
      input.removeAttribute("aria-invalid");
    });
    leverField.classList.remove("is-correct", "is-wrong");
    workFeedback.textContent = "";
    renderSequence();
    restoreNormalPanels();
    engineButton.classList.toggle("is-true-ready", timeMachinePrepared);
    saveScreen8({ debugMode: false });
    appendMessage("system", "デバッグモードを終了しました。通常動作に戻ります。");
    hideChoiceInput();
    if (stage === "choice") showChoiceInput();
    else setChatInputAvailable(["command", "work", "complete", "declined"].includes(stage));
  }

  function openChat() {
    lastFocus = document.activeElement;
    chatPanel.hidden = false;
    robotLaunch.hidden = true;
    robotLaunch.classList.remove("has-reminder");
    window.clearTimeout(reminderTimer);
    if (stage === "idle" || stage === "declined" || stage === "prompting") askFinalQuestion();
    else if (stage === "choice" && !debugMode) showChoiceInput();
    else if (["work", "executing"].includes(stage) || (stage === "complete" && workSubmitted)) showPanel(workPanel, null);
    setChatInputAvailable(debugMode || ["choice", "command", "work", "complete", "declined"].includes(stage));
    requestAnimationFrame(() => (chatInput.disabled ? chatPanel.querySelector("button:not(:disabled)") : chatInput)?.focus());
  }

  function closeChat() {
    chatPanel.hidden = true;
    robotLaunch.hidden = false;
    lastFocus?.focus();
    scheduleReminder();
  }

  document.querySelectorAll("[data-open-robot]").forEach(button => button.addEventListener("click", openChat));
  document.querySelector("#robot-chat-close").addEventListener("click", closeChat);

  chatHistory.addEventListener("click", event => {
    const debugView = event.target.closest("[data-debug-view]");
    if (debugView && debugMode) {
      if (debugView.dataset.debugView === "choice") {
        appendMessage("robot", INTRO_MESSAGE);
        showChoiceInput();
      } else if (debugView.dataset.debugView === "work") {
        setFormLocked(workForm, false);
        showPanel(workPanel, debugView.closest(".chat-message"));
      } else if (debugView.dataset.debugView === "complete") {
        engineButton.classList.add("is-true-ready");
        appendMessage("robot", `${EXECUTION_MESSAGE}\n\n無事作業を完了しました。`);
      }
      return;
    }
  });

  function moveToWorkForm(messageText = WORK_MESSAGE) {
    setStage("work");
    window.GameProgress.withRobotTyping(() => {
      const reply = appendMessage("robot", messageText);
      showPanel(workPanel, reply);
      setChatInputAvailable(true);
    });
  }

  function instructionParts(order) {
    return {
      target: order.targetLabel || "",
      item: order.itemLabel || "",
      action: order.actionLabel || "",
    };
  }

  function missingInstructionPart(parts) {
    return ["target", "item", "action"].find(key => !parts[key]) || "";
  }

  function instructionPartCount(parts) {
    return [parts.target, parts.item, parts.action].filter(Boolean).length;
  }

  function supplementalInstructionPart(order, missing) {
    if (missing === "target") return order.targetLabel || "";
    if (missing === "item") {
      if (order.hasSystem3) return "3号システム";
      if (order.hasPen) return order.penLabel || "ボールペン";
      return "";
    }
    if (missing === "action") return order.actionLabel || "";
    return "";
  }

  function setPartialInstruction(parts, failedAttempts = 0) {
    const missing = missingInstructionPart(parts);
    partialInstruction = missing ? { ...parts, missing, failedAttempts } : null;
    saveScreen8({ partialInstruction });
  }

  function clearPartialInstruction() {
    partialInstruction = null;
    saveScreen8({ partialInstruction: null });
  }

  function missingPartPrompt(missing) {
    if (missing === "item") return "何を設置するのでしょう？";
    if (missing === "target") return "設置するには対象が必要です。どこに設置すればよいのでしょう？";
    return "その機器を、どのように扱えばよいのでしょう？";
  }

  function specialInstructionReply(order) {
    if (order.hasAsteroid) return "隕石ですか！？ それはさすがに無理ですよ。\n\n別の対象を指定してください。";
    if (order.hasGenericTimeMachine) return "5号システムなら宇宙船に設置済みですよ……\n\nそれとも別のタイムマシンがあるのですか？";
    if (order.hasWeakAction && !order.hasInstall) return "それでは意味がないのでは？\n\n必要な作業を、もう少し具体的に指示してください。";
    return "";
  }

  function actionPhrase(action) {
    return action === "設置" ? "設置する" : action;
  }

  function advanceFromInstruction(parts, summarize = false) {
    clearPartialInstruction();
    if (summarize) {
      appendMessage("robot", `なるほど、つまり${parts.target}に${parts.item}を${actionPhrase(parts.action)}ということですね。`);
    }
    if (debugMode) {
      window.GameProgress.withRobotTyping(() => {
        const reply = appendMessage("robot", DIRECT_WORK_MESSAGE);
        setFormLocked(workForm, false);
        showPanel(workPanel, reply);
      });
      return;
    }
    moveToWorkForm(DIRECT_WORK_MESSAGE);
  }

  chatForm.addEventListener("submit", event => {
    event.preventDefault();
    const value = chatInput.value.trim();
    if (!value) return;
    appendMessage("user", value);
    chatInput.value = "";
    window.GameProgress.withRobotTyping(() => {
      if (normalize(value) === normalize("デバッグモード開始")) {
        startDebugMode();
        return;
      }
      if (normalize(value) === normalize("デバッグモード終了")) {
        endDebugMode();
        return;
      }
      if (awaitingChoice) {
        const answer = normalize(value);
        if (![normalize("はい"), normalize("いいえ")].includes(answer)) {
          appendMessage("robot", "「はい」または「いいえ」と入力してください。");
          showChoiceInput();
          return;
        }
        hideChoiceInput();
        if (answer === normalize("いいえ")) {
          if (debugMode) {
            appendMessage("system", "デバッグ表示：チャット終了は実行しません。");
          } else {
            setStage("declined");
            closeChat();
          }
          return;
        }
        if (!debugMode) setStage("command");
        appendMessage("robot", COMMAND_GUIDE);
        setChatInputAvailable(true);
        return;
      }
      if (window.GameProgress?.respondToRobotKeyword(value, appendMessage)) return;
      if (timeMachinePrepared && !debugMode) {
        if (normalize(value).includes(normalize("エンジン"))) appendMessage("robot", "作業は完了しています。エンジンを起動してください。");
        else window.GameProgress?.respondToRobotSmallTalk(value, appendMessage);
        return;
      }
      if (stage === "command" || debugMode) {
        const order = analyzeEarthOrder(value);
        const parts = instructionParts(order);
        const completeInstruction = instructionPartCount(parts) === 3;
        if (partialInstruction) {
          if (completeInstruction) {
            advanceFromInstruction(parts, true);
            return;
          }
          const awaitedPart = missingInstructionPart(partialInstruction) || partialInstruction.missing;
          const supplementalPart = supplementalInstructionPart(order, awaitedPart);
          const mergedParts = {
            target: parts.target || partialInstruction.target,
            item: parts.item || partialInstruction.item,
            action: parts.action || partialInstruction.action,
          };
          if (supplementalPart) mergedParts[awaitedPart] = supplementalPart;
          if (supplementalPart && instructionPartCount(mergedParts) === 3) {
            advanceFromInstruction(mergedParts, true);
            return;
          }
          const failedAttempts = Number(partialInstruction.failedAttempts || 0) + 1;
          if (failedAttempts >= 2) {
            clearPartialInstruction();
            appendMessage("robot", PARTIAL_RESET_MESSAGE);
            return;
          }
          partialInstruction = { ...partialInstruction, failedAttempts };
          saveScreen8({ partialInstruction });
          appendMessage("robot", specialInstructionReply(order) || missingPartPrompt(awaitedPart));
          return;
        }
        const specialReply = specialInstructionReply(order);
        if (!completeInstruction && instructionPartCount(parts) === 2) {
          setPartialInstruction(parts, specialReply ? 1 : 0);
          appendMessage("robot", specialReply || missingPartPrompt(partialInstruction.missing));
          return;
        }
        if (specialReply) {
          appendMessage("robot", specialReply);
          return;
        }
        const hasOperationContext = order.hasItem || order.hasGenericTimeMachine || order.hasInstall || order.hasWeakAction;
        if (!hasOperationContext) {
          window.GameProgress?.respondToRobotSmallTalk(value, appendMessage);
          return;
        }
        if (!order.hasItem && !order.hasInstall && !order.hasWeakAction) {
          appendMessage("robot", INSUFFICIENT_MESSAGE);
          return;
        }
        if (!order.hasItem) {
          appendMessage("robot", "何を設置するのでしょう？");
          return;
        }
        if (order.hasSystem3 && !order.hasEarth && !order.hasInstall && !order.hasWeakAction) {
          appendMessage("robot", "3号システムですか？\n\nたしか、それは旧型のタイムマシンです。\n\nそんなものが存在するのですか？");
          return;
        }
        if (order.hasPen && !order.hasEarth && !order.hasInstall && !order.hasWeakAction) {
          appendMessage("robot", `${order.penLabel}ですか？\n\nそれをいったいどう使うのでしょうか？`);
          return;
        }
        if (!order.hasEarth) {
          appendMessage("robot", "設置するには対象が必要です。どこに設置すればよいのでしょう？");
          return;
        }
        if (!order.hasInstall) {
          appendMessage("robot", "その機器を、どのように扱えばよいのでしょう？");
          return;
        }
        advanceFromInstruction(parts, false);
        return;
      }
      if (stage === "work") {
        window.GameProgress?.respondToRobotSmallTalk(value, appendMessage);
        return;
      }
      window.GameProgress?.respondToRobotSmallTalk(value, appendMessage);
    });
  });

  const workInputs = ["#work-item", "#work-name", "#work-location", "#work-time"].map(selector => document.querySelector(selector));
  workInputs.forEach((input, index) => input.value = savedScreen8.workAnswers?.[index] || "");
  workInputs.forEach(input => input.addEventListener("change", () => {
    if (!debugMode) saveScreen8();
  }));

  function renderSequence() {
    activeLever = sequence.at(-1) ?? null;
    leverButtons.forEach((button, index) => button.setAttribute("aria-pressed", String(index === activeLever)));
    sequenceSlots.forEach((slot, index) => slot.textContent = sequence[index] === undefined ? "—" : leverButtons[sequence[index]].dataset.colorName);
    const locked = !debugMode && (sequence.length >= 5 || preparing || timeMachinePrepared);
    leverButtons.forEach(button => button.disabled = locked);
  }

  function resetLevers() {
    if (!debugMode && (preparing || timeMachinePrepared)) return;
    sequence = [];
    leverField.classList.remove("is-correct", "is-wrong");
    renderSequence();
    if (!debugMode) saveScreen8();
  }

  leverBank.addEventListener("click", event => {
    const button = event.target.closest("[data-mini-lever]");
    if (!button || sequence.length >= 5 || (!debugMode && (preparing || timeMachinePrepared))) return;
    sequence.push(Number(button.dataset.miniLever));
    renderSequence();
    if (!debugMode) saveScreen8();
  });
  document.querySelector("#lever-reset").addEventListener("click", resetLevers);

  function finishRobotOperation() {
    if (timeMachinePrepared) return;
    window.GameProgress.withRobotTyping(() => {
      timeMachinePrepared = true;
      preparing = false;
      stage = "complete";
      workSubmitted = true;
      saveScreen8({ briefingStage: "complete", timeMachinePrepared: true, workSubmitted: true });
      appendMessage("robot", "無事作業を完了しました。");
      workFeedback.textContent = "作業完了。エンジンを起動できます。";
      engineButton.classList.add("is-true-ready");
      setChatInputAvailable(true);
    });
  }

  function executeRobotOperation() {
    preparing = true;
    workSubmitted = true;
    setStage("executing", { workSubmitted: true });
    setFormLocked(workForm, true);
    workPanel.classList.add("is-complete");
    workFeedback.textContent = "ロボが船外作業を実行しています。";
    window.GameProgress.withRobotTyping(() => {
      appendMessage("robot", EXECUTION_MESSAGE);
      window.setTimeout(finishRobotOperation, 2200);
    });
  }

  workForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!debugMode && (stage !== "work" || preparing || timeMachinePrepared)) return;
    const values = workInputs.map(input => normalize(input.value));
    const results = [
      markField(workInputs[0], includesAny(values[0], ["壊れた3色ボールペン", "3色ボールペン", "三色ボールペン", "ボールペン"])),
      markField(workInputs[1], includesAny(values[1], ["3号システム", "三号システム", "さんごうしすてむ"])),
      markField(workInputs[2], includesEarthTarget(values[2])),
      markField(workInputs[3], values[3] === normalize("20分")),
    ];
    const correctSequence = [0, 4, 1, 4, 0];
    const leverCorrect = sequence.length === 5 && correctSequence.every((value, index) => sequence[index] === value);
    leverField.classList.toggle("is-correct", leverCorrect);
    leverField.classList.toggle("is-wrong", !leverCorrect);
    if (!debugMode) saveScreen8();
    if (!results.every(Boolean) || !leverCorrect) {
      workFeedback.textContent = "赤く表示された項目を確認してください。";
      return;
    }
    if (debugMode) {
      workFeedback.textContent = "デバッグ確認：入力内容は正解です。";
      return;
    }
    executeRobotOperation();
  });

  engineButton.addEventListener("click", () => {
    engineConfirm.hidden = false;
    body.classList.add("dialog-open");
    engineConfirm.querySelector("[data-engine-no]").focus();
  });
  function closeEngineConfirm() {
    engineConfirm.hidden = true;
    body.classList.remove("dialog-open");
    engineButton.focus();
  }
  document.querySelectorAll("[data-engine-no]").forEach(button => button.addEventListener("click", closeEngineConfirm));
  document.querySelector("[data-engine-yes]").addEventListener("click", () => {
    const ending = timeMachinePrepared ? "true" : "bad";
    window.GameProgress?.updateScreen8({ engineStarted: true, ending });
    location.href = ending === "true" ? "true-end.html" : "bad-end.html";
  });

  function openInventory() {
    lastFocus = document.activeElement;
    inventoryLayer.hidden = false;
    body.classList.add("modal-open");
    inventoryLayer.querySelector("[data-close-inventory]").focus();
  }
  function closeInventory() {
    inventoryLayer.hidden = true;
    inventoryList.hidden = false;
    inventoryDetails.forEach(detail => detail.hidden = true);
    body.classList.remove("modal-open");
    lastFocus?.focus();
  }
  document.querySelector("#inventory-open").addEventListener("click", openInventory);
  document.querySelectorAll("[data-close-inventory]").forEach(button => button.addEventListener("click", closeInventory));
  document.querySelectorAll("[data-open-detail]").forEach(button => button.addEventListener("click", () => {
    inventoryList.hidden = true;
    const detail = document.querySelector(`#${button.dataset.openDetail}`);
    detail.hidden = false;
    detail.querySelector("[data-detail-back]").focus();
  }));
  document.querySelectorAll("[data-detail-back]").forEach(button => button.addEventListener("click", () => {
    const detail = button.closest(".inventory-detail");
    detail.hidden = true;
    inventoryList.hidden = false;
    document.querySelector(`[data-open-detail="${detail.id}"]`).focus();
  }));
  document.querySelector("#cipher-item").hidden = !cipherReceived;
  document.querySelector("#inventory-empty-slot").hidden = cipherReceived;
  document.querySelector("#inventory-count").textContent = cipherReceived ? "3" : "2";

  function openLightbox(button) {
    lastFocus = button;
    lightboxImage.src = button.dataset.lightboxSrc;
    lightboxImage.alt = button.dataset.lightboxLabel;
    lightboxTitle.textContent = button.dataset.lightboxLabel;
    lightbox.hidden = false;
    body.classList.add("modal-open");
    lightbox.querySelector("[data-close-lightbox]").focus();
  }
  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImage.src = "";
    body.classList.remove("modal-open");
    lastFocus?.focus();
  }
  document.querySelectorAll("[data-lightbox-src]").forEach(button => button.addEventListener("click", () => openLightbox(button)));
  document.querySelectorAll("[data-close-lightbox]").forEach(button => button.addEventListener("click", closeLightbox));
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (!engineConfirm.hidden) closeEngineConfirm();
    else if (!lightbox.hidden) closeLightbox();
    else if (!inventoryLayer.hidden) closeInventory();
    else if (!chatPanel.hidden) closeChat();
  });

  if (stage === "executing" && !timeMachinePrepared) preparing = true;
  renderSequence();
  restoreNormalPanels();
  if (debugMode) {
    debugSnapshot = {
      workAnswers: workInputs.map(input => input.value),
      sequence: [...sequence],
    };
    hideChoiceInput();
    setFormLocked(workForm, false);
    setChatInputAvailable(true);
    addDebugControls();
  }
  if (timeMachinePrepared) engineButton.classList.add("is-true-ready");
  if (stage === "choice" && !debugMode) showChoiceInput();
  if (stage === "executing" && !timeMachinePrepared) {
    window.setTimeout(finishRobotOperation, 1200);
  }
  scheduleReminder();
})();
