(() => {
  "use strict";

  const body = document.body;
  const context = body.dataset.screenContext || "unknown";
  const inventoryLayer = document.querySelector("#inventory-layer");
  const inventoryList = document.querySelector("#inventory-list");
  const inventoryDetails = [...document.querySelectorAll(".inventory-detail")];
  const chatPanel = document.querySelector("#robot-chat");
  const chatInput = document.querySelector("#chat-input");
  const chatHistory = document.querySelector("#chat-history");
  const lightbox = document.querySelector("#image-lightbox");
  const lightboxImage = document.querySelector("#lightbox-image");
  const lightboxTitle = document.querySelector("#lightbox-title");
  const answerSheetOverlay = document.querySelector("#answer-sheet-overlay");
  const lightboxAnswerOverlay = document.querySelector("#lightbox-answer-overlay");
  const answerInstruction = document.querySelector("#answer-instruction");
  const lockedEnvelope = document.querySelector("#locked-envelope");
  const envelopeLock = document.querySelector("#envelope-lock");
  const unlockSuccess = document.querySelector("#unlock-success");
  const lockFeedback = document.querySelector("#lock-feedback");
  const lockStatus = document.querySelector("#lock-status");
  const dialInputs = [...document.querySelectorAll(".dial-value")];
  const puzzleAnswerForms = [...document.querySelectorAll("[data-puzzle-answer]")];
  const PUZZLE_ANSWERS = Object.freeze({
    A: "キタイ",
    B: "アンコク",
    C: "ツキアカリ",
    D: "キュウカク",
    E: "ツウシンキ",
    F: "スイソウ",
    G: "カイチク",
  });
  const ANSWER_SHEET_POSITIONS = Object.freeze({
    A: { x: 24.09, y: 47.97 },
    B: { x: 32.41, y: 36.20 },
    C: { x: 40.74, y: 36.20 },
    D: { x: 49.06, y: 36.20 },
    E: { x: 57.39, y: 36.20 },
    F: { x: 65.70, y: 24.45 },
    G: { x: 74.01, y: 24.45 },
  });
  const ANSWER_SHEET_ROW_STEP = 11.77;
  const solvedPuzzles = new Set();
  const dialValues = [1, 1, 1, 1];
  let lastFocus = null;

  function saveStepProgress(patch) {
    window.GameProgress?.updateScreen3({ ...patch, dials: [...dialValues] });
  }

  function restoreStepProgress() {
    const saved = window.GameProgress?.getState().screen3;
    if (!saved) return;
    saved.dials.forEach((value, index) => {
      dialValues[index] = value;
      dialInputs[index].value = String(value);
    });
    (saved.solvedPuzzles || []).forEach(id => {
      if (!PUZZLE_ANSWERS[id]) return;
      solvedPuzzles.add(id);
      const form = puzzleAnswerForms.find(item => item.dataset.puzzleAnswer === id);
      if (form) markPuzzleCorrect(form, PUZZLE_ANSWERS[id]);
    });
    if (!saved.envelopeReceived && !saved.envelopeUnlocked) return;
    answerInstruction.hidden = true;
    lockedEnvelope.hidden = false;
    lockedEnvelope.classList.add("is-received");
    if (!saved.envelopeUnlocked) return;
    envelopeLock.hidden = true;
    unlockSuccess.hidden = false;
    lockedEnvelope.classList.add("is-unlocked");
    lockStatus.innerHTML = "<i></i> OPENED";
  }

  const CHAT_RULES = {
    step1: [
      {
        answers: ["きんきゅうそち", "キンキュウソチ", "緊急措置"],
        response: "緊急措置確認、了解しました。こちらをお渡しします。",
        nextLabel: "鍵のかかった封筒を受け取る",
      },
    ],
  };

  const DEFAULT_REPLIES = [
    "なんのことでしょう？",
    "私にはわかりません。",
  ];
  let defaultReplyIndex = 0;

  restoreStepProgress();

  function normalizeAnswer(value) {
    return value.normalize("NFKC").replace(/[\s　。、，．！？!?]/g, "").toLowerCase();
  }

  function normalizePuzzleAnswer(value) {
    return value
      .normalize("NFKC")
      .replace(/[\s　。、，．！？!?]/g, "")
      .replace(/[ぁ-ゖ]/g, character => String.fromCharCode(character.charCodeAt(0) + 0x60));
  }

  function fillAnswerSheet(id, answer, animate = false) {
    const start = ANSWER_SHEET_POSITIONS[id];
    if (!start) return;
    [answerSheetOverlay, lightboxAnswerOverlay].forEach(overlay => {
      if (!overlay || overlay.querySelector(`[data-sheet-answer="${id}"]`)) return;
      Array.from(answer).forEach((character, index) => {
        const letter = document.createElement("span");
        letter.className = `answer-sheet-letter${animate ? " is-writing" : ""}`;
        letter.dataset.sheetAnswer = id;
        letter.textContent = character;
        letter.style.setProperty("--answer-x", `${start.x}%`);
        letter.style.setProperty("--answer-y", `${start.y + ANSWER_SHEET_ROW_STEP * index}%`);
        letter.style.setProperty("--answer-delay", `${index * 120}ms`);
        overlay.append(letter);
      });
    });
  }

  function markPuzzleCorrect(form, answer, animate = false) {
    const input = form.querySelector("input");
    const button = form.querySelector("button");
    const feedback = form.querySelector("p");
    form.classList.remove("is-wrong");
    form.classList.add("is-correct");
    input.value = answer;
    input.disabled = true;
    button.disabled = true;
    button.textContent = "正解";
    feedback.textContent = "正解です。回答を記録しました。";
    fillAnswerSheet(form.dataset.puzzleAnswer, answer, animate);
  }

  puzzleAnswerForms.forEach(form => {
    const id = form.dataset.puzzleAnswer;
    const input = form.querySelector("input");
    const feedback = form.querySelector("p");
    input.addEventListener("input", () => {
      form.classList.remove("is-wrong");
      feedback.textContent = "";
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      if (solvedPuzzles.has(id)) return;
      if (normalizePuzzleAnswer(input.value) === PUZZLE_ANSWERS[id]) {
        solvedPuzzles.add(id);
        markPuzzleCorrect(form, PUZZLE_ANSWERS[id], true);
        saveStepProgress({ solvedPuzzles: [...solvedPuzzles] });
        return;
      }
      form.classList.remove("is-correct");
      form.classList.add("is-wrong");
      feedback.textContent = "答えが違うようです。もう一度確認してください。";
    });
  });

  function setPageLocked(locked) {
    body.classList.toggle("modal-open", locked);
  }

  function openInventory() {
    lastFocus = document.activeElement;
    inventoryLayer.hidden = false;
    setPageLocked(true);
    inventoryLayer.querySelector("[data-close-inventory]").focus();
  }

  function closeInventory() {
    inventoryLayer.hidden = true;
    inventoryList.hidden = false;
    inventoryDetails.forEach(detail => detail.hidden = true);
    setPageLocked(false);
    lastFocus?.focus();
  }

  document.querySelector("#inventory-open").addEventListener("click", openInventory);
  document.querySelectorAll("[data-close-inventory]").forEach(button => button.addEventListener("click", closeInventory));
  document.querySelectorAll("[data-open-detail]").forEach(button => {
    button.addEventListener("click", () => {
      inventoryList.hidden = true;
      const detail = document.querySelector(`#${button.dataset.openDetail}`);
      detail.hidden = false;
      detail.querySelector("[data-detail-back]").focus();
    });
  });
  document.querySelectorAll("[data-detail-back]").forEach(button => button.addEventListener("click", () => {
    const detail = button.closest(".inventory-detail");
    detail.hidden = true;
    inventoryList.hidden = false;
    document.querySelector(`[data-open-detail="${detail.id}"]`).focus();
  }));

  function openChat() {
    lastFocus = document.activeElement;
    chatPanel.hidden = false;
    document.querySelector(".robot-launch").hidden = true;
    requestAnimationFrame(() => chatInput.focus());
  }

  function closeChat() {
    chatPanel.hidden = true;
    document.querySelector(".robot-launch").hidden = false;
    lastFocus?.focus();
  }

  document.querySelectorAll("[data-open-robot]").forEach(button => button.addEventListener("click", openChat));
  document.querySelector("#robot-chat-close").addEventListener("click", closeChat);

  function appendMessage(role, text, options = {}) {
    const wrapper = document.createElement("div");
    wrapper.className = `chat-message chat-message-${role}`;
    const label = document.createElement("span");
    label.textContent = role === "robot" ? "ROBO" : "YOU";
    const bubble = document.createElement("p");
    bubble.textContent = text;
    wrapper.append(label, bubble);
    if (options.nextLabel) {
      const link = document.createElement("a");
      link.className = "chat-next-link";
      link.href = "#locked-envelope";
      link.dataset.receiveEnvelope = "";
      link.innerHTML = `<span>${options.nextLabel}</span><i aria-hidden="true">→</i>`;
      wrapper.append(link);
    }
    chatHistory.append(wrapper);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  document.querySelector("#chat-form").addEventListener("submit", event => {
    event.preventDefault();
    const raw = chatInput.value.trim();
    if (!raw) return;
    appendMessage("user", raw);
    chatInput.value = "";
    const normalized = normalizeAnswer(raw);
    const rule = (CHAT_RULES[context] || []).find(item => item.answers.some(answer => normalizeAnswer(answer) === normalized));
    window.setTimeout(() => {
      if (rule) {
        appendMessage("robot", rule.response, { nextLabel: rule.nextLabel });
      } else {
        appendMessage("robot", DEFAULT_REPLIES[defaultReplyIndex % DEFAULT_REPLIES.length]);
        defaultReplyIndex += 1;
      }
    }, 320);
  });

  chatHistory.addEventListener("click", event => {
    const link = event.target.closest("[data-receive-envelope]");
    if (!link) return;
    event.preventDefault();
    answerInstruction.hidden = true;
    lockedEnvelope.hidden = false;
    chatPanel.hidden = true;
    document.querySelector(".robot-launch").hidden = false;
    saveStepProgress({ envelopeReceived: true });
    requestAnimationFrame(() => lockedEnvelope.classList.add("is-received"));
    window.setTimeout(() => lockedEnvelope.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  });

  document.querySelectorAll("[data-dial-change]").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.dialIndex);
      const change = Number(button.dataset.dialChange);
      const next = dialValues[index] + change;
      dialValues[index] = next > 9 ? 1 : next < 1 ? 9 : next;
      dialInputs[index].value = String(dialValues[index]);
      saveStepProgress({});
      lockFeedback.textContent = "";
    });
  });

  envelopeLock.addEventListener("submit", event => {
    event.preventDefault();
    if (dialValues.join("") === "4649") {
      envelopeLock.hidden = true;
      unlockSuccess.hidden = false;
      lockedEnvelope.classList.add("is-unlocked");
      lockStatus.innerHTML = "<i></i> OPENED";
      saveStepProgress({ envelopeReceived: true, envelopeUnlocked: true });
      unlockSuccess.querySelector("a").focus();
      return;
    }
    lockFeedback.textContent = "ロックは開かない。番号が違うようだ。";
    envelopeLock.classList.remove("is-error");
    void envelopeLock.offsetWidth;
    envelopeLock.classList.add("is-error");
  });

  function openLightbox(button) {
    lastFocus = button;
    const label = button.dataset.lightboxLabel;
    lightboxImage.src = button.dataset.lightboxSrc;
    lightboxImage.alt = label;
    lightboxTitle.textContent = label;
    lightboxAnswerOverlay.hidden = !button.classList.contains("answer-image");
    lightbox.hidden = false;
    setPageLocked(true);
    lightbox.querySelector("[data-close-lightbox]").focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImage.src = "";
    lightboxAnswerOverlay.hidden = true;
    setPageLocked(false);
    lastFocus?.focus();
  }

  document.querySelectorAll("[data-lightbox-src]").forEach(button => button.addEventListener("click", () => openLightbox(button)));
  document.querySelectorAll("[data-close-lightbox]").forEach(button => button.addEventListener("click", closeLightbox));

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (!lightbox.hidden) closeLightbox();
    else if (!inventoryLayer.hidden) closeInventory();
    else if (!chatPanel.hidden) closeChat();
  });
})();
