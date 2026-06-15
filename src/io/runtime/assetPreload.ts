type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
};

export function scheduleIdleImagePreload(url: string, delayMs = 2000) {
  let started = false;

  const preload = () => {
    if (started) return;
    started = true;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    link.crossOrigin = 'anonymous';
    link.type = 'image/png';
    link.setAttribute('fetchpriority', 'low');
    document.head.appendChild(link);
  };

  const queueIdlePreload = () => {
    window.setTimeout(() => {
      const idleWindow = window as IdleWindow;
      if (idleWindow.requestIdleCallback) {
        idleWindow.requestIdleCallback(preload, { timeout: 5000 });
      } else {
        window.setTimeout(preload, 1000);
      }
    }, delayMs);
  };

  if (document.readyState === 'complete') {
    queueIdlePreload();
  } else {
    window.addEventListener('load', queueIdlePreload, { once: true });
  }
}
