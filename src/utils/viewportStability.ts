/**
 * Exercise Logging Viewport Stability Engine (Task 3)
 * - Prevents screen jumps and involuntary scrolling when logging sets or toggling cards.
 * - Anchors the user's current exercise card and vertical scroll position across DOM re-renders.
 * - Scrolls horizontal pill strips using `scrollLeft` ONLY (never `scrollIntoView`, which jumps vertical scroll).
 */

export interface ViewportScrollAnchor {
  scrollX: number;
  scrollY: number;
  anchorId: string | null;
  anchorTopBefore: number | null;
}

export interface ScrollableWindowLike {
  scrollX: number;
  scrollY: number;
  scrollTo: (xOrOptions: number | ScrollToOptions, y?: number) => void;
  requestAnimationFrame?: (cb: () => void) => number;
}

export interface AnchorElementLike {
  id?: string;
  getBoundingClientRect: () => { top: number };
}

/**
 * Pure math helper: calculates the exact scrollY target needed to keep an anchored element
 * at the exact same screen pixel (`anchorTopBefore`) after a DOM re-render, even if the browser
 * temporarily clamped `window.scrollY` while `innerHTML` was rebuilt.
 */
export function computeStableScrollTargetY(params: {
  scrollYBefore: number;
  scrollYCurrent?: number;
  anchorTopBefore: number | null;
  anchorTopAfter: number | null;
}): number {
  const baseScrollY = Number.isFinite(params.scrollYBefore) ? Math.max(0, params.scrollYBefore) : 0;
  const currentScrollY =
    typeof params.scrollYCurrent === 'number' && Number.isFinite(params.scrollYCurrent)
      ? Math.max(0, params.scrollYCurrent)
      : baseScrollY;

  if (
    typeof params.anchorTopBefore === 'number' &&
    Number.isFinite(params.anchorTopBefore) &&
    typeof params.anchorTopAfter === 'number' &&
    Number.isFinite(params.anchorTopAfter)
  ) {
    const anchorDocYAfter = currentScrollY + params.anchorTopAfter;
    return Math.max(0, Math.round(anchorDocYAfter - params.anchorTopBefore));
  }
  return Math.round(baseScrollY);
}

/**
 * Captures the current window scroll coordinates and optional exercise card screen offset
 * right before a DOM re-render triggered by logging a set.
 */
export function captureViewportScrollAnchor(
  anchorEl?: AnchorElementLike | null,
  win?: ScrollableWindowLike | null
): ViewportScrollAnchor {
  const targetWin =
    win ?? (typeof window !== 'undefined' ? (window as unknown as ScrollableWindowLike) : null);
  const scrollX = targetWin && Number.isFinite(targetWin.scrollX) ? targetWin.scrollX : 0;
  const scrollY = targetWin && Number.isFinite(targetWin.scrollY) ? targetWin.scrollY : 0;

  let anchorId: string | null = null;
  let anchorTopBefore: number | null = null;
  if (anchorEl && typeof anchorEl.getBoundingClientRect === 'function') {
    anchorId = anchorEl.id ? String(anchorEl.id) : null;
    const rect = anchorEl.getBoundingClientRect();
    if (rect && Number.isFinite(rect.top)) {
      anchorTopBefore = rect.top;
    }
  }

  return {
    scrollX,
    scrollY,
    anchorId,
    anchorTopBefore
  };
}

/**
 * Restores the viewport scroll position instantaneously (`behavior: 'auto'`) so the tapped
 * exercise card stays anchored in place with zero disorienting jump.
 */
export function restoreViewportScrollAnchor(
  anchor: ViewportScrollAnchor,
  findAnchorById?: ((id: string) => AnchorElementLike | null) | null,
  win?: ScrollableWindowLike | null
): number {
  const targetWin =
    win ?? (typeof window !== 'undefined' ? (window as unknown as ScrollableWindowLike) : null);
  if (!targetWin || typeof targetWin.scrollTo !== 'function') {
    return anchor.scrollY;
  }

  const lookup =
    findAnchorById ??
    (typeof document !== 'undefined' ? (id: string) => document.getElementById(id) : null);

  let anchorTopAfter: number | null = null;
  if (anchor.anchorId && typeof lookup === 'function') {
    const nextEl = lookup(anchor.anchorId);
    if (nextEl && typeof nextEl.getBoundingClientRect === 'function') {
      const rect = nextEl.getBoundingClientRect();
      if (rect && Number.isFinite(rect.top)) {
        anchorTopAfter = rect.top;
      }
    }
  }

  const currentScrollY = Number.isFinite(targetWin.scrollY) ? targetWin.scrollY : anchor.scrollY;

  const targetY = computeStableScrollTargetY({
    scrollYBefore: anchor.scrollY,
    scrollYCurrent: currentScrollY,
    anchorTopBefore: anchor.anchorTopBefore,
    anchorTopAfter
  });

  try {
    targetWin.scrollTo({ left: anchor.scrollX, top: targetY, behavior: 'auto' });
  } catch {
    targetWin.scrollTo(anchor.scrollX, targetY);
  }

  return targetY;
}

/**
 * Runs a DOM re-render callback while preserving viewport scroll stability both synchronously
 * and on the next animation frame (prevents mobile Safari/Chrome reflow jump).
 */
export function withStableViewportScroll<T>(
  anchorEl: AnchorElementLike | null | undefined,
  renderFn: () => T,
  options?: {
    findAnchorById?: ((id: string) => AnchorElementLike | null) | null;
    win?: ScrollableWindowLike | null;
  }
): T {
  const targetWin =
    options?.win ??
    (typeof window !== 'undefined' ? (window as unknown as ScrollableWindowLike) : null);
  const snapshot = captureViewportScrollAnchor(anchorEl, targetWin);
  const result = renderFn();

  restoreViewportScrollAnchor(snapshot, options?.findAnchorById, targetWin);

  if (targetWin && typeof targetWin.requestAnimationFrame === 'function') {
    targetWin.requestAnimationFrame(() => {
      restoreViewportScrollAnchor(snapshot, options?.findAnchorById, targetWin);
    });
  }

  return result;
}

/**
 * Horizontally centers or reveals a child pill inside a horizontal scroll strip
 * using ONLY `container.scrollLeft` so it NEVER scrolls the vertical page viewport.
 */
export function scrollContainerHorizontallyWithoutVerticalJump(
  container: {
    scrollLeft: number;
    clientWidth: number;
    getBoundingClientRect?: () => { left: number; width: number };
  } | null,
  childEl: {
    offsetLeft?: number;
    offsetWidth?: number;
    getBoundingClientRect?: () => { left: number; width: number };
  } | null
): number | null {
  if (!container || !childEl) return null;

  let nextScrollLeft = container.scrollLeft;
  if (
    typeof container.getBoundingClientRect === 'function' &&
    typeof childEl.getBoundingClientRect === 'function'
  ) {
    const cRect = container.getBoundingClientRect();
    const tRect = childEl.getBoundingClientRect();
    const relLeft = tRect.left - cRect.left;
    const relRight = relLeft + tRect.width;
    if (relLeft < 0) {
      nextScrollLeft = Math.max(0, container.scrollLeft + relLeft - 12);
    } else if (relRight > cRect.width) {
      nextScrollLeft = Math.max(0, container.scrollLeft + (relRight - cRect.width) + 12);
    }
  } else if (typeof childEl.offsetLeft === 'number' && typeof childEl.offsetWidth === 'number') {
    const childLeft = childEl.offsetLeft;
    const childRight = childLeft + childEl.offsetWidth;
    if (childLeft < container.scrollLeft) {
      nextScrollLeft = Math.max(0, childLeft - 12);
    } else if (childRight > container.scrollLeft + container.clientWidth) {
      nextScrollLeft = Math.max(0, childRight - container.clientWidth + 12);
    }
  }

  container.scrollLeft = Math.round(nextScrollLeft);
  return container.scrollLeft;
}
