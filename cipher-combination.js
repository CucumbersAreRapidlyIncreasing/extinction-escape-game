(() => {
  "use strict";

  if (!window.GameProgress?.getState().screen6?.cipherTableReceived) return;

  const characters = [
    "イ","ゼ","ル","ダ","ン","リ","メ","ン","シ","カ","セ","ス","タ","キ",
    "ヘ","フ","サ","テ","リ","モ","ク","ア","ウ","キ","ゴ","ツ","ベ","ン",
    "ケ","ヲ","ム","ロ","テ","ミ","ヨ","ブ","ネ","ニ","ツ","ナ","ハ","ス",
    "ラ","ミ","ヤ","ゴ","パ","コ","サ"
  ];

  function mountCombination(detail) {
    const overview = detail.querySelector(".cipher-overview");
    if (!overview || detail.querySelector(".combine-open")) return;
    detail.classList.add("cipher-combination-detail");
    overview.insertAdjacentHTML("afterend", `
      <button class="combine-open" type="button">他のアイテムと使用する <span aria-hidden="true">＋</span></button>
      <section class="combine-chooser" hidden aria-label="一緒に使用するアイテムを選択">
        <header><small>SELECT EQUIPMENT</small><h4>一緒に使用するアイテムを選択</h4></header>
        <div>
          <button type="button" data-combine-item="box"><span class="combine-box-icon" aria-hidden="true">▲</span><strong>謎のブロック</strong></button>
          <button type="button" data-combine-item="pen"><span class="combine-pen-icon" aria-hidden="true"></span><strong>壊れた3色ボールペン</strong></button>
        </div>
        <p class="combine-feedback" aria-live="polite"></p>
      </section>
      <section class="cipher-workbench" hidden aria-label="暗号表と謎のブロック">
        <div class="workbench-heading">
          <div><small>ITEMS COMBINED</small><h4>暗号表 × 謎のブロック</h4></div>
          <div class="workbench-actions"><button type="button" data-cube-reset>初期配置に戻す</button><button type="button" data-combine-cancel>組み合わせを解除</button></div>
        </div>
        <p>ブロックをドラッグして開始マスを決め、方向ボタンで1マスずつ転がしてください。</p>
        <div class="cipher-grid-wrap"><div class="cipher-grid">${characters.map(character => `<span>${character}</span>`).join("")}<button class="cipher-cube is-yellow" type="button" aria-label="謎のブロック。ドラッグして移動"><i></i></button></div></div>
        <div class="roll-controls"><button type="button" data-roll="up" aria-label="上へ転がす">↑</button><div><button type="button" data-roll="left" aria-label="左へ転がす">←</button><button type="button" data-roll="down" aria-label="下へ転がす">↓</button><button type="button" data-roll="right" aria-label="右へ転がす">→</button></div></div>
        <p class="cube-position" aria-live="polite"></p>
      </section>
    `);

    const combineOpen = detail.querySelector(".combine-open");
    const chooser = detail.querySelector(".combine-chooser");
    const feedback = detail.querySelector(".combine-feedback");
    const workbench = detail.querySelector(".cipher-workbench");
    const grid = detail.querySelector(".cipher-grid");
    const cube = detail.querySelector(".cipher-cube");
    const positionOutput = detail.querySelector(".cube-position");
    const rollButtons = [...detail.querySelectorAll("[data-roll]")];
    let row = 3;
    let col = 3;
    let dragging = false;

    const initialFaces = () => [
      { yellow:true, n:[0,0,1], a:[0,1,0] }, { yellow:false, n:[0,0,-1], a:[0,-1,0] },
      { yellow:false, n:[0,1,0], a:[-1,0,0] }, { yellow:false, n:[0,-1,0], a:[1,0,0] },
      { yellow:false, n:[-1,0,0], a:[0,0,-1] }, { yellow:false, n:[1,0,0], a:[0,0,1] }
    ];
    let faces = initialFaces();

    function rotateVector([x,y,z], axis, quarter) {
      if (axis === "x") return quarter > 0 ? [x,-z,y] : [x,z,-y];
      return quarter > 0 ? [z,y,-x] : [-z,y,x];
    }
    function rotateCube(axis, quarter) {
      faces = faces.map(face => ({ ...face, n:rotateVector(face.n, axis, quarter), a:rotateVector(face.a, axis, quarter) }));
    }
    function renderCube() {
      cube.style.setProperty("--cube-row", row);
      cube.style.setProperty("--cube-col", col);
      const top = faces.find(face => face.n[2] === 1);
      cube.classList.toggle("is-yellow", top.yellow);
      cube.style.setProperty("--triangle-rotation", `${Math.round(Math.atan2(top.a[0], top.a[1]) * 180 / Math.PI)}deg`);
      positionOutput.textContent = `配置：上から ${row + 1} 行目・左から ${col + 1} 列目`;
      rollButtons.forEach(button => {
        const direction = button.dataset.roll;
        button.disabled = (direction === "up" && row === 0) || (direction === "down" && row === 6) || (direction === "left" && col === 0) || (direction === "right" && col === 6);
      });
    }
    function resetCube() {
      row = 3;
      col = 3;
      faces = initialFaces();
      renderCube();
    }
    function resetCombination() {
      chooser.hidden = true;
      workbench.hidden = true;
      overview.hidden = false;
      combineOpen.hidden = false;
      feedback.textContent = "";
      resetCube();
    }

    combineOpen.addEventListener("click", () => {
      chooser.hidden = false;
      combineOpen.hidden = true;
      feedback.textContent = "";
      chooser.querySelector('[data-combine-item="box"]').focus();
    });
    detail.querySelector('[data-combine-item="box"]').addEventListener("click", () => {
      chooser.hidden = true;
      overview.hidden = true;
      workbench.hidden = false;
      resetCube();
    });
    detail.querySelector('[data-combine-item="pen"]').addEventListener("click", () => {
      feedback.textContent = "このアイテムとは組み合わせられないようだ";
    });
    detail.querySelector("[data-cube-reset]").addEventListener("click", resetCube);
    detail.querySelector("[data-combine-cancel]").addEventListener("click", resetCombination);

    const rolls = {
      up:{ dr:-1, dc:0, axis:"x", quarter:-1 }, down:{ dr:1, dc:0, axis:"x", quarter:1 },
      left:{ dr:0, dc:-1, axis:"y", quarter:-1 }, right:{ dr:0, dc:1, axis:"y", quarter:1 }
    };
    rollButtons.forEach(button => button.addEventListener("click", () => {
      const move = rolls[button.dataset.roll];
      const nextRow = row + move.dr;
      const nextCol = col + move.dc;
      if (nextRow < 0 || nextRow > 6 || nextCol < 0 || nextCol > 6) return;
      row = nextRow;
      col = nextCol;
      rotateCube(move.axis, move.quarter);
      renderCube();
    }));

    function dragTo(clientX, clientY) {
      const rect = grid.getBoundingClientRect();
      col = Math.max(0, Math.min(6, Math.floor((clientX - rect.left) / (rect.width / 7))));
      row = Math.max(0, Math.min(6, Math.floor((clientY - rect.top) / (rect.height / 7))));
      renderCube();
    }
    cube.addEventListener("pointerdown", event => {
      dragging = true;
      cube.classList.add("is-dragging");
      cube.setPointerCapture?.(event.pointerId);
      dragTo(event.clientX, event.clientY);
      event.preventDefault();
    });
    cube.addEventListener("pointermove", event => { if (dragging) dragTo(event.clientX, event.clientY); });
    cube.addEventListener("pointerup", event => {
      dragging = false;
      cube.classList.remove("is-dragging");
      cube.releasePointerCapture?.(event.pointerId);
    });
    cube.addEventListener("pointercancel", () => {
      dragging = false;
      cube.classList.remove("is-dragging");
    });
    detail.addEventListener("ciphercombinationreset", resetCombination);
    resetCube();
  }

  const cipherItem = document.querySelector("#cipher-item");
  const emptySlot = document.querySelector("#inventory-empty-slot");
  const inventoryCount = document.querySelector("#inventory-count, .inventory-count strong");
  const inventoryBadge = document.querySelector("#inventory-badge, #inventory-open > i");
  if (cipherItem) cipherItem.hidden = false;
  if (emptySlot) emptySlot.hidden = true;
  if (inventoryCount) inventoryCount.textContent = "3";
  if (inventoryBadge) inventoryBadge.textContent = "03";

  document.querySelectorAll("#cipher-detail").forEach(mountCombination);
  document.addEventListener("click", event => {
    if (event.target.closest("[data-detail-back], [data-close-inventory]")) document.querySelector("#cipher-detail")?.dispatchEvent(new Event("ciphercombinationreset"));
  });
})();
