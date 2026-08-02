(() => {
  "use strict";

  // ブラウザ全体は拡大せず、ライトボックス内の資料画像だけをピンチ操作する。
  const lightbox = document.querySelector("#image-lightbox");
  const scroll = lightbox?.querySelector(".lightbox-scroll");
  const image = lightbox?.querySelector("#lightbox-image");
  if (!lightbox || !scroll || !image) return;

  const MIN_SCALE = 1;
  const MAX_SCALE = 5;
  const pointers = new Map();
  let active = false;
  let scale = MIN_SCALE;
  let baseWidth = 0;
  let sizedStage = null;
  let pan = null;
  let pinch = null;

  function getStage() {
    return image.closest(".annotation-stage--lightbox, .lightbox-image-stage") || image;
  }

  function clearPointers() {
    pointers.clear();
    pan = null;
    pinch = null;
  }

  function clearStageSize() {
    if (!sizedStage) return;
    sizedStage.style.removeProperty("width");
    sizedStage.style.removeProperty("min-width");
    sizedStage.classList.remove("is-pinch-zoomed");
  }

  function resetZoom() {
    clearPointers();
    clearStageSize();
    sizedStage = getStage();
    scale = MIN_SCALE;
    baseWidth = sizedStage.getBoundingClientRect().width || scroll.clientWidth || 1;
    scroll.scrollLeft = 0;
    scroll.scrollTop = 0;
    lightbox.dataset.zoomScale = "1";
  }

  function pointsAsArray() {
    return [...pointers.values()];
  }

  function distanceBetween(points) {
    return Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  }

  function centerBetween(points) {
    return {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    };
  }

  function beginPan(point) {
    pan = {
      x: point.x,
      y: point.y,
      scrollLeft: scroll.scrollLeft,
      scrollTop: scroll.scrollTop,
    };
    pinch = null;
  }

  function beginPinch() {
    const points = pointsAsArray().slice(0, 2);
    if (points.length < 2) return;
    const stage = getStage();
    const rect = stage.getBoundingClientRect();
    const center = centerBetween(points);
    sizedStage = stage;
    if (!baseWidth) baseWidth = rect.width / scale || scroll.clientWidth || 1;
    pinch = {
      distance: Math.max(1, distanceBetween(points)),
      startScale: scale,
      focalX: Math.min(1, Math.max(0, (center.x - rect.left) / Math.max(1, rect.width))),
      focalY: Math.min(1, Math.max(0, (center.y - rect.top) / Math.max(1, rect.height))),
    };
    pan = null;
  }

  function applyPinch() {
    if (!pinch) return;
    const points = pointsAsArray().slice(0, 2);
    if (points.length < 2) return;
    const center = centerBetween(points);
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE,
      pinch.startScale * distanceBetween(points) / pinch.distance));
    const stage = getStage();
    sizedStage = stage;
    stage.style.setProperty("width", `${baseWidth * nextScale}px`, "important");
    stage.style.setProperty("min-width", `${baseWidth * nextScale}px`);
    stage.classList.toggle("is-pinch-zoomed", nextScale > MIN_SCALE + .01);

    const resized = stage.getBoundingClientRect();
    scroll.scrollLeft += resized.left + resized.width * pinch.focalX - center.x;
    scroll.scrollTop += resized.top + resized.height * pinch.focalY - center.y;
    scale = nextScale;
    lightbox.dataset.zoomScale = scale.toFixed(2);
  }

  function isImageGesture(event) {
    if (!active || event.pointerType !== "touch") return false;
    const stage = getStage();
    return stage.contains(event.target) && !stage.classList.contains("is-drawing");
  }

  scroll.addEventListener("pointerdown", event => {
    if (!isImageGesture(event)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    scroll.setPointerCapture?.(event.pointerId);
    if (pointers.size === 1) beginPan(pointers.get(event.pointerId));
    else if (pointers.size === 2) beginPinch();
    event.preventDefault();
  }, { passive: false });

  scroll.addEventListener("pointermove", event => {
    if (!pointers.has(event.pointerId)) return;
    const point = { x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, point);
    if (pointers.size >= 2) {
      if (!pinch) beginPinch();
      applyPinch();
    } else if (pan) {
      scroll.scrollLeft = pan.scrollLeft - (point.x - pan.x);
      scroll.scrollTop = pan.scrollTop - (point.y - pan.y);
    }
    event.preventDefault();
  }, { passive: false });

  function finishPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (pointers.size === 1) beginPan(pointsAsArray()[0]);
    else if (!pointers.size) clearPointers();
  }

  scroll.addEventListener("pointerup", finishPointer);
  scroll.addEventListener("pointercancel", finishPointer);

  function setActive(value) {
    const next = Boolean(value);
    if (next === active) return;
    active = next;
    lightbox.classList.toggle("lightbox-zoom-active", active);
    if (active) requestAnimationFrame(() => { if (active) resetZoom(); });
    else resetZoom();
  }

  image.addEventListener("load", () => {
    if (active && scale === MIN_SCALE) resetZoom();
  });

  window.LightboxZoom = { setActive };
  setActive(!lightbox.hidden);
  new MutationObserver(() => setActive(!lightbox.hidden)).observe(lightbox, {
    attributes: true,
    attributeFilter: ["hidden"],
  });
})();
