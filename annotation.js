(() => {
  "use strict";

  // 謎画像への手書きメモ機能。画像ごとの筆跡を保存し、通常表示と拡大表示で共有する。
  const STORAGE_KEY = "extinctionEscape.annotations.v1";
  const MAX_CANVAS_SIZE = 2200;
  const surfaces = new Set();
  let stored = readStored();

  function readStored() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch (_) { return {}; }
  }

  function saveStored() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stored)); } catch (_) {}
  }

  // 同じ画像を別の相対URLから開いても同じメモを参照できるよう、パスだけをキーにする。
  function imageKey(source) {
    if (!source) return "";
    try {
      const url = new URL(source, location.href);
      return `${url.pathname}${url.search}`;
    } catch (_) { return source; }
  }

  function createToolbar(label, lightbox = false) {
    const toolbar = document.createElement("div");
    toolbar.className = `annotation-toolbar${lightbox ? " annotation-toolbar--lightbox" : ""}`;
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", `${label}への書き込み操作`);
    toolbar.innerHTML = `
      <button type="button" data-annotation-mode="pen" aria-pressed="false" title="ペンで書き込む"><i aria-hidden="true">✎</i><span>ペン</span></button>
      <button type="button" data-annotation-mode="eraser" aria-pressed="false" title="なぞった部分を消す"><i aria-hidden="true">◇</i><span>消しゴム</span></button>
      <button class="annotation-finish" type="button" data-annotation-finish hidden title="書き込みを終了する"><i aria-hidden="true">✓</i><span>書き込み終了</span></button>
      <button class="annotation-clear" type="button" data-annotation-clear title="この画像の書き込みをすべて消す"><i aria-hidden="true">✦</i><span>全消去</span></button>`;
    return toolbar;
  }

  // 1枚の画像に重なるcanvasとツールバーをひとまとめに管理する。
  class AnnotationSurface {
    constructor(image, stage, toolbar, source) {
      this.image = image;
      this.stage = stage;
      this.toolbar = toolbar;
      this.canvas = document.createElement("canvas");
      this.canvas.className = "annotation-canvas";
      this.canvas.setAttribute("aria-label", `${image.alt || "画像"}の書き込み領域`);
      this.stage.append(this.canvas);
      this.context = this.canvas.getContext("2d");
      this.key = imageKey(source);
      this.mode = "";
      this.currentStroke = null;
      this.pointerId = null;
      this.bind();
      this.resizeAndRender();
      surfaces.add(this);
    }

    get strokes() {
      if (!this.key) return [];
      if (!Array.isArray(stored[this.key])) stored[this.key] = [];
      return stored[this.key];
    }

    setSource(source) {
      this.key = imageKey(source);
      this.setMode("");
      if (!this.key) this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.resizeAndRender();
    }

    bind() {
      this.image.addEventListener("load", () => this.resizeAndRender());
      this.toolbar.querySelectorAll("[data-annotation-mode]").forEach(button => {
        button.addEventListener("click", () => this.setMode(this.mode === button.dataset.annotationMode ? "" : button.dataset.annotationMode));
      });
      this.toolbar.querySelector("[data-annotation-finish]").addEventListener("click", () => this.setMode(""));
      this.toolbar.querySelector("[data-annotation-clear]").addEventListener("click", () => {
        if (!this.key || !this.strokes.length) return;
        if (!window.confirm("この画像への書き込みをすべて消しますか？")) return;
        delete stored[this.key];
        saveStored();
        renderMatching(this.key);
        this.setStatus("書き込みをすべて削除しました");
      });
      this.canvas.addEventListener("pointerdown", event => this.startStroke(event));
      this.canvas.addEventListener("pointermove", event => this.continueStroke(event));
      this.canvas.addEventListener("pointerup", event => this.endStroke(event));
      this.canvas.addEventListener("pointercancel", event => this.endStroke(event));
      this.canvas.addEventListener("click", event => {
        if (!this.mode) return;
        event.preventDefault();
        event.stopPropagation();
      });
    }

    setStatus(message) {
      this.toolbar.setAttribute("aria-label", message);
    }

    setMode(mode) {
      this.mode = mode;
      this.stage.classList.toggle("is-drawing", Boolean(mode));
      this.stage.classList.toggle("is-erasing", mode === "eraser");
      this.toolbar.classList.toggle("is-active", Boolean(mode));
      this.toolbar.querySelectorAll("[data-annotation-mode]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.annotationMode === mode)));
      this.toolbar.querySelector("[data-annotation-finish]").hidden = !mode;
      this.setStatus(mode === "pen" ? "ペンモード：ドラッグまたはスワイプして書き込めます" : mode === "eraser" ? "消しゴムモード：消したい線の上をなぞってください" : "ペンを選ぶと画像へ直接書き込めます");
    }

    pointFromEvent(event) {
      const rect = this.canvas.getBoundingClientRect();
      const normalize = value => Number(Math.min(1, Math.max(0, value)).toFixed(4));
      return {
        x: normalize((event.clientX - rect.left) / rect.width),
        y: normalize((event.clientY - rect.top) / rect.height),
      };
    }

    startStroke(event) {
      if (!this.mode || !this.key) return;
      event.preventDefault();
      event.stopPropagation();
      this.pointerId = event.pointerId;
      this.canvas.setPointerCapture?.(event.pointerId);
      this.currentStroke = { tool: this.mode, points: [this.pointFromEvent(event)] };
    }

    continueStroke(event) {
      if (!this.currentStroke || event.pointerId !== this.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const next = this.pointFromEvent(event);
      const points = this.currentStroke.points;
      const previous = points[points.length - 1];
      if (Math.hypot(next.x - previous.x, next.y - previous.y) < .0015) return;
      points.push(next);
      this.drawStroke({ tool: this.currentStroke.tool, points: [previous, next] });
    }

    endStroke(event) {
      if (!this.currentStroke || event.pointerId !== this.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      if (this.currentStroke.points.length === 1) this.currentStroke.points.push(this.currentStroke.points[0]);
      this.strokes.push(this.currentStroke);
      this.currentStroke = null;
      this.pointerId = null;
      saveStored();
      renderMatching(this.key, this);
    }

    // 表示倍率が変わっても筆跡の位置がずれないよう、点は0〜1の相対座標で保持する。
    resizeAndRender() {
      if (!this.image.complete || !this.image.naturalWidth || !this.image.naturalHeight) return;
      const scale = Math.min(1, MAX_CANVAS_SIZE / Math.max(this.image.naturalWidth, this.image.naturalHeight));
      const width = Math.max(1, Math.round(this.image.naturalWidth * scale));
      const height = Math.max(1, Math.round(this.image.naturalHeight * scale));
      if (this.canvas.width !== width) this.canvas.width = width;
      if (this.canvas.height !== height) this.canvas.height = height;
      this.render();
    }

    drawStroke(stroke) {
      const points = stroke.points || [];
      if (!points.length) return;
      const ctx = this.context;
      const base = Math.min(this.canvas.width, this.canvas.height);
      ctx.save();
      ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
      ctx.strokeStyle = "#d8212a";
      ctx.lineWidth = base * (stroke.tool === "eraser" ? .038 : .006);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(points[0].x * this.canvas.width, points[0].y * this.canvas.height);
      points.slice(1).forEach(point => ctx.lineTo(point.x * this.canvas.width, point.y * this.canvas.height));
      ctx.stroke();
      if (points.length === 1 || points.every(point => point.x === points[0].x && point.y === points[0].y)) {
        ctx.fillStyle = stroke.tool === "eraser" ? "rgba(0,0,0,1)" : "#d8212a";
        ctx.beginPath();
        ctx.arc(points[0].x * this.canvas.width, points[0].y * this.canvas.height, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    render() {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.strokes.forEach(stroke => this.drawStroke(stroke));
    }
  }

  // 同じ画像を開いている別ビュー（一覧／ライトボックス）にも変更を即時反映する。
  function renderMatching(key, excluded = null) {
    surfaces.forEach(surface => {
      if (surface !== excluded && surface.key === key) surface.render();
    });
  }

  function wrapInlineButton(button) {
    if (button.dataset.annotationReady === "true") return;
    const image = button.querySelector("img");
    if (!image) return;
    button.dataset.annotationReady = "true";
    const stage = document.createElement("span");
    stage.className = "annotation-stage";
    button.insertBefore(stage, image);
    stage.append(image);
    const answerOverlay = [...button.children].find(child => child.classList?.contains("answer-sheet-overlay"));
    if (answerOverlay) stage.append(answerOverlay);
    const label = button.dataset.lightboxLabel || image.alt || "画像";
    const toolbar = createToolbar(label);
    button.insertAdjacentElement("afterend", toolbar);
    new AnnotationSurface(image, stage, toolbar, button.dataset.lightboxSrc || image.getAttribute("src"));
  }

  function prepareLightbox() {
    const image = document.querySelector("#lightbox-image");
    if (!image) return;
    let stage = image.closest(".lightbox-image-stage");
    if (!stage) {
      stage = document.createElement("div");
      stage.className = "annotation-stage annotation-stage--lightbox";
      image.parentNode.insertBefore(stage, image);
      stage.append(image);
    } else {
      stage.classList.add("annotation-stage", "annotation-stage--lightbox");
    }
    const toolbar = createToolbar("拡大画像", true);
    const scroll = stage.closest(".lightbox-scroll");
    const lightboxWindow = scroll?.closest(".lightbox-window");
    if (scroll && lightboxWindow) {
      // ツールバーを画像のスクロール領域から分離し、初回表示時も確実に描画する。
      lightboxWindow.classList.add("has-annotation-toolbar");
      lightboxWindow.insertBefore(toolbar, scroll);
    } else {
      stage.parentNode.insertBefore(toolbar, stage);
    }
    const surface = new AnnotationSurface(image, stage, toolbar, image.getAttribute("src"));
    const syncSource = () => surface.setSource(image.getAttribute("src") || "");
    new MutationObserver(syncSource).observe(image, { attributes: true, attributeFilter: ["src"] });
  }

  document.querySelectorAll("button[data-lightbox-src]").forEach(wrapInlineButton);
  prepareLightbox();

  window.AnnotationStore = {
    clearAll() {
      stored = {};
      saveStored();
      surfaces.forEach(surface => surface.render());
    },
  };
})();
