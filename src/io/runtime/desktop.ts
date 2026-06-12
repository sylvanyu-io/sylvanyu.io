type WindowState = {
  element: HTMLElement;
  x: number;
  y: number;
  z: number;
  open: boolean;
};

type DragState = {
  id: string;
  pointerId: number;
  dx: number;
  dy: number;
  handle: HTMLElement;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function numberFromStyle(element: HTMLElement, prop: 'left' | 'top', fallback: number) {
  const value = Number.parseFloat(element.style[prop] || '');
  return Number.isFinite(value) ? value : fallback;
}

function formatClock(root: HTMLElement) {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const hms = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const daysEn = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const daysZh = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const lang = root.dataset.lang === 'zh' ? 'zh' : 'en';
  const date = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${
    lang === 'zh' ? daysZh[now.getDay()] : daysEn[now.getDay()]
  } · SHANGHAI`;

  root.querySelectorAll<HTMLElement>('[data-clock="hms"]').forEach((element) => {
    element.textContent = hms;
  });
  root.querySelectorAll<HTMLElement>('[data-clock="hm"]').forEach((element) => {
    element.textContent = hm;
  });
  root.querySelectorAll<HTMLElement>('[data-clock="date"]').forEach((element) => {
    element.textContent = date;
  });

  const wallpaper = root.querySelector('photo3d-view') as (HTMLElement & { _fps?: number }) | null;
  const fps = wallpaper?._fps ? String(Math.round(wallpaper._fps)) : '—';
  root.querySelectorAll<HTMLElement>('[data-wallpaper-fps]').forEach((element) => {
    element.textContent = fps;
  });
  root.querySelectorAll<HTMLElement>('[data-ship-years]').forEach((element) => {
    element.textContent = String(now.getFullYear() - 2022);
  });
}

export function mountDesktop(root: Element) {
  if (!(root instanceof HTMLElement) || root.dataset.desktopMounted === 'true') return;
  root.dataset.desktopMounted = 'true';

  const states = new Map<string, WindowState>();
  let maxZ = 20;
  let drag: DragState | null = null;

  root.querySelectorAll<HTMLElement>('[data-window]').forEach((element, index) => {
    const id = element.dataset.window;
    if (!id) return;

    const z = Number.parseInt(element.style.zIndex || '', 10);
    const open = element.dataset.open !== 'false';
    if (!open) element.hidden = true;

    const state: WindowState = {
      element,
      x: numberFromStyle(element, 'left', 120 + index * 36),
      y: numberFromStyle(element, 'top', 72 + index * 26),
      z: Number.isFinite(z) ? z : 12 + index,
      open,
    };
    states.set(id, state);
    maxZ = Math.max(maxZ, state.z);
  });

  const syncChrome = () => {
    states.forEach((state, id) => {
      state.element.hidden = !state.open;
      state.element.style.left = `${state.x}px`;
      state.element.style.top = `${state.y}px`;
      state.element.style.zIndex = String(state.z);
      state.element.dataset.open = String(state.open);

      root.querySelectorAll<HTMLElement>(`[data-window-dot="${id}"]`).forEach((dot) => {
        dot.dataset.on = String(state.open);
      });
      root.querySelectorAll<HTMLButtonElement>(`[data-window-task="${id}"]`).forEach((button) => {
        button.classList.toggle('is-open', state.open);
      });
    });

    root.dispatchEvent(new CustomEvent('desktop:layout'));
  };

  const focusWindow = (id: string) => {
    const state = states.get(id);
    if (!state) return;
    maxZ += 1;
    state.z = maxZ;
    state.open = true;
    syncChrome();
  };

  const setOpen = (id: string, open: boolean) => {
    const state = states.get(id);
    if (!state) return;
    state.open = open;
    if (open) {
      maxZ += 1;
      state.z = maxZ;
    }
    syncChrome();
  };

  root.addEventListener('pointerdown', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const closeButton = target.closest<HTMLElement>('[data-close-window]');
    if (closeButton) {
      const id = closeButton.dataset.closeWindow;
      if (id) {
        event.stopPropagation();
        setOpen(id, false);
      }
      return;
    }

    const openButton = target.closest<HTMLElement>('[data-open-window]');
    if (openButton) {
      const id = openButton.dataset.openWindow;
      if (id) {
        event.preventDefault();
        focusWindow(id);
      }
      return;
    }

    const openAll = target.closest<HTMLElement>('[data-open-all-windows]');
    if (openAll) {
      event.preventDefault();
      states.forEach((_, id) => setOpen(id, true));
      return;
    }

    const windowElement = target.closest<HTMLElement>('[data-window]');
    if (windowElement?.dataset.window) {
      focusWindow(windowElement.dataset.window);
    }
  });

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const taskButton = target.closest<HTMLButtonElement>('[data-window-task]');
    if (taskButton?.dataset.windowTask) {
      const id = taskButton.dataset.windowTask;
      const state = states.get(id);
      if (state?.open) focusWindow(id);
      else setOpen(id, true);
    }
  });

  root.querySelectorAll<HTMLElement>('[data-drag-window]').forEach((handle) => {
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (target instanceof Element && target.closest('button, a, input, textarea, select')) return;

      const id = handle.dataset.dragWindow;
      const state = id ? states.get(id) : undefined;
      if (!id || !state) return;

      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      focusWindow(id);
      drag = {
        id,
        pointerId: event.pointerId,
        dx: event.clientX - state.x,
        dy: event.clientY - state.y,
        handle,
      };
      handle.classList.add('is-dragging');
    });
  });

  const moveDrag = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const state = states.get(drag.id);
    if (!state) return;

    const bounds = root.getBoundingClientRect();
    const minY = root.dataset.desktopStyle === 'y2k' ? 0 : 36;
    const maxX = Math.max(80, bounds.width - 80);
    const maxY = Math.max(minY, bounds.height - 70);
    state.x = clamp(event.clientX - bounds.left - drag.dx, -220, maxX);
    state.y = clamp(event.clientY - bounds.top - drag.dy, minY, maxY);
    syncChrome();
  };

  const stopDrag = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (drag.handle.hasPointerCapture(event.pointerId)) {
      drag.handle.releasePointerCapture(event.pointerId);
    }
    drag.handle.classList.remove('is-dragging');
    drag = null;
  };

  root.addEventListener('pointermove', moveDrag);
  root.addEventListener('pointerup', stopDrag);
  root.addEventListener('pointercancel', stopDrag);

  formatClock(root);
  const clockTimer = window.setInterval(() => formatClock(root), 1000);
  const observer = new MutationObserver(() => formatClock(root));
  observer.observe(root, { attributes: true, attributeFilter: ['data-lang'] });

  syncChrome();

  window.addEventListener(
    'pagehide',
    () => {
      window.clearInterval(clockTimer);
      observer.disconnect();
    },
    { once: true },
  );
}

export function mountDesktops() {
  document.querySelectorAll('[data-desktop-root]').forEach(mountDesktop);
}
