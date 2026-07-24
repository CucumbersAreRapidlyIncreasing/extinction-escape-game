(() => {
  "use strict";

  const correctValues = [2, 3, 4, 1, 5];
  const saved = window.GameProgress?.getState().screen4;
  const values = saved?.dials ? [...saved.dials] : [1, 1, 1, 1, 1];
  const angles = values.map(value => (value - 1) * 60);
  const dialBank = document.querySelector("#dial-bank");
  const readout = document.querySelector("#dial-readout");
  const feedback = document.querySelector("#control-feedback");
  const indicator = document.querySelector("#system-indicator");
  const success = document.querySelector("#power-success");
  let restored = Boolean(saved?.powerRestored);

  function dialMarkup(index) {
    const letter = String.fromCharCode(65 + index);
    const numbers = [1, 2, 3, 4, 5, 6].map(number => `<span class="dial-number dial-number-${number}">${number}</span>`).join("");
    return `
      <article class="control-dial" data-control-dial="${index}">
        <header><small>DIAL</small><strong>${letter}</strong></header>
        <button class="dial-face" type="button" data-dial-advance="${index}" style="--dial-angle:${angles[index]}deg" aria-label="ダイヤル${letter}、現在${values[index]}。押すと時計回りに進みます">
          ${numbers}<span class="dial-knob"><i></i></span>
        </button>
        <output class="dial-value" aria-label="ダイヤル${letter}の設定値">${values[index]}</output>
      </article>`;
  }

  dialBank.innerHTML = values.map((_, index) => dialMarkup(index)).join("");

  function persist() {
    window.GameProgress?.updateScreen4({
      dials: [...values],
      powerRestored: restored,
    });
  }

  function showSuccess() {
    restored = true;
    document.body.classList.add("power-is-restored");
    indicator.innerHTML = "<i></i><span>SYSTEM ONLINE</span>";
    feedback.textContent = "起動信号を確認しました";
    success.hidden = false;
    dialBank.querySelectorAll("button").forEach(button => button.disabled = true);
    persist();
    if (!saved?.powerRestored) window.setTimeout(() => success.scrollIntoView({ behavior: "smooth", block: "center" }), 500);
  }

  function render() {
    values.forEach((value, index) => {
      const dial = dialBank.querySelector(`[data-control-dial="${index}"]`);
      dial.querySelector(".dial-face").style.setProperty("--dial-angle", `${angles[index]}deg`);
      dial.querySelector(".dial-face").setAttribute("aria-label", `ダイヤル${String.fromCharCode(65 + index)}、現在${value}。押すと時計回りに進みます`);
      dial.querySelector("output").textContent = String(value);
    });
    readout.textContent = values.join(" - ");
    if (values.every((value, index) => value === correctValues[index])) showSuccess();
    else persist();
  }

  dialBank.addEventListener("click", event => {
    const button = event.target.closest("[data-dial-advance]");
    if (!button || restored) return;
    const index = Number(button.dataset.dialAdvance);
    values[index] = values[index] === 6 ? 1 : values[index] + 1;
    angles[index] += 60;
    feedback.textContent = "ダイヤル入力を確認中…";
    render();
  });

  if (restored) showSuccess();
  else render();
})();
