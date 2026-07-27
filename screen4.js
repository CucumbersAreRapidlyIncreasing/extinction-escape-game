(() => {
  "use strict";

  const body = document.body;
  const inventoryLayer = document.querySelector("#inventory-layer");
  const inventoryList = document.querySelector("#inventory-list");
  const inventoryDetails = [...document.querySelectorAll(".inventory-detail")];
  const chatPanel = document.querySelector("#robot-chat");
  const chatInput = document.querySelector("#chat-input");
  const chatHistory = document.querySelector("#chat-history");
  const lightbox = document.querySelector("#image-lightbox");
  const lightboxImage = document.querySelector("#lightbox-image");
  const lightboxTitle = document.querySelector("#lightbox-title");
  let lastFocus = null;
  let defaultReplyIndex = 0;
  const replies = ["なんのことでしょう？", "私にはわかりません。", "電源復旧資料を確認してみてください。"]; 

  function setPageLocked(locked) { body.classList.toggle("modal-open", locked); }

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

  function appendMessage(role, text) {
    const wrapper = document.createElement("div");
    wrapper.className = `chat-message chat-message-${role}`;
    const label = document.createElement("span");
    label.textContent = role === "robot" ? "ROBO" : "YOU";
    const bubble = document.createElement("p");
    bubble.textContent = text;
    wrapper.append(label, bubble);
    chatHistory.append(wrapper);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return wrapper;
  }

  document.querySelector("#chat-form").addEventListener("submit", event => {
    event.preventDefault();
    const value = chatInput.value.trim();
    if (!value) return;
    appendMessage("user", value);
    chatInput.value = "";
    window.GameProgress.withRobotTyping(() => {
      if (window.GameProgress?.respondToRobotKeyword(value, appendMessage)) return;
      window.GameProgress?.respondToRobotSmallTalk(value, appendMessage);
    });
  });

  function openLightbox(button) {
    lastFocus = button;
    lightboxImage.src = button.dataset.lightboxSrc;
    lightboxImage.alt = button.dataset.lightboxLabel;
    lightboxTitle.textContent = button.dataset.lightboxLabel;
    lightbox.hidden = false;
    setPageLocked(true);
    lightbox.querySelector("[data-close-lightbox]").focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImage.src = "";
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
