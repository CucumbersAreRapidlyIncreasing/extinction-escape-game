(() => {
  "use strict";

  // スマートフォンでは、資料のライトボックスを開いている間だけピンチ拡大を許可する。
  const lightbox = document.querySelector("#image-lightbox");
  const viewport = document.querySelector('meta[name="viewport"]');
  if (!lightbox || !viewport) return;

  const originalViewport = viewport.getAttribute("content") || "";
  let isActive = false;

  function setActive(active) {
    const next = Boolean(active);
    if (next === isActive) return;
    isActive = next;
    lightbox.classList.toggle("lightbox-zoom-active", isActive);

    const values = originalViewport
      .split(",")
      .map(value => value.trim())
      .filter(value => value && !/^(?:maximum-scale|user-scalable)\s*=/i.test(value));
    if (isActive) values.push("maximum-scale=5", "user-scalable=yes");
    viewport.setAttribute("content", values.join(", "));
  }

  window.LightboxZoom = { setActive };
  setActive(!lightbox.hidden);
  new MutationObserver(() => setActive(!lightbox.hidden)).observe(lightbox, {
    attributes: true,
    attributeFilter: ["hidden"],
  });
})();
