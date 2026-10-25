export const PHOTO_VIEWER_EVENT = "photo-viewer-change";

export function initPhotoLightbox() {
  const element = document.querySelector<HTMLDialogElement>("[data-photo-lightbox]");
  if (!element) return;
  const dialog = element;
  const image = dialog.querySelector<HTMLImageElement>("[data-photo-full]")!;
  let opener: HTMLAnchorElement | null = null;
  let previousOverflow = "";

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[data-photo-open]") : null;
    if (!link) return;
    event.preventDefault();
    opener = link;
    image.alt = link.dataset.photoAlt ?? "写真";
    image.src = link.href;
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    dialog.showModal();
    document.dispatchEvent(new Event(PHOTO_VIEWER_EVENT));
  });

  dialog.querySelector("[data-photo-close]")!.addEventListener("click", () => dialog.close());
  // 閉じるボタン、背景のタップ、Esc で戻る。画像自体のタップでは閉じない。
  let backdropPressed = false;
  const outside = (event: PointerEvent | MouseEvent) => {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  dialog.addEventListener("pointerdown", (event) => {
    backdropPressed = event.target === dialog && outside(event);
  });
  dialog.addEventListener("click", (event) => {
    if (backdropPressed && event.target === dialog && outside(event)) dialog.close();
    backdropPressed = false;
  });
  dialog.addEventListener("close", () => {
    document.documentElement.style.overflow = previousOverflow;
    const focusTarget = opener?.closest('[aria-hidden="true"]')
      ? Array.from(document.querySelectorAll<HTMLAnchorElement>("a[data-photo-open]"))
        .find((link) => link.href === opener?.href && !link.closest('[aria-hidden="true"]'))
      : opener;
    focusTarget?.focus({ preventScroll: true });
    // 復帰するフォーカスでギャラリーが縦方向にスクロールしないようにする。
    document.dispatchEvent(new Event(PHOTO_VIEWER_EVENT));
    image.removeAttribute("src");
    image.alt = "";
  });
}
