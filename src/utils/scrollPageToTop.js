/** Scroll the primary app scroller(s) to the top. */
export function scrollPageToTop({ behavior = 'auto' } = {}) {
  const appMain = document.querySelector('.app-main');
  if (appMain) {
    appMain.scrollTo({ top: 0, left: 0, behavior });
  }
  window.scrollTo({ top: 0, left: 0, behavior });
}

/** Run scroll-to-top after layout (handles late-mounted content). */
export function scheduleScrollPageToTop(options = {}) {
  const run = () => scrollPageToTop(options);
  requestAnimationFrame(run);
  const t1 = setTimeout(run, 50);
  const t2 = setTimeout(run, 250);
  return () => {
    clearTimeout(t1);
    clearTimeout(t2);
  };
}

/** Center a horizontal carousel slide without scrolling the page vertically. */
export function scrollElementIntoHorizontalContainer(container, item) {
  if (!container || !item) return;
  const targetLeft = item.offsetLeft - (container.clientWidth - item.offsetWidth) / 2;
  container.scrollLeft = Math.max(0, targetLeft);
}
