import {
  desktopCopy,
  desktopProjects,
  logLines,
  profile,
} from '../data';
import type { Lang } from '../content/common';
import { div } from './macDomElements';
import type { MacDomWindowRecord } from './macDomWindowContent';

function socialIcon(key: string) {
  if (key === 'github') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.4a9.6 9.6 0 0 0-3 18.7c.48.1.66-.2.66-.46v-1.7c-2.68.58-3.24-1.14-3.24-1.14-.44-1.1-1.08-1.4-1.08-1.4-.88-.6.07-.6.07-.6.98.07 1.5 1 1.5 1 .86 1.48 2.27 1.06 2.82.8.09-.63.34-1.06.62-1.3-2.14-.24-4.4-1.07-4.4-4.76 0-1.05.38-1.9 1-2.58-.1-.25-.43-1.23.1-2.55 0 0 .82-.26 2.66 1a9.2 9.2 0 0 1 4.86 0c1.84-1.26 2.65-1 2.65-1 .54 1.32.2 2.3.1 2.55.63.68 1 1.53 1 2.58 0 3.7-2.26 4.52-4.4 4.76.35.3.66.9.66 1.8v2.54c0 .26.18.56.67.46A9.6 9.6 0 0 0 12 2.4Z" fill="currentColor"/></svg>';
  }
  if (key === 'linkedin') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.1 8.8h3.2v10.3H5.1V8.8Zm1.6-5a1.86 1.86 0 1 1 0 3.72 1.86 1.86 0 0 1 0-3.72Zm3.7 5h3.08v1.4h.04c.43-.82 1.48-1.69 3.05-1.69 3.26 0 3.86 2.15 3.86 4.94v5.66h-3.2v-5.02c0-1.2-.02-2.74-1.67-2.74-1.67 0-1.93 1.3-1.93 2.65v5.11h-3.2V8.8Z" fill="currentColor"/></svg>';
  }
  if (key === 'rednote') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="4.2" width="16" height="15.6" rx="4" fill="currentColor"/><path d="M8 9.1h8M8 12h8M8 14.9h5.2" fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16.4" cy="7.8" r="1.1" fill="currentColor"/></svg>';
}

export function renderReadme(record: MacDomWindowRecord, lang: Lang) {
  const copy = desktopCopy[lang];
  record.body.replaceChildren();

  const eyebrow = document.createElement('p');
  eyebrow.className = 'mac-readme__eyebrow';
  eyebrow.textContent = 'SYLVAN YU';

  const title = document.createElement('h1');
  title.className = 'mac-readme__title';
  title.textContent = copy.readmeTitle;

  const body = document.createElement('p');
  body.className = 'mac-readme__copy';
  body.textContent = copy.readmeBody;

  const chips = div('mac-readme__chips');
  copy.chips.forEach((chip) => {
    const item = document.createElement('span');
    item.textContent = chip;
    chips.append(item);
  });

  const actions = div('mac-readme__actions');
  const email = document.createElement('a');
  email.className = 'mac-readme__email';
  email.href = `mailto:${profile.email}`;
  email.textContent = profile.email;

  const socials = div('mac-readme__socials');
  profile.socials.forEach((social) => {
    const link = document.createElement('a');
    link.className = 'mac-readme__social-link';
    link.href = social.href;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.innerHTML = socialIcon(social.icon);
    link.title = social.label;
    link.setAttribute('aria-label', social.label);
    link.dataset.social = social.key;
    socials.append(link);
  });

  actions.append(email, socials);

  record.body.append(eyebrow, title, body, chips, actions);
}

export function renderWorklog(record: MacDomWindowRecord, lang: Lang) {
  const panel = div('mac-worklog__panel');
  panel.setAttribute('aria-label', 'work log');

  logLines[lang].forEach((line) => {
    const row = document.createElement('p');
    row.dataset.tone = line.tone;
    row.textContent = line.text;
    panel.append(row);
  });

  record.body.replaceChildren(panel);
}

export function renderProjects(record: MacDomWindowRecord, lang: Lang) {
  record.body.replaceChildren();

  const projects = desktopProjects[lang];
  const shell = div('mac-projects');
  const header = div('mac-projects__header');
  const headerCopy = div('mac-projects__header-copy');
  const eyebrow = document.createElement('span');
  eyebrow.className = 'mac-projects__eyebrow';
  eyebrow.textContent = lang === 'zh' ? 'PROJECT INDEX / 视觉系统' : 'PROJECT INDEX / VISUAL SYSTEMS';
  const title = document.createElement('h2');
  title.textContent = lang === 'zh' ? '从引擎到产品现场' : 'Systems that reached product';
  const intro = document.createElement('p');
  intro.textContent = lang === 'zh'
    ? '把实时渲染、编辑器、AI 基建和跨端运行时放在同一个可扫读的项目索引里。'
    : 'A scan-first index of real-time rendering, editor tooling, AI infrastructure, and cross-platform runtime work.';
  headerCopy.append(eyebrow, title, intro);
  header.append(headerCopy);
  shell.append(header);

  const list = div('mac-projects__list');
  projects.forEach((project, index) => {
    const article = document.createElement('article');
    article.className = 'mac-project';
    article.dataset.index = String(index + 1).padStart(2, '0');

    const copy = div('mac-project__copy');
    const title = document.createElement('h2');
    title.textContent = project.title;
    const meta = document.createElement('p');
    meta.className = 'mac-project__meta';
    meta.textContent = project.meta;
    const body = document.createElement('p');
    body.className = 'mac-project__body';
    body.textContent = project.body;
    copy.append(title, meta, body);

    const metric = div('mac-project__metric');
    const value = document.createElement('strong');
    value.textContent = project.metric;
    const label = document.createElement('span');
    label.textContent = project.metricLabel;
    metric.append(value, label);

    article.append(copy, metric);
    list.append(article);
  });

  shell.append(list);
  record.body.append(shell);
}

