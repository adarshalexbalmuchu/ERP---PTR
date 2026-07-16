// iOS Safari has a long-standing WebKit bug: when the page is scroll-locked
// via `body { overflow: hidden }` alone, `position: fixed` descendants (like
// a bottom sheet) can stop receiving touch events entirely — they still
// render correctly, but taps silently do nothing, with no console error.
// The established fix is to pin the body itself to `position: fixed` (which
// removes it from the normal scrolling flow) rather than relying on
// `overflow: hidden`, and restore both the styles and the scroll position
// afterwards.
export function lockBodyScroll(): () => void {
  const scrollY = window.scrollY;
  const prev = {
    position: document.body.style.position,
    top: document.body.style.top,
    width: document.body.style.width,
    overflow: document.body.style.overflow,
  };
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = '100%';
  document.body.style.overflow = 'hidden';
  return () => {
    document.body.style.position = prev.position;
    document.body.style.top = prev.top;
    document.body.style.width = prev.width;
    document.body.style.overflow = prev.overflow;
    window.scrollTo(0, scrollY);
  };
}
