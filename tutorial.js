(() => {
  "use strict";

  // 画面3を初めて訪れた時だけ表示する操作チュートリアル。
  // 対象要素をスポットライトで示し、画面端を避けて説明カードを配置する。
  if (document.body.dataset.gameScreen !== "3") return;

  const STORAGE_KEY = "extinctionEscape.screen3Tutorial.v1";
  const forceTutorial = new URLSearchParams(location.search).get("tutorial") === "1";
  try {
    if (!forceTutorial && localStorage.getItem(STORAGE_KEY) === "complete") return;
  } catch (_) {}

  const steps = [
    {
      selector: ".game-progress__screens",
      title: "ミッションログ",
      description: "画面上部には、到達したステップが順番に追加されます。ボタンを押すと、過去のステップを見返すことができます。",
    },
    {
      selector: ".game-progress__menu-button",
      title: "メニューボタン",
      description: "「ヒント」からヒントを確認できます。「最初から遊ぶ」では、保存された進行状況をリセットできます。",
    },
    {
      selector: ".trajectory-launch",
      title: "軌道予測ボタン",
      description: "地球と隕石の動きを確認できます。表示された地球をドラッグすると、隕石が衝突するまでの時間を確かめられます。",
    },
    {
      selector: ".inventory-launch",
      title: "備品ケースボタン",
      description: "ケース内のアイテムを確認できます。各アイテムは自由に動かすことができ、アイテムによって行える操作が異なる場合があります。",
    },
    {
      selector: null,
      demo: "annotation",
      title: "画像への書き込み",
      description: "ペンを選ぶと、問題や資料の画像へ直接文字や線を書き込めます。消しゴムはなぞった線を消し、全消去はその画像の書き込みをすべて削除します。",
    },
    {
      selector: ".robot-launch",
      title: "ロボボタン",
      description: "ロボとコミュニケーションを取ることができます。謎の答えや、気になった言葉を入力してみてください。",
    },
    {
      selector: ".game-progress__menu-button",
      title: "チュートリアルをもう一度見る",
      description: "このチュートリアルはメニューボタンからも再度確認することができます。",
    },
  ].filter(step => !step.selector || document.querySelector(step.selector));

  if (!steps.length) return;

  const tutorial = document.createElement("section");
  tutorial.className = "screen-tutorial";
  tutorial.setAttribute("aria-label", "第3画面の操作チュートリアル");
  tutorial.innerHTML = `
    <div class="screen-tutorial__shade" data-shade="top"></div>
    <div class="screen-tutorial__shade" data-shade="left"></div>
    <div class="screen-tutorial__shade" data-shade="right"></div>
    <div class="screen-tutorial__shade" data-shade="bottom"></div>
    <div class="screen-tutorial__focus" aria-hidden="true"></div>
    <svg class="screen-tutorial__arrow" aria-hidden="true"><defs><marker id="tutorial-arrow-head" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#43dbff"/></marker></defs><line marker-end="url(#tutorial-arrow-head)"/></svg>
    <div class="screen-tutorial__card" role="dialog" aria-modal="true" aria-labelledby="screen-tutorial-title" aria-describedby="screen-tutorial-description">
      <p class="screen-tutorial__eyebrow">OPERATION GUIDE <span></span></p>
      <h2 id="screen-tutorial-title"></h2>
      <p class="screen-tutorial__description" id="screen-tutorial-description"></p>
      <div class="screen-tutorial__demo" data-tutorial-demo="annotation" hidden aria-label="書き込み操作ボタンの見本">
        <span><i aria-hidden="true">✎</i><b>ペン</b></span>
        <span><i aria-hidden="true">◇</i><b>消しゴム</b></span>
        <span class="is-clear"><i aria-hidden="true">✦</i><b>全消去</b></span>
      </div>
      <div class="screen-tutorial__progress" aria-hidden="true"></div>
      <div class="screen-tutorial__actions">
        <button class="screen-tutorial__back" type="button">戻る</button>
        <button class="screen-tutorial__skip" type="button">スキップ</button>
        <button class="screen-tutorial__next" type="button">次へ →</button>
      </div>
    </div>
  `;

  document.body.append(tutorial);
  document.body.classList.add("screen-tutorial-open");

  const shades = Object.fromEntries([...tutorial.querySelectorAll("[data-shade]")].map(node => [node.dataset.shade, node]));
  const focus = tutorial.querySelector(".screen-tutorial__focus");
  const arrow = tutorial.querySelector(".screen-tutorial__arrow line");
  const card = tutorial.querySelector(".screen-tutorial__card");
  const eyebrowCount = tutorial.querySelector(".screen-tutorial__eyebrow span");
  const title = tutorial.querySelector("#screen-tutorial-title");
  const description = tutorial.querySelector("#screen-tutorial-description");
  const annotationDemo = tutorial.querySelector('[data-tutorial-demo="annotation"]');
  const progress = tutorial.querySelector(".screen-tutorial__progress");
  const backButton = tutorial.querySelector(".screen-tutorial__back");
  const skipButton = tutorial.querySelector(".screen-tutorial__skip");
  const nextButton = tutorial.querySelector(".screen-tutorial__next");
  let currentIndex = 0;
  progress.style.setProperty("--tutorial-step-count", String(steps.length));

  function setRect(node, left, top, width, height) {
    Object.assign(node.style, {
      left: `${Math.max(0, left)}px`,
      top: `${Math.max(0, top)}px`,
      width: `${Math.max(0, width)}px`,
      height: `${Math.max(0, height)}px`,
    });
  }

  function nearestPointOnCard(targetX, targetY, rect) {
    const x = Math.min(Math.max(targetX, rect.left), rect.right);
    const y = Math.min(Math.max(targetY, rect.top), rect.bottom);
    const distances = [
      { x, y: rect.top, distance: Math.abs(targetY - rect.top) },
      { x: rect.right, y, distance: Math.abs(targetX - rect.right) },
      { x, y: rect.bottom, distance: Math.abs(targetY - rect.bottom) },
      { x: rect.left, y, distance: Math.abs(targetX - rect.left) },
    ];
    return distances.sort((a, b) => a.distance - b.distance)[0];
  }

  // 対象の位置と画面サイズから、カード・矢印・スポットライトを再配置する。
  function positionTutorial() {
    const step = steps[currentIndex];
    const target = step.selector ? document.querySelector(step.selector) : null;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;

    if (!target) {
      setRect(shades.top, 0, 0, viewportWidth, viewportHeight);
      setRect(shades.left, 0, 0, 0, 0);
      setRect(shades.right, 0, 0, 0, 0);
      setRect(shades.bottom, 0, 0, 0, 0);
      focus.hidden = true;
      arrow.closest("svg").hidden = true;
      const cardWidth = Math.min(500, viewportWidth - margin * 2);
      card.style.width = `${cardWidth}px`;
      card.style.left = `${Math.max(margin, (viewportWidth - cardWidth) / 2)}px`;
      card.style.top = `${margin}px`;
      const cardHeight = Math.min(card.offsetHeight, viewportHeight - margin * 2);
      card.style.top = `${Math.max(margin, (viewportHeight - cardHeight) / 2)}px`;
      return;
    }

    focus.hidden = false;
    arrow.closest("svg").hidden = false;
    const targetRect = target.getBoundingClientRect();
    const padding = 8;
    const hole = {
      left: Math.max(7, targetRect.left - padding),
      top: Math.max(7, targetRect.top - padding),
      right: Math.min(viewportWidth - 7, targetRect.right + padding),
      bottom: Math.min(viewportHeight - 7, targetRect.bottom + padding),
    };
    hole.width = hole.right - hole.left;
    hole.height = hole.bottom - hole.top;

    setRect(shades.top, 0, 0, viewportWidth, hole.top);
    setRect(shades.left, 0, hole.top, hole.left, hole.height);
    setRect(shades.right, hole.right, hole.top, viewportWidth - hole.right, hole.height);
    setRect(shades.bottom, 0, hole.bottom, viewportWidth, viewportHeight - hole.bottom);
    setRect(focus, hole.left, hole.top, hole.width, hole.height);

    const gap = 30;
    const cardWidth = Math.min(420, viewportWidth - margin * 2);
    card.style.width = `${cardWidth}px`;
    card.style.left = `${margin}px`;
    card.style.top = `${margin}px`;
    const cardHeight = card.offsetHeight;
    let cardLeft;
    let cardTop;

    if (hole.bottom + gap + cardHeight <= viewportHeight - margin) {
      cardLeft = Math.min(Math.max(margin, hole.left + hole.width / 2 - cardWidth / 2), viewportWidth - cardWidth - margin);
      cardTop = hole.bottom + gap;
    } else if (hole.top - gap - cardHeight >= margin) {
      cardLeft = Math.min(Math.max(margin, hole.left + hole.width / 2 - cardWidth / 2), viewportWidth - cardWidth - margin);
      cardTop = hole.top - gap - cardHeight;
    } else if (hole.left - gap - cardWidth >= margin) {
      cardLeft = hole.left - gap - cardWidth;
      cardTop = Math.min(Math.max(margin, hole.top + hole.height / 2 - cardHeight / 2), viewportHeight - cardHeight - margin);
    } else {
      cardLeft = Math.min(viewportWidth - cardWidth - margin, hole.right + gap);
      cardTop = Math.min(Math.max(margin, hole.top + hole.height / 2 - cardHeight / 2), viewportHeight - cardHeight - margin);
    }

    card.style.left = `${Math.max(margin, cardLeft)}px`;
    card.style.top = `${Math.max(margin, cardTop)}px`;

    const finalCardRect = card.getBoundingClientRect();
    const targetX = hole.left + hole.width / 2;
    const targetY = hole.top + hole.height / 2;
    const start = nearestPointOnCard(targetX, targetY, finalCardRect);
    arrow.setAttribute("x1", String(start.x));
    arrow.setAttribute("y1", String(start.y));
    arrow.setAttribute("x2", String(targetX));
    arrow.setAttribute("y2", String(targetY));
  }

  function showStep(index) {
    currentIndex = Math.min(Math.max(index, 0), steps.length - 1);
    const step = steps[currentIndex];
    eyebrowCount.textContent = `${String(currentIndex + 1).padStart(2, "0")} / ${String(steps.length).padStart(2, "0")}`;
    title.textContent = step.title;
    description.textContent = step.description;
    annotationDemo.hidden = step.demo !== "annotation";
    progress.innerHTML = steps.map((_, index) => `<i class="${index < currentIndex ? "is-complete" : index === currentIndex ? "is-current" : ""}"></i>`).join("");
    backButton.disabled = currentIndex === 0;
    backButton.hidden = currentIndex === 0;
    nextButton.textContent = currentIndex === steps.length - 1 ? "ゲームを始める" : "次へ →";
    requestAnimationFrame(positionTutorial);
  }

  // 完了状態を保存し、次回以降はチュートリアルを自動表示しない。
  function finishTutorial() {
    try { localStorage.setItem(STORAGE_KEY, "complete"); } catch (_) {}
    document.body.classList.remove("screen-tutorial-open");
    window.removeEventListener("resize", positionTutorial);
    window.removeEventListener("scroll", positionTutorial, true);
    tutorial.remove();
  }

  backButton.addEventListener("click", () => showStep(currentIndex - 1));
  nextButton.addEventListener("click", () => currentIndex === steps.length - 1 ? finishTutorial() : showStep(currentIndex + 1));
  skipButton.addEventListener("click", finishTutorial);
  tutorial.addEventListener("keydown", event => {
    if (event.key === "Escape") finishTutorial();
    if (event.key === "ArrowRight") nextButton.click();
    if (event.key === "ArrowLeft" && currentIndex > 0) backButton.click();
  });
  window.addEventListener("resize", positionTutorial);
  window.addEventListener("scroll", positionTutorial, true);

  showStep(0);
  nextButton.focus();
})();
