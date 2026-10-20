// 趣味：バイクのモーショングラフィック
// - 画面に入ると線画が描かれ、塗りが入って走り出す
// - 走行中のループ（車輪・道路・山・スピード線・排気）は 1 つの「速度」でまとめて制御
// - スクロールの速さで加速、ホバーで空ぶかし（ウイリー気味に）
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function initRiding(reduced: boolean) {
  const scene = document.querySelector<HTMLElement>("[data-ride-scene]");
  if (!scene) return;
  const $$ = <T extends Element>(s: string, root: ParentNode = scene) => Array.from(root.querySelectorAll<T>(s));

  const lines = $$<SVGGeometryElement>(".bk-line");
  const fills = $$<SVGElement>(".bk-fill");
  const bikeEl = scene.querySelector<HTMLElement>("[data-bk-bike]")!;

  initMeters(reduced);

  if (reduced) {
    gsap.set(fills, { opacity: 1 });
    return;
  }

  // ------------------------------------------------ 走行ループ
  const loops: gsap.core.Animation[] = [];
  const loop = (a: gsap.core.Animation) => {
    loops.push(a);
    return a;
  };

  // どれも transform / opacity だけを動かす（GPU で処理され、再描画が起きない）
  $$<SVGSVGElement>("[data-bk-wheel]").forEach((w) => {
    loop(gsap.to(w, { rotation: 360, duration: 0.5, ease: "none", repeat: -1 }));
  });
  // 破線 1 周期（70 / 1600）ぶんずらしてループ
  loop(gsap.to("[data-bk-dash]", { xPercent: (-70 / 1600) * 100, duration: 0.25, ease: "none", repeat: -1 }));
  loop(gsap.to('[data-bk-layer="far"]', { xPercent: -50, duration: 40, ease: "none", repeat: -1 }));
  loop(gsap.to('[data-bk-layer="near"]', { xPercent: -50, duration: 12, ease: "none", repeat: -1 }));
  $$<HTMLElement>("[data-bk-speedline]").forEach((l, i) => {
    loop(
      gsap.fromTo(
        l,
        { xPercent: 0 },
        { xPercent: -130, duration: 0.7 + (i % 3) * 0.25, ease: "none", repeat: -1, delay: -i * 0.23 },
      ),
    );
  });
  $$<HTMLElement>("[data-bk-puff]").forEach((c, i) => {
    loop(
      gsap.fromTo(
        c,
        { xPercent: 0, yPercent: 0, scale: 0.5, opacity: 0.8 },
        { xPercent: -500, yPercent: -90, scale: 2.2, opacity: 0, duration: 0.9, ease: "power1.out", repeat: -1, delay: -i * 0.22 },
      ),
    );
  });
  // 車体の小さな上下動
  loop(gsap.to(bikeEl, { y: -2.5, duration: 0.18, ease: "sine.inOut", yoyo: true, repeat: -1 }));

  // 速度：0 = 停止、1 = 巡航。ループの timeScale にまとめて反映
  const speed = { base: 0, boost: 0 };
  const apply = () => {
    const v = speed.base + speed.boost;
    loops.forEach((l) => l.timeScale(Math.max(0.0001, v)));
  };
  apply();

  // ------------------------------------------------ 登場：線を描く → 塗り → 発進
  const intro = gsap.timeline({ paused: true });
  lines.forEach((el) => {
    const len = el.getTotalLength();
    gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
  });
  intro
    .to(lines, { strokeDashoffset: 0, duration: 1.4, ease: "power2.inOut", stagger: 0.03 })
    .to(fills, { opacity: 1, duration: 0.6, stagger: 0.04 }, "-=0.5")
    .set(lines, { strokeDasharray: "none" })
    .to(speed, { base: 1, duration: 1.6, ease: "power2.in", onUpdate: apply }, "-=0.3");

  ScrollTrigger.create({
    trigger: scene,
    start: "top 75%",
    once: true,
    onEnter: () => intro.play(),
  });

  // 画面外ではループを止める
  ScrollTrigger.create({
    trigger: scene,
    start: "top bottom",
    end: "bottom top",
    onToggle: (self) => loops.forEach((l) => (self.isActive ? l.resume() : l.pause())),
    onUpdate: (self) => {
      // スクロールの速さで一時的に加速
      const v = Math.min(Math.abs(self.getVelocity()) / 800, 3);
      if (v > 0.1 && speed.base > 0.5) {
        gsap.to(speed, { boost: v, duration: 0.2, overwrite: true, onUpdate: apply });
        gsap.to(speed, { boost: 0, duration: 1.2, delay: 0.25, onUpdate: apply });
      }
    },
  });

  // ------------------------------------------------ ホバーで空ぶかし
  const canHover = window.matchMedia("(hover: hover)").matches;
  const rev = (on: boolean) => {
    if (speed.base < 0.5) return;
    gsap.to(speed, { boost: on ? 1.6 : 0, duration: on ? 0.5 : 1, ease: "power2.out", overwrite: true, onUpdate: apply });
    gsap.to(bikeEl, {
      rotation: on ? -7 : 0,
      transformOrigin: `${(90 / 400) * 100}% ${(214 / 240) * 100}%`, // 後輪の接地点を中心に前を持ち上げる
      duration: on ? 0.5 : 0.8,
      ease: on ? "back.out(2)" : "elastic.out(1, 0.5)",
    });
  };
  if (canHover) {
    scene.addEventListener("mouseenter", () => rev(true));
    scene.addEventListener("mouseleave", () => rev(false));
  } else {
    let on = false;
    scene.addEventListener("click", () => rev((on = !on)));
  }
}

/** メーター：針・円弧・数字・リング・ルートのバーを画面に入ったときに動かす */
function initMeters(reduced: boolean) {
  const gauge = document.querySelector<HTMLElement>(".gauge");
  if (!gauge || reduced) return;

  const arc = gauge.querySelector<SVGPathElement>("[data-gauge-arc]")!;
  const needle = gauge.querySelector<SVGGElement>("[data-gauge-needle]")!;
  const ring = document.querySelector<SVGCircleElement>("[data-pref-ring]");
  const counters = Array.from(document.querySelectorAll<HTMLElement>(".riding [data-count]"));
  const bars = Array.from(document.querySelectorAll<HTMLElement>("[data-route-bar]"));

  const ratio = Number(arc.dataset.ratio);
  const angle = Number(needle.dataset.angle);
  const start = angle - 240 * ratio;
  const svg = needle.ownerSVGElement!;
  const center = svg.querySelector("circle")!;
  const origin = `${center.getAttribute("cx")} ${center.getAttribute("cy")}`;

  // 初期状態（0）
  gsap.set(arc, { attr: { "stroke-dashoffset": 1 } });
  needle.removeAttribute("transform");
  gsap.set(needle, { rotation: start, svgOrigin: origin });
  if (ring) gsap.set(ring, { attr: { "stroke-dashoffset": Number(ring.dataset.len) } });
  gsap.set(bars, { scaleX: 0 });
  counters.forEach((el) => (el.textContent = "0"));

  ScrollTrigger.create({
    trigger: gauge,
    start: "top 80%",
    once: true,
    onEnter: () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      // 一度レッドゾーン近くまで振り切ってから戻る
      tl.to(needle, { rotation: start + 240 * Math.min(1, ratio + 0.15), duration: 0.9, ease: "power2.in" })
        .to(needle, { rotation: angle, duration: 1.2, ease: "elastic.out(1, 0.5)" })
        .to(arc, { attr: { "stroke-dashoffset": 1 - ratio }, duration: 1.6 }, 0.3);
      if (ring) {
        tl.to(ring, { attr: { "stroke-dashoffset": Number(ring.dataset.len) * (1 - Number(ring.dataset.ratio)) }, duration: 1.4 }, 0.4);
      }
      counters.forEach((el) => {
        const target = Number(el.dataset.count);
        const o = { n: 0 };
        tl.to(o, { n: target, duration: 1.8, onUpdate: () => (el.textContent = Math.round(o.n).toLocaleString("en-US")) }, 0.2);
      });
    },
  });

  ScrollTrigger.batch(bars, {
    start: "top 90%",
    once: true,
    onEnter: (els) => gsap.to(els, { scaleX: 1, duration: 1.2, ease: "power3.out", stagger: 0.1 }),
  });
}
