(() => {
  "use strict";

  // トップページの要素を、スクロールで表示領域へ入った順にフェード表示する。
  // 動きを減らす端末設定ではアニメーションせず、最初からすべて表示する。
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    items.forEach(item => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -5%" });

  items.forEach(item => observer.observe(item));
})();
