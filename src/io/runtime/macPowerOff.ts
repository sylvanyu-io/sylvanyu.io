type MacPowerOffActions = {
  onCancel: () => void;
  onComplete: () => void;
};

export type MacPowerOffOverlay = {
  show: () => void;
  hide: () => void;
  setExiting: (exiting: boolean) => void;
  isVisible: () => boolean;
  destroy: () => void;
};

const COMPLETE_THRESHOLD = 0.88;
const FADE_DURATION_MS = 260;
const POWER_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
  + '<path d="M12 3.5v8.2" fill="none" stroke="currentColor" stroke-width="2.35" stroke-linecap="round"/>'
  + '<path d="M7.4 6.9a7.2 7.2 0 1 0 9.2 0" fill="none" stroke="currentColor" stroke-width="2.35" '
  + 'stroke-linecap="round"/></svg>';
const CLOSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
  + '<path d="M7.2 7.2 16.8 16.8M16.8 7.2 7.2 16.8" fill="none" stroke="currentColor" '
  + 'stroke-width="2.5" stroke-linecap="round"/></svg>';

function button(className: string, label: string) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.setAttribute('aria-label', label);
  return element;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function createMacPowerOffOverlay(root: HTMLElement, actions: MacPowerOffActions): MacPowerOffOverlay {
  const abort = new AbortController();
  const element = document.createElement('div');
  element.className = 'mac-power-off';
  element.hidden = true;
  element.setAttribute('aria-hidden', 'true');

  const panel = document.createElement('div');
  panel.className = 'mac-power-off__panel';

  const slider = button('mac-power-off__slider', 'Slide to power off');
  const knob = document.createElement('span');
  knob.className = 'mac-power-off__knob';
  knob.innerHTML = POWER_ICON;
  const label = document.createElement('span');
  label.className = 'mac-power-off__label';
  label.textContent = 'slide to power off';
  slider.append(knob, label);

  const cancel = button('mac-power-off__cancel', 'Cancel power off');
  cancel.innerHTML = CLOSE_ICON;

  panel.append(slider, cancel);
  element.append(panel);
  root.append(element);

  let visible = false;
  let exiting = false;
  let dragging = false;
  let pointerId = -1;
  let startX = 0;
  let startOffset = 0;
  let currentOffset = 0;
  let maxOffset = 1;
  let hideTimer = 0;

  const setSliderOffset = (offset: number) => {
    currentOffset = clamp(offset, 0, maxOffset);
    const progress = maxOffset > 0 ? currentOffset / maxOffset : 0;
    slider.style.setProperty('--mac-power-knob-x', `${Math.round(currentOffset)}px`);
    label.style.opacity = String(clamp(1 - progress * 1.35, 0, 1));
    slider.dataset.ready = progress >= COMPLETE_THRESHOLD ? 'true' : 'false';
  };

  const resetSlider = () => {
    slider.dataset.dragging = 'false';
    setSliderOffset(0);
  };

  const measureSlider = () => {
    const sliderRect = slider.getBoundingClientRect();
    const knobRect = knob.getBoundingClientRect();
    maxOffset = Math.max(1, sliderRect.width - knobRect.width - 8);
  };

  const complete = () => {
    if (exiting) return;
    exiting = true;
    element.dataset.exiting = 'true';
    element.dataset.visible = 'true';
    setSliderOffset(maxOffset);
    actions.onComplete();
  };

  const cancelHideTimer = () => {
    if (!hideTimer) return;
    window.clearTimeout(hideTimer);
    hideTimer = 0;
  };

  const endDrag = (event: PointerEvent) => {
    if (!dragging || event.pointerId !== pointerId) return;
    dragging = false;
    slider.dataset.dragging = 'false';
    if (slider.hasPointerCapture(event.pointerId)) slider.releasePointerCapture(event.pointerId);
    event.preventDefault();

    const progress = maxOffset > 0 ? currentOffset / maxOffset : 0;
    if (progress >= COMPLETE_THRESHOLD) {
      complete();
      return;
    }
    resetSlider();
  };

  slider.addEventListener('pointerdown', (event) => {
    if (!visible || exiting) return;
    measureSlider();
    dragging = true;
    pointerId = event.pointerId;
    startX = event.clientX;
    startOffset = currentOffset;
    slider.dataset.dragging = 'true';
    slider.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, { signal: abort.signal });

  slider.addEventListener('pointermove', (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    setSliderOffset(startOffset + event.clientX - startX);
    event.preventDefault();
  }, { signal: abort.signal });

  slider.addEventListener('pointerup', endDrag, { signal: abort.signal });
  slider.addEventListener('pointercancel', endDrag, { signal: abort.signal });

  cancel.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!visible || exiting) return;
    actions.onCancel();
  }, { signal: abort.signal });

  return {
    show() {
      if (visible) return;
      cancelHideTimer();
      visible = true;
      exiting = false;
      element.hidden = false;
      element.dataset.visible = 'false';
      element.dataset.exiting = 'false';
      element.setAttribute('aria-hidden', 'false');
      resetSlider();
      void element.offsetWidth;
      window.requestAnimationFrame(() => {
        if (visible && !exiting) element.dataset.visible = 'true';
      });
    },
    hide() {
      if (!visible) return;
      cancelHideTimer();
      visible = false;
      exiting = false;
      element.dataset.visible = 'false';
      element.dataset.exiting = 'false';
      element.setAttribute('aria-hidden', 'true');
      resetSlider();
      hideTimer = window.setTimeout(() => {
        hideTimer = 0;
        if (!visible) element.hidden = true;
      }, FADE_DURATION_MS);
    },
    setExiting(next) {
      if (next) {
        cancelHideTimer();
        visible = true;
        element.hidden = false;
        element.dataset.visible = 'true';
        element.setAttribute('aria-hidden', 'false');
      }
      exiting = next;
      element.dataset.exiting = next ? 'true' : 'false';
    },
    isVisible() {
      return visible;
    },
    destroy() {
      cancelHideTimer();
      abort.abort();
      element.remove();
    },
  };
}
