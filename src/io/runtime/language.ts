import type { Lang } from '../data';

const LANGS: Lang[] = ['en', 'zh'];

function isLang(value: string | null): value is Lang {
  return value === 'en' || value === 'zh';
}

export function mountLanguageRoot(root: Element) {
  if (!(root instanceof HTMLElement) || root.dataset.langMounted === 'true') return;
  root.dataset.langMounted = 'true';

  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-lang-toggle]')];

  const setLang = (next: Lang) => {
    root.dataset.lang = next;
    document.documentElement.lang = next;

    buttons.forEach((button) => {
      const buttonLang = button.dataset.langToggle;
      button.setAttribute('aria-pressed', String(buttonLang === next));
    });
  };

  const initial = isLang(root.dataset.lang || null) ? root.dataset.lang : 'en';
  setLang(initial);

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const explicit = button.dataset.langToggle;
      if (isLang(explicit)) {
        setLang(explicit);
        return;
      }

      const current = isLang(root.dataset.lang || null) ? root.dataset.lang : 'en';
      const nextIndex = (LANGS.indexOf(current) + 1) % LANGS.length;
      setLang(LANGS[nextIndex]);
    });
  });
}

export function mountLanguageRoots() {
  document.querySelectorAll('[data-io-lang-root]').forEach(mountLanguageRoot);
}
