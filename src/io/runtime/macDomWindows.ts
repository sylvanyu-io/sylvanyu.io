import type { Lang } from '../content/common';
import type { MacCanvasLayout, MacCanvasState, Rect, WindowId, WindowLayout } from './macCanvas/ui';
import { MAC_WINDOW_IDS } from './macCanvas/ui';
import {
  ensureWindowContentMounted,
  PHOTO_APP_HUD_HEIGHT,
  releaseWindowCanvasDemo,
  type MacDomWindowRecord,
  renderWindowContent,
  syncWindowCanvasActivity,
  updateWindowTexts,
} from './macDomWindowContent';

type MacDomWindowActions = {
  bringFront: (id: WindowId) => void;
  setOpen: (id: WindowId, open: boolean) => void;
  moveWindow: (id: WindowId, x: number, y: number) => void;
};

type MacDomWindowController = {
  minimize: (id: WindowId) => void;
  setRestoreOrigin: (id: WindowId, origin: RestoreOrigin) => void;
  sync: (layout: MacCanvasLayout, state: MacCanvasState) => void;
  destroy: () => void;
};

type RestoreOrigin = 'desktop' | 'dock';

type DragState = {
  id: WindowId;
  pointerId: number;
  offsetX: number;
  offsetY: number;
};

const MINIMIZE_DURATION = 240;
const RESTORE_DURATION = 260;
const WINDOW_EASING = 'cubic-bezier(.2,.8,.2,1)';

const BACK_CHEVRON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
  + '<path d="M15 4.8 L7.6 12 L15 19.2" fill="none" stroke="currentColor" stroke-width="2.4" '
  + 'stroke-linecap="round" stroke-linejoin="round"/></svg>';

function rectTransform(rect: Rect) {
  return `translate3d(${Math.round(rect.x)}px, ${Math.round(rect.y)}px, 0)`;
}

function targetTransform(from: Rect, to: Rect) {
  const scaleX = Math.max(0.04, to.w / Math.max(from.w, 1));
  const scaleY = Math.max(0.04, to.h / Math.max(from.h, 1));
  return `translate3d(${Math.round(to.x)}px, ${Math.round(to.y)}px, 0) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`;
}

function button(className: string, label: string) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.setAttribute('aria-label', label);
  return element;
}

function div(className: string) {
  const element = document.createElement('div');
  element.className = className;
  return element;
}

function dockTarget(layout: MacCanvasLayout, id: WindowId): Rect {
  const slot = layout.dock.slots.find((item) => item.id === id);
  if (slot) {
    return { x: slot.x, y: slot.y, w: slot.size, h: slot.size };
  }

  const icon = layout.iconCells.find((item) => item.id === id);
  if (icon) {
    return { x: icon.imgX, y: icon.imgY, w: icon.imgSize, h: icon.imgSize };
  }

  return { x: layout.width * 0.5, y: layout.height - 48, w: 48, h: 48 };
}

function desktopTarget(layout: MacCanvasLayout, id: WindowId): Rect {
  const icon = layout.iconCells.find((item) => item.id === id);
  if (icon) {
    return { x: icon.imgX, y: icon.imgY, w: icon.imgSize, h: icon.imgSize };
  }

  return dockTarget(layout, id);
}

function restoreTarget(layout: MacCanvasLayout, id: WindowId, origin: RestoreOrigin): Rect {
  return origin === 'desktop' ? desktopTarget(layout, id) : dockTarget(layout, id);
}

function windowById(layout: MacCanvasLayout, id: WindowId) {
  return layout.windows.find((windowLayout) => windowLayout.id === id) ?? null;
}

function contentClass(id: WindowId) {
  return `mac-dom-window__body mac-dom-window__body--${id}`;
}

function createWindowElement(id: WindowId, root: HTMLElement, actions: MacDomWindowActions) {
  const element = document.createElement('section');
  element.className = 'mac-dom-window';
  element.dataset.windowId = id;
  element.hidden = true;

  const titlebar = div('mac-dom-window__titlebar');
  titlebar.dataset.windowDrag = id;

  const close = button('mac-dom-window__close', 'Close window');
  close.innerHTML = BACK_CHEVRON_SVG;
  const title = div('mac-dom-window__title');
  const accessory = div('mac-dom-window__accessory');
  const body = div(contentClass(id));
  const cleanup: (() => void)[] = [];

  titlebar.append(close, title, accessory);
  element.append(titlebar, body);

  const record: MacDomWindowRecord = { id, element, title, accessory, close, body, cleanup };
  let dragState: DragState | null = null;

  const listen = <K extends keyof DocumentEventMap>(
    type: K,
    listener: (event: DocumentEventMap[K]) => void,
  ) => {
    document.addEventListener(type, listener);
    cleanup.push(() => document.removeEventListener(type, listener));
  };

  element.addEventListener('pointerdown', () => {
    actions.bringFront(id);
  });

  titlebar.addEventListener('pointerdown', (event) => {
    if (event.target === close || close.contains(event.target as Node)) return;

    const layout = currentLayout(root);
    const win = layout ? windowById(layout, id) : null;
    if (!layout || layout.mobile || !win) return;

    const rect = root.getBoundingClientRect();
    actions.bringFront(id);
    dragState = {
      id,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left - win.x,
      offsetY: event.clientY - rect.top - win.y,
    };
    element.dataset.dragging = 'true';
    titlebar.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  listen('pointermove', (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const rect = root.getBoundingClientRect();
    actions.moveWindow(id, event.clientX - rect.left - dragState.offsetX, event.clientY - rect.top - dragState.offsetY);
    event.preventDefault();
  });

  const endPointerDrag = (event: PointerEvent) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragState = null;
    element.dataset.dragging = 'false';
    if (titlebar.hasPointerCapture(event.pointerId)) titlebar.releasePointerCapture(event.pointerId);
    event.preventDefault();
  };

  listen('pointerup', endPointerDrag);
  listen('pointercancel', endPointerDrag);

  return record;
}

function currentLayout(root: HTMLElement): MacCanvasLayout | null {
  return (root as HTMLElement & { __macCanvasLayout?: MacCanvasLayout }).__macCanvasLayout ?? null;
}

function windowSignature(win: WindowLayout, layout: MacCanvasLayout) {
  return [
    Math.round(win.x),
    Math.round(win.y),
    Math.round(win.w),
    Math.round(win.h),
    win.r,
    win.z,
    win.titleH,
    layout.mobile ? 1 : 0,
    layout.safeTop,
    layout.safeBottom,
    win.stage ? Math.round(win.stage.h) : 0,
    win.note ? Math.round(win.note.h) : 0,
  ].join(':');
}

function updateWindowLayout(record: MacDomWindowRecord, win: WindowLayout, layout: MacCanvasLayout) {
  const { element } = record;
  element.hidden = false;

  // Style writes invalidate layout even when values are unchanged, and sync
  // runs every frame — only touch the DOM when the geometry actually moved.
  const signature = windowSignature(win, layout);
  if (record.appliedSig === signature) return;
  record.appliedSig = signature;

  element.dataset.tone = win.id === 'worklog' || win.id === 'reflection' ? 'dark' : 'light';
  element.dataset.mobile = layout.mobile ? 'true' : 'false';
  element.style.width = `${Math.round(win.w)}px`;
  element.style.height = `${Math.round(win.h)}px`;
  element.style.borderRadius = `${win.r}px`;
  element.style.transform = rectTransform(win);
  element.style.zIndex = String(1000 + win.z);
  element.style.setProperty('--mac-window-title-h', `${win.titleH}px`);
  element.style.setProperty('--mac-safe-top', `${layout.mobile ? layout.safeTop : 0}px`);
  element.style.setProperty('--mac-safe-bottom', `${layout.mobile ? layout.safeBottom : 0}px`);
  record.close.setAttribute('aria-label', layout.mobile ? 'Back' : 'Minimize window');

  if (win.id === 'photo' && win.stage && win.note) {
    element.style.setProperty('--mac-photo-stage-h', `${Math.max(1, win.stage.h)}px`);
    element.style.setProperty('--mac-photo-hud-h', `${PHOTO_APP_HUD_HEIGHT}px`);
    element.style.setProperty('--mac-photo-note-h', `${win.note.h}px`);
  }

  if (win.id === 'reflection' && win.stage) {
    element.style.setProperty('--mac-demo-stage-h', `${Math.max(1, win.stage.h)}px`);
    record.canvasDemoHandle?.resize?.();
  }
}

function activeWindowId(layout: MacCanvasLayout, state: MacCanvasState): WindowId | null {
  let activeId: WindowId | null = null;
  let activeZ = -Infinity;

  MAC_WINDOW_IDS.forEach((id) => {
    if (!state.windows[id].open || !windowById(layout, id)) return;
    if (state.windows[id].z > activeZ) {
      activeId = id;
      activeZ = state.windows[id].z;
    }
  });

  return activeId;
}

function setWindowActive(record: MacDomWindowRecord, active: boolean) {
  const next = active ? 'true' : 'false';
  if (record.element.dataset.active === next) return;
  record.element.dataset.active = next;
  syncWindowCanvasActivity(record, active);
}

export function createMacDomWindows(
  root: HTMLElement,
  actions: MacDomWindowActions,
): MacDomWindowController {
  const layer = document.createElement('div');
  layer.className = 'mac-dom-windows';
  layer.dataset.macDomWindows = '';
  root.append(layer);

  const records = new Map<WindowId, MacDomWindowRecord>();
  const visible = new Map<WindowId, boolean>();
  const closing = new Set<WindowId>();
  const animations = new Map<WindowId, Animation>();
  const restoreOrigins = new Map<WindowId, RestoreOrigin>();
  let lastLang: Lang | null = null;
  let latestLayout: MacCanvasLayout | null = null;

  MAC_WINDOW_IDS.forEach((id) => {
    const record = createWindowElement(id, root, actions);
    records.set(id, record);
    layer.append(record.element);

    record.close.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      minimize(id);
    });
  });

  function cancelAnimation(id: WindowId) {
    const animation = animations.get(id);
    if (animation) {
      animation.cancel();
      animations.delete(id);
    }
  }

  function playRestore(record: MacDomWindowRecord, win: WindowLayout, layout: MacCanvasLayout) {
    if (!record.element.animate) return;
    cancelAnimation(record.id);
    const target = restoreTarget(layout, record.id, restoreOrigins.get(record.id) ?? 'dock');
    const animation = record.element.animate(
      [
        { transform: targetTransform(win, target), opacity: 0.18 },
        { transform: rectTransform(win), opacity: 1 },
      ],
      { duration: RESTORE_DURATION, easing: WINDOW_EASING },
    );
    animations.set(record.id, animation);
    animation.finished.finally(() => {
      if (animations.get(record.id) === animation) animations.delete(record.id);
    });
  }

  function minimize(id: WindowId) {
    const layout = latestLayout;
    if (!layout || closing.has(id)) return;
    const win = windowById(layout, id);
    const record = records.get(id);
    if (!win || !record) return;

    closing.add(id);
    cancelAnimation(id);
    actions.bringFront(id);

    // On mobile "back" returns the app to wherever it was launched from.
    const target = layout.mobile
      ? restoreTarget(layout, id, restoreOrigins.get(id) ?? 'dock')
      : dockTarget(layout, id);
    if (!record.element.animate) {
      actions.setOpen(id, false);
      closing.delete(id);
      return;
    }

    const animation = record.element.animate(
      [
        { transform: rectTransform(win), opacity: 1 },
        { transform: targetTransform(win, target), opacity: 0.12 },
      ],
      { duration: MINIMIZE_DURATION, easing: WINDOW_EASING },
    );
    animations.set(id, animation);
    animation.finished.then(() => {
      actions.setOpen(id, false);
      record.element.hidden = true;
    }).finally(() => {
      closing.delete(id);
      if (animations.get(id) === animation) animations.delete(id);
    });
  }

  function sync(layout: MacCanvasLayout, state: MacCanvasState) {
    latestLayout = layout;
    root.__macCanvasLayout = layout;
    const activeId = activeWindowId(layout, state);

    if (lastLang !== state.lang) {
      records.forEach((record) => renderWindowContent(record, state.lang));
      lastLang = state.lang;
    }

    MAC_WINDOW_IDS.forEach((id) => {
      const record = records.get(id);
      if (!record) return;

      const win = windowById(layout, id);
      const isOpen = state.windows[id].open && Boolean(win);
      const wasVisible = visible.get(id) ?? false;

      if (!isOpen) {
        if (!closing.has(id)) record.element.hidden = true;
        setWindowActive(record, false);
        if (wasVisible) releaseWindowCanvasDemo(record);
        visible.set(id, false);
        return;
      }

      const isActive = id === activeId;
      setWindowActive(record, isActive);
      updateWindowLayout(record, win as WindowLayout, layout);
      updateWindowTexts(record, win as WindowLayout, state);
      ensureWindowContentMounted(record);

      if (!wasVisible && !closing.has(id)) {
        playRestore(record, win as WindowLayout, layout);
      }

      visible.set(id, true);
    });
  }

  return {
    minimize,
    setRestoreOrigin(id, origin) {
      restoreOrigins.set(id, origin);
    },
    sync,
    destroy() {
      animations.forEach((animation) => animation.cancel());
      records.forEach((record) => {
        releaseWindowCanvasDemo(record);
        record.cleanup.forEach((cleanup) => cleanup());
      });
      layer.remove();
    },
  };
}

declare global {
  interface HTMLElement {
    __macCanvasLayout?: MacCanvasLayout;
  }
}
