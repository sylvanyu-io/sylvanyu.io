import {
  MAC_BACKGROUND_POINTER_BLOCK_EVENT,
  MAC_DOM_WINDOW_ACTION_EVENT,
  type MacDomWindowActionEventDetail,
} from './macDomWindowEvents';

type WindowElementRecord = {
  element: HTMLElement;
};

export function setCanvasRendering(record: WindowElementRecord, rendering: boolean) {
  const next = rendering ? 'true' : 'false';
  if (record.element.dataset.canvasRendering !== next) {
    record.element.dataset.canvasRendering = next;
  }
}

export function dispatchWindowAction(record: WindowElementRecord, detail: MacDomWindowActionEventDetail) {
  record.element.dispatchEvent(new CustomEvent(MAC_DOM_WINDOW_ACTION_EVENT, { bubbles: true, detail }));
}

export function dispatchBackgroundPointerBlock(record: WindowElementRecord, blocked: boolean) {
  record.element.dispatchEvent(new CustomEvent(MAC_BACKGROUND_POINTER_BLOCK_EVENT, {
    bubbles: true,
    detail: { blocked },
  }));
}
