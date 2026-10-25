// 趣味：バイクのメーターとルートのバーのアニメーション
// （下端を走る小さなバイクは CSS アニメーションだけで動かしている）
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function initRiding(reduced: boolean) {
  initMeters(reduced);
}

/** メーター：針・円弧・数字・ルートのバーを画面に入ったときに動かす */
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
  if (bars.length > 0) gsap.set(bars, { scaleX: 0 });
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

  if (bars.length > 0) ScrollTrigger.batch(bars, {
    start: "top 90%",
    once: true,
    onEnter: (els) => gsap.to(els, { scaleX: 1, duration: 1.2, ease: "power3.out", stagger: 0.1 }),
  });
}
