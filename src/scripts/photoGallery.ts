import { PHOTO_VIEWER_EVENT } from "./photoLightbox";

const PAUSE_MS = 8_000;

/** 写真だけが一定速度で流れる。操作後は8秒休み、拡大表示中は再開しない。 */
export function initPhotoGallery() {
  const element = document.querySelector<HTMLElement>("[data-photo-gallery]");
  if (!element) return;
  const root = element;
  const viewport = root.querySelector<HTMLElement>("[data-gallery-viewport]")!;
  const track = root.querySelector<HTMLElement>("[data-gallery-track]")!;
  const group = root.querySelector<HTMLElement>("[data-gallery-group]")!;
  const dialog = document.querySelector<HTMLDialogElement>("[data-photo-lightbox]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let visible = false;
  let cycle = 0;
  let position = 0;
  let frame = 0;
  let lastTime = 0;
  let pausedUntil = 0;
  let resumeTimer = 0;
  let suppressClickUntil = 0;
  let touching = false;
  let pointer: { id: number; x: number; y: number; scroll: number; dragging: boolean } | null = null;

  const shouldRun = () => !reducedMotion.matches && performance.now() >= pausedUntil && !dialog?.open
    && !pointer && !touching && visible && !document.hidden && cycle > viewport.clientWidth;

  function tick(time: number) {
    frame = 0;
    if (!shouldRun()) return;
    const elapsed = lastTime ? Math.min(time - lastTime, 64) : 0;
    lastTime = time;
    const speed = viewport.clientWidth <= 760 ? 24 : 32;
    position = (position + (elapsed * speed) / 1000) % cycle;
    viewport.scrollLeft = position;
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    if (shouldRun()) {
      if (!frame) {
        position = viewport.scrollLeft % cycle;
        lastTime = 0;
        frame = requestAnimationFrame(tick);
      }
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
    }
  }

  function pauseTemporarily() {
    pausedUntil = performance.now() + PAUSE_MS;
    window.clearTimeout(resumeTimer);
    resumeTimer = window.setTimeout(sync, PAUSE_MS + 16);
    sync();
  }

  function measure() {
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    cycle = group.getBoundingClientRect().width + gap;
    root.dataset.loop = String(cycle > viewport.clientWidth);
    sync();
  }

  viewport.addEventListener("pointerdown", (event) => {
    pauseTemporarily();
    if (event.pointerType === "mouse" && event.button === 0) {
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, scroll: viewport.scrollLeft, dragging: false };
      sync();
    }
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!pointer.dragging && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 6) {
      pointer = null;
      return;
    }
    if (!pointer.dragging && Math.abs(dx) > 6) {
      pointer.dragging = true;
      viewport.setPointerCapture(event.pointerId);
      viewport.dataset.dragging = "true";
    }
    if (pointer.dragging) {
      event.preventDefault();
      viewport.scrollLeft = pointer.scroll - dx;
      pauseTemporarily();
    }
  });
  function releasePointer(event: PointerEvent) {
    if (pointer?.id === event.pointerId) {
      if (pointer.dragging) suppressClickUntil = performance.now() + 400;
      pointer = null;
      delete viewport.dataset.dragging;
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    }
    pauseTemporarily();
  }
  viewport.addEventListener("pointerup", releasePointer);
  viewport.addEventListener("pointercancel", releasePointer);
  viewport.addEventListener("touchstart", () => {
    touching = true;
    pauseTemporarily();
  }, { passive: true });
  const finishTouch = (event: TouchEvent) => {
    touching = event.touches.length > 0;
    pauseTemporarily();
  };
  viewport.addEventListener("touchend", finishTouch, { passive: true });
  viewport.addEventListener("touchcancel", finishTouch, { passive: true });
  window.addEventListener("pointerup", (event) => {
    if (pointer?.id === event.pointerId) releasePointer(event);
  });
  window.addEventListener("blur", () => {
    if (pointer) {
      pointer = null;
      delete viewport.dataset.dragging;
      pauseTemporarily();
    }
  });
  // ドラッグ後に発生するclickで、意図せず画像が拡大しないようにする。
  viewport.addEventListener("click", (event) => {
    if (performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
    } else {
      pauseTemporarily();
    }
  }, true);
  viewport.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey) pauseTemporarily();
  }, { passive: true });
  // スワイプやトラックパッドの慣性が終わった時点から8秒待つ。
  viewport.addEventListener("scroll", () => {
    if (performance.now() < pausedUntil) pauseTemporarily();
  }, { passive: true });
  viewport.addEventListener("focusin", pauseTemporarily);
  viewport.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      pauseTemporarily();
      viewport.scrollBy({
        left: (event.key === "ArrowLeft" ? -1 : 1) * viewport.clientWidth * 0.75,
        behavior: reducedMotion.matches ? "auto" : "smooth",
      });
    }
  });
  document.addEventListener(PHOTO_VIEWER_EVENT, pauseTemporarily);
  document.addEventListener("visibilitychange", sync);
  reducedMotion.addEventListener("change", sync);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }).observe(viewport);
  const resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(viewport);
  resizeObserver.observe(group);
  measure();
}
