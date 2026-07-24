(() => {
  "use strict";
  const buttons = [...document.querySelectorAll("[data-color-index]")];
  const bank = document.querySelector("#color-button-bank");
  const selectionOutput = document.querySelector("#engine-selection");
  const feedback = document.querySelector("#engine-feedback");
  const confirmLayer = document.querySelector("#color-confirm");
  const confirmTitle = document.querySelector("#color-confirm-title");
  const confirmMessage = document.querySelector("#color-confirm-message");
  const indicator = document.querySelector("#engine-indicator");
  const success = document.querySelector("#engine-success");
  const colorNames = buttons.map(button => button.dataset.colorName);
  let selected = [];
  let engineStarted = Boolean(window.GameProgress?.getState().screen5.engineStarted);

  function renderSelection() {
    buttons.forEach((button, index) => button.setAttribute("aria-pressed", String(selected.includes(index))));
    selectionOutput.textContent = selected.length ? selected.map(index => colorNames[index]).join(" ＋ ") : "未選択";
  }

  function resetSelection(message = "1色目のボタンを押してください") {
    selected = [];
    renderSelection();
    feedback.textContent = message;
  }

  function openConfirmation() {
    const first = colorNames[selected[0]], second = colorNames[selected[1]];
    confirmTitle.textContent = `${first}と${second}のボタンを同時に押しますか？`;
    confirmMessage.textContent = `選択中：${first} ＋ ${second}`;
    confirmLayer.hidden = false;
    document.body.classList.add("confirm-open");
    confirmLayer.querySelector(".color-confirm-window [data-confirm-no]").focus();
  }

  function closeConfirmation() {
    confirmLayer.hidden = true;
    document.body.classList.remove("confirm-open");
  }

  function showSuccess() {
    engineStarted = true;
    closeConfirmation();
    document.body.classList.add("engine-started");
    indicator.innerHTML = "<i></i><span>ENGINE ONLINE</span>";
    feedback.textContent = "エンジン起動信号を確認しました";
    success.hidden = false;
    buttons.forEach(button => button.disabled = true);
    window.GameProgress?.updateScreen5({ engineStarted: true });
    success.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  bank.addEventListener("click", event => {
    const button = event.target.closest("[data-color-index]");
    if (!button || engineStarted || !confirmLayer.hidden) return;
    const index = Number(button.dataset.colorIndex);
    if (selected.includes(index)) { resetSelection(); return; }
    selected.push(index);
    renderSelection();
    if (selected.length === 1) feedback.textContent = `${colorNames[index]}のボタンを保持しています。2色目を選んでください`;
    else openConfirmation();
  });

  document.querySelectorAll("[data-confirm-no]").forEach(button => button.addEventListener("click", () => {
    closeConfirmation();
    resetSelection();
  }));

  document.querySelector("[data-confirm-yes]").addEventListener("click", () => {
    const correct = selected.includes(2) && selected.includes(3);
    if (correct) { showSuccess(); return; }
    closeConfirmation();
    feedback.textContent = "何かが違うようだ";
    bank.classList.remove("is-error");
    void bank.offsetWidth;
    bank.classList.add("is-error");
    window.setTimeout(() => { bank.classList.remove("is-error"); resetSelection("何かが違うようだ。もう一度選んでください"); }, 520);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !confirmLayer.hidden) { closeConfirmation(); resetSelection(); }
  });

  renderSelection();
  if (engineStarted) showSuccess();
})();
