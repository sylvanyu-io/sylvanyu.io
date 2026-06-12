import type { Lang } from '../content/common';
import type { MacCanvasLayout, MacCanvasState, Rect, WindowId, WindowLayout } from './macCanvas/ui';
import { MAC_WINDOW_IDS } from './macCanvas/ui';
import {
  PHOTO_APP_HUD_HEIGHT,
  type MacDomWindowRecord,
  renderWindowContent,
  updateWindowTexts,
} from './macDomWindowContent';

type MacDomWindowActions = {
  bringFront: (id: WindowId) => void;
  setOpen: (id: WindowId, open: boolean) => void;
  moveWindow: (id: WindowId, x: number, y: number) => void;
};

type MacDomWindowController = {
  sync: (layout: MacCanvasLayout, state: MacCanvasState) => void;
  destroy: () => void;
};

type DragState = {
  id: WindowId;
  pointerId: number;
  offsetX: number;
  offsetY: number;
};

const MINIMIZE_DURATION = 240;
const RESTORE_DURATION = 260;
const WINDOW_EASING = 'cubic-bezier(.2,.8,.2,1)';

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

  const close = button('mac-dom-window__close', `Minimize ${id}`);
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

  const startDrag = (clientX: number, clientY: number, pointerId: number) => {
    const layout = currentLayout(root);
    const win = layout ? windowById(layout, id) : null;
    if (!win) return;

    const rect = root.getBoundingClientRect();
    const point = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
    actions.bringFront(id);
    dragState = {
      id,
      pointerId,
      offsetX: point.x - win.x,
      offsetY: point.y - win.y,
    };
    element.dataset.dragging = 'true';
  };

  const updateDrag = (clientX: number, clientY: number) => {
    if (!dragState) return;
    const rect = root.getBoundingClientRect();
    actions.moveWindow(id, clientX - rect.left - dragState.offsetX, clientY - rect.top - dragState.offsetY);
  };

  const endDrag = () => {
    if (!dragState) return;
    dragState = null;
    element.dataset.dragging = 'false';
  };

  titlebar.addEventListener('pointerdown', (event) => {
    if (event.target === close) return;
    startDrag(event.clientX, event.clientY, event.pointerId);
    titlebar.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  listen('pointermove', (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    updateDrag(event.clientX, event.clientY);
    event.preventDefault();
  });

  const endPointerDrag = (event: PointerEvent) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    endDrag();
    if (titlebar.hasPointerCapture(event.pointerId)) titlebar.releasePointerCapture(event.pointerId);
    event.preventDefault();
  };

  listen('pointerup', endPointerDrag);
  listen('pointercancel', endPointerDrag);

  titlebar.addEventListener('mousedown', (event) => {
    if (event.target === close || dragState) return;
    startDrag(event.clientX, event.clientY, -1);
    event.preventDefault();
  });

  listen('mousemove', (event) => {
    if (!dragState || dragState.pointerId !== -1) return;
    updateDrag(event.clientX, event.clientY);
    event.preventDefault();
  });

  listen('mouseup', (event) => {
    if (!dragState || dragState.pointerId !== -1) return;
    endDrag();
    event.preventDefault();
  });

  return record;
}

function currentLayout(root: HTMLElement): MacCanvasLayout | null {
  return (root as HTMLElement & { __macCanvasLayout?: MacCanvasLayout }).__macCanvasLayout ?? null;
}

function updateWindowLayout(record: MacDomWindowRecord, win: WindowLayout) {
  const { element } = record;
  element.hidden = false;
  element.dataset.tone = win.id === 'worklog' ? 'dark' : 'light';
  element.style.width = `${Math.round(win.w)}px`;
  element.style.height = `${Math.round(win.h)}px`;
  element.style.borderRadius = `${win.r}px`;
  element.style.transform = rectTransform(win);
  element.style.zIndex = String(1000 + win.z);
  element.style.setProperty('--mac-window-title-h', `${win.titleH}px`);

  if (win.id === 'photo' && win.stage && win.note) {
    element.style.setProperty('--mac-photo-stage-h', `${Math.max(1, win.stage.h)}px`);
    element.style.setProperty('--mac-photo-hud-h', `${PHOTO_APP_HUD_HEIGHT}px`);
    element.style.setProperty('--mac-photo-note-h', `${win.note.h}px`);
  }
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

  function playRestore(record: WindowRecord, win: WindowLayout, layout: MacCanvasLayout) {
    if (!record.element.animate) return;
    cancelAnimation(record.id);
    const target = dockTarget(layout, record.id);
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

    const target = dockTarget(layout, id);
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
        visible.set(id, false);
        return;
      }

      updateWindowLayout(record, win as WindowLayout);
      updateWindowTexts(record, win as WindowLayout, state);

      if (!wasVisible && !closing.has(id)) {
        playRestore(record, win as WindowLayout, layout);
      }

      visible.set(id, true);
    });
  }

  return {
    sync,
    destroy() {
      animations.forEach((animation) => animation.cancel());
      records.forEach((record) => {
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
