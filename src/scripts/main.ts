import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { initHeroCanvas } from "./heroCanvas";
import { initRiding } from "./riding";
import { initPhotoGallery } from "./photoGallery";
import { initPhotoLightbox, PHOTO_VIEWER_EVENT } from "./photoLightbox";

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) =>
  root.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(s));

/** テキストを1文字ずつ span に分割 */
function splitChars(el: HTMLElement, className = "char") {
  const text = el.textContent ?? "";
  el.setAttribute("aria-label", text);
  el.textContent = "";
  return Array.from(text).map((ch) => {
    const span = document.createElement("span");
    span.className = className;
    span.setAttribute("aria-hidden", "true");
    span.style.display = "inline-block";
    span.textContent = ch === " " ? " " : ch;
    el.appendChild(span);
    return span;
  });
}

// ---------------------------------------------------------------- smooth scroll
let lenis: Lenis | null = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis!.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// 写真の切り替えによる高さの変化を反映してから、新しい旅行先へ移動する。
window.addEventListener("travel:opened", (event) => {
  const entry = (event as CustomEvent<HTMLElement>).detail;
  const navBottom = document.querySelector("header.nav")?.getBoundingClientRect().bottom ?? 0;
  const top = Math.max(0, window.scrollY + entry.getBoundingClientRect().top - navBottom - 16);
  if (lenis) {
    lenis.resize();
    lenis.scrollTo(top, { duration: 0.8, force: true });
  } else {
    window.scrollTo({ top, behavior: "instant" });
  }
});

// アンカーリンク（#xxx / 同じページの /#xxx）は Lenis 経由でスクロール
$$<HTMLAnchorElement>('a[href^="#"], a[href^="/#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = new URL(a.href);
    if (url.pathname !== location.pathname || url.search !== location.search) return; // 別ページなら普通に遷移
    const target = url.hash ? $<HTMLElement>(url.hash) : null;
    if (!target) return;
    e.preventDefault();
    if (location.hash !== url.hash) history.pushState(null, "", url.hash);
    const focusTarget = () => {
      if (!target.hasAttribute("tabindex")) {
        target.setAttribute("tabindex", "-1");
        target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
      }
      target.focus({ preventScroll: true });
    };
    // Lenis とブラウザーの両方が CSS の scroll-margin-top を参照する。
    if (lenis) lenis.scrollTo(target, { duration: 1.4, onComplete: focusTarget });
    else {
      target.scrollIntoView();
      focusTarget();
    }
  });
});

// ---------------------------------------------------------------- hero
const heroCanvas = $<HTMLCanvasElement>(".hero-canvas");
if (heroCanvas) initHeroCanvas(heroCanvas, reduced);

const typing = $("[data-typing]");
const hero = $(".hero");

if (reduced) {
  if (typing) typing.textContent = typing.dataset.typing ?? "";
} else if (hero) {
  const lines = $$("[data-split]");
  const chars = lines.flatMap((l) => {
    const c = splitChars(l);
    // グラデーション文字は親の背景を引き継げないので各文字に付け直す
    if (l.classList.contains("grad-text")) {
      l.classList.remove("grad-text");
      c.forEach((s) => s.classList.add("grad-text"));
    }
    return c;
  });

  const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
  tl.from(chars, { yPercent: 115, rotate: 8, duration: 1.4, stagger: 0.035 }, 0.2)
    .from("[data-hero-fade]", { autoAlpha: 0, y: 16, duration: 1, stagger: 0.12 }, 0.6)
    .from(".blob", { scale: 0.4, autoAlpha: 0, duration: 2.2, stagger: 0.2 }, 0);

  // タイピング演出
  if (typing) {
    const full = typing.dataset.typing ?? "";
    typing.textContent = "";
    const state = { n: 0 };
    tl.to(
      state,
      {
        n: full.length,
        duration: full.length * 0.06,
        ease: "none",
        onUpdate: () => (typing.textContent = full.slice(0, Math.round(state.n))),
      },
      1.1,
    );
  }

  // スクロールでヒーローが奥へ抜けていく
  gsap.to(".hero-inner", {
    yPercent: -30,
    autoAlpha: 0,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
  });
  gsap.to(".hero-canvas", {
    scale: 1.15,
    autoAlpha: 0.2,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
  });

  // 背景の blob はマウスにゆるく追従
  const b1x = gsap.quickTo(".blob-1", "x", { duration: 1.6, ease: "power3" });
  const b1y = gsap.quickTo(".blob-1", "y", { duration: 1.6, ease: "power3" });
  const b2x = gsap.quickTo(".blob-2", "x", { duration: 2.2, ease: "power3" });
  const b2y = gsap.quickTo(".blob-2", "y", { duration: 2.2, ease: "power3" });
  hero.addEventListener("pointermove", (e) => {
    const nx = e.clientX / window.innerWidth - 0.5;
    const ny = e.clientY / window.innerHeight - 0.5;
    b1x(nx * -80);
    b1y(ny * -60);
    b2x(nx * 60);
    b2y(ny * 50);
  });
}

// ---------------------------------------------------------------- progress bar
gsap.to(".progress span", {
  scaleX: 1,
  ease: "none",
  scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
});

if (!reduced) {
  // ---------------------------------------------------------------- section titles
  $$(".section-head").forEach((head) => {
    gsap.from(head.children, {
      y: 60,
      autoAlpha: 0,
      duration: 1.1,
      ease: "expo.out",
      stagger: 0.08,
      scrollTrigger: { trigger: head, start: "top 85%" },
    });
  });

  // ---------------------------------------------------------------- generic reveal
  ScrollTrigger.batch("[data-reveal]", {
    start: "top 88%",
    once: true,
    onEnter: (els) =>
      gsap.fromTo(
        els,
        { autoAlpha: 0, y: 40 },
        { autoAlpha: 1, y: 0, duration: 1, ease: "expo.out", stagger: 0.08, overwrite: true },
      ),
  });

  // ---------------------------------------------------------------- intro text (scroll highlight)
  $$("[data-words]").forEach((el) => {
    const chars = splitChars(el, "w");
    chars.forEach((c) => (c.style.display = "inline"));
    gsap.fromTo(
      chars,
      { opacity: 0.15 },
      {
        opacity: 1,
        stagger: 0.02,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 45%", scrub: true },
      },
    );
  });

  // ---------------------------------------------------------------- timeline line
  if ($(".timeline")) {
    gsap.to(".timeline-fill", {
      scaleY: 1,
      ease: "none",
      scrollTrigger: { trigger: ".timeline", start: "top 70%", end: "bottom 60%", scrub: true },
    });
  }
  $$(".tl-node").forEach((node) => {
    gsap.from(node, {
      scale: 0,
      duration: 0.6,
      ease: "back.out(3)",
      scrollTrigger: { trigger: node, start: "top 70%" },
    });
  });

  // ---------------------------------------------------------------- magnetic buttons
  $$("[data-magnetic]").forEach((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.15);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.25);
    });
    el.addEventListener("pointerleave", () => {
      xTo(0);
      yTo(0);
    });
  });
}

// ---------------------------------------------------------------- 画面外の CSS アニメーションを停止
const animObserver = new IntersectionObserver((entries) => {
  for (const e of entries) e.target.classList.toggle("anim-paused", !e.isIntersecting);
});
$$("[data-anim-scope]").forEach((el) => animObserver.observe(el));

// ---------------------------------------------------------------- skill cards
// カーソル位置に光を当てる
$$("[data-spotlight]").forEach((grid) => {
  const cards = $$("[data-skill-card]", grid);
  grid.addEventListener("pointermove", (e) => {
    cards.forEach((card) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });
});
// ホバーできる端末だけホバーで切り替え（タッチ端末で :hover が残り続けるのを防ぐ）
document.documentElement.classList.toggle("can-hover", window.matchMedia("(hover: hover)").matches);
// タップ / Enter でタグ表示を切り替え（ホバーできない端末向け）
$$("[data-skill-card]").forEach((card) => {
  const toggle = () => card.classList.toggle("is-open");
  card.addEventListener("click", toggle);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  });
});

// ---------------------------------------------------------------- copy to clipboard
$$<HTMLButtonElement>("[data-copy]").forEach((btn) => {
  const label = btn.textContent;
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy ?? "");
      btn.textContent = "copied ✓";
    } catch {
      btn.textContent = "failed";
    }
    setTimeout(() => (btn.textContent = label), 1600);
  });
});

// ---------------------------------------------------------------- independent photo gallery
initPhotoLightbox();
initPhotoGallery();
document.addEventListener(PHOTO_VIEWER_EVENT, () => {
  if (document.querySelector<HTMLDialogElement>("[data-photo-lightbox]")?.open) lenis?.stop();
  else lenis?.start();
});

// ---------------------------------------------------------------- riding
initRiding(reduced);

// ---------------------------------------------------------------- globe (近づいたら読み込み)
const globeCanvas = $<HTMLCanvasElement>("[data-globe]");
if (globeCanvas) {
  const io = new IntersectionObserver(
    async ([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const { initGlobe } = await import("./globe");
      initGlobe(globeCanvas, reduced);
    },
    { rootMargin: "600px 0px" },
  );
  io.observe(globeCanvas);
}

// フォントや画像の読み込みでレイアウトが変わったら再計算
window.addEventListener("load", () => ScrollTrigger.refresh());
