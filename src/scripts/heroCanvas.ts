// ヒーロー背景：マウスに反応して動くパーティクルネットワーク

type P = { x: number; y: number; vx: number; vy: number; r: number; ci: number };

const COLORS = ["0, 184, 217", "58, 123, 255", "123, 92, 255", "255, 95, 162", "46, 230, 166", "255, 170, 60"];

export function initHeroCanvas(canvas: HTMLCanvasElement, reduced: boolean) {
  const ctx = canvas.getContext("2d")!;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let points: P[] = [];
  const mouse = { x: -9999, y: -9999 };
  let running = true;
  let raf = 0;

  const LINK = 140;
  const LINK2 = LINK * LINK;
  /** 線の濃さの段階数。色 × 濃さごとにパスをまとめて stroke する */
  const LEVELS = 4;
  const linePaths: Path2D[] = [];
  const mouseLines: Path2D[] = [];
  const dotPaths: Path2D[] = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.round(Math.min(110, (w * h) / 14000));
    points = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.8 + 0.9,
      ci: Math.floor(Math.random() * COLORS.length),
    }));
  }

  function step() {
    ctx.clearRect(0, 0, w, h);

    for (const p of points) {
      // マウスから少し逃げる
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 160 * 160) {
        const f = (1 - Math.sqrt(d2) / 160) * 0.6;
        p.vx += (dx / Math.sqrt(d2 + 0.01)) * f * 0.1;
        p.vy += (dy / Math.sqrt(d2 + 0.01)) * f * 0.1;
      }
      p.vx *= 0.985;
      p.vy *= 0.985;
      // 最低限の漂い
      p.vx += (Math.random() - 0.5) * 0.01;
      p.vy += (Math.random() - 0.5) * 0.01;
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      if (p.y < -20) p.y = h + 20;
      if (p.y > h + 20) p.y = -20;
    }

    // 線・点を色と濃さごとに Path2D にまとめ、最後に一括で描く
    for (let k = 0; k < COLORS.length * LEVELS; k++) linePaths[k] = new Path2D();
    for (let k = 0; k < COLORS.length; k++) {
      mouseLines[k] = new Path2D();
      dotPaths[k] = new Path2D();
    }

    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      for (let j = i + 1; j < points.length; j++) {
        const b = points[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < LINK2) {
          const t = 1 - Math.sqrt(d2) / LINK;
          const level = Math.min(LEVELS - 1, (t * LEVELS) | 0);
          const path = linePaths[a.ci * LEVELS + level];
          path.moveTo(a.x, a.y);
          path.lineTo(b.x, b.y);
        }
      }
      // マウスとの接続線
      const mdx = a.x - mouse.x;
      const mdy = a.y - mouse.y;
      if (mdx * mdx + mdy * mdy < 200 * 200) {
        mouseLines[a.ci].moveTo(a.x, a.y);
        mouseLines[a.ci].lineTo(mouse.x, mouse.y);
      }
      dotPaths[a.ci].moveTo(a.x + a.r, a.y);
      dotPaths[a.ci].arc(a.x, a.y, a.r, 0, Math.PI * 2);
    }

    for (let c = 0; c < COLORS.length; c++) {
      for (let level = 0; level < LEVELS; level++) {
        const t = (level + 0.5) / LEVELS;
        ctx.strokeStyle = `rgba(${COLORS[c]}, ${t * 0.4})`;
        ctx.lineWidth = t * 1.2;
        ctx.stroke(linePaths[c * LEVELS + level]);
      }
      ctx.strokeStyle = `rgba(${COLORS[c]}, 0.35)`;
      ctx.lineWidth = 1;
      ctx.stroke(mouseLines[c]);
      ctx.fillStyle = `rgba(${COLORS[c]}, 0.85)`;
      ctx.fill(dotPaths[c]);
    }

    if (running && !reduced) raf = requestAnimationFrame(step);
  }

  resize();
  step();

  window.addEventListener("resize", () => {
    resize();
    if (reduced) step();
  });

  const hero = canvas.parentElement!;
  hero.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  hero.addEventListener("pointerleave", () => {
    mouse.x = mouse.y = -9999;
  });

  // 画面外では止めて負荷を下げる
  new IntersectionObserver(([entry]) => {
    const visible = entry.isIntersecting;
    if (visible && !running && !reduced) {
      running = true;
      raf = requestAnimationFrame(step);
    } else if (!visible) {
      running = false;
      cancelAnimationFrame(raf);
    }
  }).observe(canvas);
}
