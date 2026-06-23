export function div(className: string) {
  const element = document.createElement('div');
  element.className = className;
  return element;
}

export function setText(element: Element | null | undefined, value: string) {
  if (element && element.textContent !== value) element.textContent = value;
}

export function createAppLoader(label: string) {
  const loader = div('mac-app-loader');
  loader.dataset.appLoader = '';
  loader.dataset.state = 'loading';
  loader.setAttribute('role', 'status');
  loader.setAttribute('aria-live', 'polite');
  loader.setAttribute('aria-label', label);

  const ring = document.createElement('span');
  ring.className = 'mac-app-loader__ring';
  ring.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = 'mac-app-loader__text';
  text.dataset.appLoaderText = '';
  text.textContent = label;

  loader.append(ring, text);
  return loader;
}

export function setAppLoaderState(
  loader: Element | null | undefined,
  state: 'loading' | 'ready' | 'error',
  label: string,
) {
  if (!(loader instanceof HTMLElement)) return;
  loader.hidden = state === 'ready';
  loader.dataset.state = state;
  loader.setAttribute('aria-label', label);
  setText(loader.querySelector('[data-app-loader-text]'), state === 'ready' ? '' : label);
}
