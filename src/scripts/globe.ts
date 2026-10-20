// 旅行先を示すドット地球儀（Canvas 2D・正射図法）
//
// 軽量化のポイント
// - ドットは単位ベクトルで持ち、毎フレームは回転行列の掛け算だけ（三角関数を使わない）
// - ドットを経緯度のタイルにまとめ（クラスタリング）、見えないタイルは丸ごとスキップ
// - 奥行きごとにバケツ分けして、色の切り替えと fill をまとめて行う
import { gsap } from "gsap";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import land from "world-atlas/land-110m.json";

type Trip = { place: string; region: string; lat: number; lng: number };

const RAD = Math.PI / 180;

/** 細かいドットを持っている範囲（src/pages/geo/japan-dots.json.ts の REGION と合わせる）。タイル境界に揃える */
const JAPAN_REGION = { latMin: 10, latMax: 55, lngMin: 105, lngMax: 165 };
/** この範囲の旅行先にフォーカスしたらズームイン */
const JAPAN = { latMin: 24, latMax: 46, lngMin: 122, lngMax: 154 };
const JAPAN_ZOOM = 4.5;

/** 粗いドット / 細かいドットのタイルの大きさ（度）。JAPAN_REGION の境界はどちらの倍数にもしておく */
const COARSE_TILE = 5;
const FINE_TILE = 3;
/** 奥行き（z）のバケツ数。多いほど滑らか、少ないほど速い */
const BUCKETS = 8;

const inBox = (lat: number, lng: number, b: typeof JAPAN) =>
  lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax;

/** 陸地を正距円筒図法でオフスクリーン描画し、陸地上の点だけを残す（[lat, lng, ...]） */
function buildLandDots(): number[] {
  const W = 720;
  const H = 360;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const topo = land as unknown as Topology<{ land: GeometryCollection }>;
  const geo = feature(topo, topo.objects.land) as unknown as {
    features: Feature<Polygon | MultiPolygon>[];
  };

  ctx.fillStyle = "#000";
  for (const f of geo.features) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      // 日付変更線をまたぐ輪郭は経度を連続にして、左右にずらして3回描く
      for (const offset of [-360, 0, 360]) {
        ctx.beginPath();
        for (const ring of poly) {
          let prev = ring[0][0];
          let shift = 0;
          ring.forEach(([lng, lat], i) => {
            if (i > 0 && Math.abs(lng - prev) > 180) shift += lng > prev ? -360 : 360;
            prev = lng;
            const x = ((lng + shift + offset + 180) / 360) * W;
            const y = ((90 - lat) / 180) * H;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
        }
        ctx.fill("evenodd");
      }
    }
  }

  const data = ctx.getImageData(0, 0, W, H).data;
  const dots: number[] = [];
  const step = 1.25; // 緯度方向の間隔（度）
  for (let lat = -85; lat <= 85; lat += step) {
    // 経度方向は緯度に応じて間引き、密度を均一にする
    const lngStep = step / Math.max(Math.cos(lat * RAD), 0.15);
    for (let lng = -180; lng < 180; lng += lngStep) {
      const x = Math.floor(((lng + 180) / 360) * W);
      const y = Math.floor(((90 - lat) / 180) * H);
      if (data[(y * W + x) * 4 + 3] > 128) dots.push(lat, lng);
    }
  }
  return dots;
}

type Tile = {
  start: number;
  end: number;
  /** タイル中心の単位ベクトル */
  cx: number;
  cy: number;
  cz: number;
  /** タイル中心から最も遠いドットまでの角度（rad） */
  radius: number;
  /** 日本周辺の細かいドットと重なるタイルか */
  inRegion: boolean;
};

/** タイル（クラスタ）単位にまとめたドット群 */
type DotSet = {
  /** 単位ベクトル x,y,z の並び（タイルごとに連続） */
  v: Float32Array;
  tiles: Tile[];
};

const toVec = (lat: number, lng: number): [number, number, number] => {
  const p = lat * RAD;
  const l = lng * RAD;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
};

/** [lat, lng, ...] をタイルごとに並べ替え、タイルの中心と半径を求める */
function buildDotSet(latlng: ArrayLike<number>, tileDeg: number): DotSet {
  const groups = new Map<string, number[]>();
  for (let k = 0; k < latlng.length; k += 2) {
    const lat = latlng[k];
    const lng = latlng[k + 1];
    const key = `${Math.floor(lat / tileDeg)},${Math.floor(lng / tileDeg)}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = []));
    g.push(lat, lng);
  }

  const v = new Float32Array((latlng.length / 2) * 3);
  const tiles: Tile[] = [];
  let n = 0;
  for (const [key, g] of groups) {
    const start = n;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (let k = 0; k < g.length; k += 2) {
      const [x, y, z] = toVec(g[k], g[k + 1]);
      v[n * 3] = x;
      v[n * 3 + 1] = y;
      v[n * 3 + 2] = z;
      sx += x;
      sy += y;
      sz += z;
      n++;
    }
    const len = Math.hypot(sx, sy, sz) || 1;
    const cx = sx / len;
    const cy = sy / len;
    const cz = sz / len;
    let minDot = 1;
    for (let i = start; i < n; i++) {
      minDot = Math.min(minDot, v[i * 3] * cx + v[i * 3 + 1] * cy + v[i * 3 + 2] * cz);
    }
    const [ty, tx] = key.split(",").map((s) => Number(s) * tileDeg);
    tiles.push({
      start,
      end: n,
      cx,
      cy,
      cz,
      radius: Math.acos(Math.min(1, minDot)) + 0.01,
      inRegion: inBox(ty + tileDeg / 2, tx + tileDeg / 2, JAPAN_REGION),
    });
  }
  return { v, tiles };
}

export function initGlobe(canvas: HTMLCanvasElement, reduced: boolean) {
  const trips: Trip[] = JSON.parse(canvas.dataset.trips || "[]");
  const colors: string[] = JSON.parse(canvas.dataset.colors || '["#00b8d9"]');
  const colorOf = (i: number) => colors[i % colors.length];
  /** "#rrggbb" → "r, g, b" */
  const rgb = (hex: string) =>
    [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)).join(", ");
  const label = canvas.parentElement!.querySelector<HTMLElement>("[data-globe-label]");
  const items = document.querySelectorAll<HTMLElement>("[data-trip]");
  const ctx = canvas.getContext("2d")!;

  const coarse = buildDotSet(buildLandDots(), COARSE_TILE);
  // 日本周辺の細かいドット（ズーム時用）。読み込み完了までは null
  let fine: DotSet | null = null;
  fetch("/geo/japan-dots.json")
    .then((r) => r.json())
    .then((arr: number[]) => {
      fine = buildDotSet(arr, FINE_TILE);
    })
    .catch(() => {});

  // 奥行きバケツごとの描画座標バッファ（毎フレーム使い回す）
  const bucketXY = Array.from({ length: BUCKETS }, () => new Float32Array(0));
  const bucketLen = new Int32Array(BUCKETS);
  function ensureCapacity(dots: number) {
    if (bucketXY[0].length >= dots * 2) return;
    for (let b = 0; b < BUCKETS; b++) bucketXY[b] = new Float32Array(dots * 2);
  }

  // 旅程のアーク：大円上の点をあらかじめ単位ベクトルで用意
  const ARC_STEPS = 40;
  const arcs = trips.slice(0, -1).map((a, i) => {
    const b = trips[i + 1];
    const va = toVec(a.lat, a.lng);
    const vb = toVec(b.lat, b.lng);
    const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
    const om = Math.acos(dot);
    const s = Math.sin(om) || 1;
    const pts = new Float32Array((ARC_STEPS + 1) * 4);
    for (let k = 0; k <= ARC_STEPS; k++) {
      const f = k / ARC_STEPS;
      const k1 = Math.sin((1 - f) * om) / s;
      const k2 = Math.sin(f * om) / s;
      pts[k * 4] = k1 * va[0] + k2 * vb[0];
      pts[k * 4 + 1] = k1 * va[1] + k2 * vb[1];
      pts[k * 4 + 2] = k1 * va[2] + k2 * vb[2];
      // 弧を少し持ち上げる
      pts[k * 4 + 3] = 1 + Math.sin(f * Math.PI) * 0.12;
    }
    return { pts, from: colorOf(i), to: colorOf(i + 1), angle: om };
  });

  // 回転状態（中心の経度・緯度）と拡大率
  const view = { lng: -trips[0]?.lng || 0, lat: -20, intro: 0, zoom: 1 };
  let size = 0;
  let dpr = 1;
  let active = -1;
  let autoRotate = !reduced;
  let dragging = false;
  let running = false;
  let raf = 0;
  let t = 0;

  // 回転行列：行0=画面x、行1=画面y（上が正）、行2=奥行きz（手前が正）。draw の最初に更新
  const M = new Float64Array(9);
  function updateMatrix() {
    const sL = Math.sin(view.lng * RAD);
    const cL = Math.cos(view.lng * RAD);
    const s0 = Math.sin(view.lat * RAD);
    const c0 = Math.cos(view.lat * RAD);
    M.set([sL, cL, 0, -s0 * cL, s0 * sL, c0, c0 * cL, -c0 * sL, s0]);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = canvas.clientWidth;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** 地球儀の見た目の半径（ズームしても円の大きさは変えず、中身だけ拡大する） */
  function baseR() {
    return size * 0.42 * (0.6 + 0.4 * view.intro);
  }

  /** 緯度経度 → 画面座標（z>0 が手前） */
  function project(lat: number, lng: number) {
    const [x, y, z] = toVec(lat, lng);
    const R = baseR() * view.zoom;
    return {
      x: size / 2 + (M[0] * x + M[1] * y) * R,
      y: size / 2 - (M[3] * x + M[4] * y + M[5] * z) * R,
      z: M[6] * x + M[7] * y + M[8] * z,
    };
  }

  /**
   * ドット群をバケツに振り分ける。
   * 見える範囲（ズーム時は円の内側に入る球冠）と重ならないタイルは丸ごとスキップ。
   */
  function collect(set: DotSet, include: (tile: Tile) => boolean) {
    ensureCapacity(set.v.length / 3);
    const R = baseR() * view.zoom;
    const c = size / 2;
    // ズーム時、円の内側に入るのは z >= zMin の点だけ
    const zMin = view.zoom > 1 ? Math.sqrt(1 - 1 / (view.zoom * view.zoom)) : 0;
    const cap = Math.acos(zMin);
    const { v } = set;
    for (const tile of set.tiles) {
      if (!include(tile)) continue;
      const tz = M[6] * tile.cx + M[7] * tile.cy + M[8] * tile.cz;
      if (cap + tile.radius < Math.PI && tz < Math.cos(cap + tile.radius)) continue;
      for (let i = tile.start; i < tile.end; i++) {
        const x = v[i * 3];
        const y = v[i * 3 + 1];
        const z = v[i * 3 + 2];
        const pz = M[6] * x + M[7] * y + M[8] * z;
        if (pz < zMin) continue;
        const b = Math.min(BUCKETS - 1, (pz * BUCKETS) | 0);
        const buf = bucketXY[b];
        const n = bucketLen[b];
        buf[n] = c + (M[0] * x + M[1] * y) * R;
        buf[n + 1] = c - (M[3] * x + M[4] * y + M[5] * z) * R;
        bucketLen[b] = n + 2;
      }
    }
  }

  /** バケツごとにまとめて描く（奥ほど薄く。sizeByDepth なら奥ほど小さく） */
  function flush(baseSize: number, sizeByDepth: boolean, alpha: number) {
    for (let b = 0; b < BUCKETS; b++) {
      const n = bucketLen[b];
      if (!n) continue;
      bucketLen[b] = 0;
      if (alpha <= 0.01) continue;
      const z = (b + 0.5) / BUCKETS;
      const s = sizeByDepth ? baseSize * (0.45 + z * 0.55) : baseSize;
      const h = s / 2;
      const buf = bucketXY[b];
      ctx.fillStyle = `rgba(20, 100, 200, ${(0.3 + z * 0.65) * alpha})`;
      ctx.beginPath();
      for (let k = 0; k < n; k += 2) ctx.rect(buf[k] - h, buf[k + 1] - h, s, s);
      ctx.fill();
    }
  }

  function drawArcs() {
    const R = baseR() * view.zoom;
    const c = size / 2;
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    for (const arc of arcs) {
      const { pts } = arc;
      ctx.beginPath();
      let drawing = false;
      let sx = 0;
      let sy = 0;
      let ex = 0;
      let ey = 0;
      for (let k = 0; k <= ARC_STEPS; k++) {
        const x = pts[k * 4];
        const y = pts[k * 4 + 1];
        const z = pts[k * 4 + 2];
        const lift = pts[k * 4 + 3];
        const px = c + (M[0] * x + M[1] * y) * R * lift;
        const py = c - (M[3] * x + M[4] * y + M[5] * z) * R * lift;
        if (k === 0) {
          sx = px;
          sy = py;
        }
        ex = px;
        ey = py;
        if (M[6] * x + M[7] * y + M[8] * z > -0.1) {
          if (drawing) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
          drawing = true;
        } else {
          drawing = false;
        }
      }
      const grad = ctx.createLinearGradient(sx, sy, ex, ey);
      grad.addColorStop(0, arc.from);
      grad.addColorStop(1, arc.to);
      ctx.strokeStyle = grad;
      // 下地の薄い線 + 流れる光（破線をずらしてアニメーション）
      ctx.globalAlpha = view.intro * 0.25;
      ctx.setLineDash([]);
      ctx.stroke();
      const dash = Math.max(10, arc.angle * R * 0.2);
      ctx.globalAlpha = view.intro * 0.85;
      ctx.setLineDash([dash, dash * 1.5]);
      ctx.lineDashOffset = -t * 50;
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = view.intro;
  }

  function drawPins() {
    trips.forEach((trip, i) => {
      const p = project(trip.lat, trip.lng);
      if (p.z <= 0) return;
      const isActive = i === active;
      const pulse = (t * 0.8 + i * 0.37) % 1;
      ctx.strokeStyle = `rgba(${rgb(colorOf(i))}, ${(1 - pulse) * 0.8})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 + pulse * (isActive ? 22 : 12), 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = isActive ? "#0b1b2b" : colorOf(i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, isActive ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, isActive ? 2.5 : 1.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function draw() {
    updateMatrix();
    ctx.clearRect(0, 0, size, size);
    const R = baseR();
    ctx.globalAlpha = view.intro;

    // 外周リング
    ctx.strokeStyle = "rgba(0, 160, 210, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, R, 0, Math.PI * 2);
    ctx.stroke();

    // ズーム中は円の内側だけに描く（レンズで覗き込むイメージ）
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, R + 1, 0, Math.PI * 2);
    ctx.clip();

    // ズームが進むほど、日本周辺は粗いドット → 細かいドットへ切り替える
    const f = fine ? Math.min(1, Math.max(0, (view.zoom - 1.3) / 1.4)) : 0;
    const coarseSize = Math.max(1.5, size / 170);

    collect(coarse, (tile) => !tile.inRegion || f === 0);
    flush(coarseSize, true, 1);
    if (f > 0 && f < 1) {
      collect(coarse, (tile) => tile.inRegion);
      flush(coarseSize, true, 1 - f);
    }
    if (fine && f > 0) {
      collect(fine, () => true);
      flush(Math.max(1.5, size / 210), false, f);
    }

    drawArcs();
    drawPins();

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function loop() {
    t += 1 / 60;
    if (autoRotate && !dragging) view.lng += 0.08;
    draw();
    if (running) raf = requestAnimationFrame(loop);
  }

  function redrawIfIdle() {
    if (!running) draw();
  }

  function focus(i: number) {
    active = i;
    autoRotate = false;
    items.forEach((el, k) => el.classList.toggle("active", k === i));
    const trip = trips[i];
    const japan = inBox(trip.lat, trip.lng, JAPAN);
    // 最短方向で回転
    let target = -trip.lng;
    const diff = ((((target - view.lng) % 360) + 540) % 360) - 180;
    target = view.lng + diff;
    gsap.to(view, {
      lng: target,
      // 日本はその場所を真ん中に、それ以外は少し引いた角度で
      lat: japan ? trip.lat : Math.max(-60, Math.min(60, trip.lat * 0.8)),
      zoom: japan ? JAPAN_ZOOM : 1,
      duration: reduced ? 0 : japan && view.zoom > 1.5 ? 0.8 : 1.3,
      ease: "power3.inOut",
      overwrite: "auto",
      onUpdate: redrawIfIdle,
    });
    if (label) {
      // 地名と地域名が同じ（Singapore など）なら地域名は省く
      label.textContent =
        trip.region && trip.region !== trip.place ? `${trip.place}, ${trip.region}` : trip.place;
      label.classList.add("show");
    }
  }

  function unfocus() {
    active = -1;
    autoRotate = !reduced;
    if (view.zoom !== 1) {
      gsap.to(view, {
        zoom: 1,
        duration: reduced ? 0 : 1,
        ease: "power3.inOut",
        overwrite: "auto",
        onUpdate: redrawIfIdle,
      });
    }
    items.forEach((el) => el.classList.remove("active"));
    label?.classList.remove("show");
    redrawIfIdle();
  }

  items.forEach((el) => {
    const i = Number(el.dataset.trip);
    el.addEventListener("mouseenter", () => focus(i));
    el.addEventListener("focus", () => focus(i));
    el.addEventListener("click", () => focus(i));
    el.addEventListener("mouseleave", unfocus);
    el.addEventListener("blur", unfocus);
  });

  // ドラッグで回転（ズーム中は回転を遅く）
  // タッチ操作は最初の動きで方向を判定し、横なら地球儀を回す・縦ならページのスクロールに任せる
  // （canvas は CSS で touch-action: pan-y。縦スワイプ中に地球儀が動かないようにする）
  const LOCK_PX = 8;
  let pointerId = -1;
  let isTouch = false;
  let axis: "none" | "x" | "y" = "none";
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;

  const beginDrag = () => {
    dragging = true;
    gsap.killTweensOf(view, "lng,lat,zoom");
  };

  canvas.addEventListener("pointerdown", (e) => {
    pointerId = e.pointerId;
    isTouch = e.pointerType !== "mouse";
    axis = isTouch ? "none" : "x";
    startX = lastX = e.clientX;
    startY = lastY = e.clientY;
    if (!isTouch) {
      canvas.setPointerCapture(e.pointerId);
      beginDrag();
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pointerId) return;
    if (isTouch && axis === "none") {
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if (dx < LOCK_PX && dy < LOCK_PX) return;
      axis = dx > dy ? "x" : "y";
      if (axis === "x") {
        canvas.setPointerCapture(e.pointerId);
        beginDrag();
        lastX = e.clientX;
        lastY = e.clientY;
      }
      return;
    }
    if (!dragging || axis === "y") return;
    view.lng += ((e.clientX - lastX) * 0.4) / view.zoom;
    // 上下の回転はマウスのときだけ（タッチの縦方向はスクロール）
    if (!isTouch) {
      view.lat = Math.max(-80, Math.min(80, view.lat + ((e.clientY - lastY) * 0.3) / view.zoom));
    }
    lastX = e.clientX;
    lastY = e.clientY;
    redrawIfIdle();
  });

  const end = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    dragging = false;
    pointerId = -1;
    axis = "none";
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  resize();
  window.addEventListener("resize", () => {
    resize();
    draw();
  });

  if (reduced) {
    view.intro = 1;
    draw();
    return;
  }

  // 表示されたらズームインしながら登場、画面外では停止
  let introduced = false;
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      if (!introduced) {
        introduced = true;
        gsap.to(view, { intro: 1, lng: view.lng + 60, duration: 2, ease: "expo.out" });
      }
      if (!running) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    } else {
      running = false;
      cancelAnimationFrame(raf);
    }
  }).observe(canvas);
}
