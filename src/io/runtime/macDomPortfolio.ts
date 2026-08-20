import {
  portfolioArchiveProjects,
  portfolioCases,
  portfolioSideProjects,
  profile,
  videoClips,
} from '../data';
import type { PortfolioEvidence, PortfolioSideProject } from '../data';
import type { Lang } from '../content/common';
import { webGpuProjects } from '../../labs/webgpu/catalog';
import { div } from './macDomElements';
import type { MacDomWindowRecord } from './macDomWindowContent';
import { dispatchWindowAction } from './macDomWindowState';

function section(period: string, titleText: string, bodyText: string) {
  const element = document.createElement('section');
  element.className = 'mac-portfolio-section';

  const header = div('mac-portfolio-section__header');
  const periodLabel = document.createElement('span');
  periodLabel.className = 'mac-portfolio-section__index';
  periodLabel.textContent = period;
  const copy = div('mac-portfolio-section__copy');
  const title = document.createElement('h2');
  title.textContent = titleText;
  const body = document.createElement('p');
  body.textContent = bodyText;
  copy.append(title, body);
  header.append(periodLabel, copy);
  element.append(header);
  return element;
}

function activateEvidence(
  record: MacDomWindowRecord,
  evidence: Exclude<PortfolioEvidence, { type: 'link' }>,
) {
  if (evidence.type === 'video') {
    dispatchWindowAction(record, { type: 'open-window', id: 'video', clipIndex: evidence.clipIndex });
    return;
  }
  dispatchWindowAction(record, { type: 'open-window', id: evidence.windowId });
}

function evidenceLinks(
  record: MacDomWindowRecord,
  evidence: readonly PortfolioEvidence[],
) {
  const links = div('mac-portfolio-evidence');
  evidence.forEach((item) => {
    if (item.type === 'link') {
      const link = document.createElement('a');
      link.href = item.href;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = `${item.label} ↗`;
      links.append(link);
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.type === 'video' ? `▶ ${item.label}` : `${item.label} ↗`;
    button.addEventListener('click', () => activateEvidence(record, item));
    links.append(button);
  });
  return links;
}

function videoPreview(
  record: MacDomWindowRecord,
  lang: Lang,
  evidence: Extract<PortfolioEvidence, { type: 'video' }>,
) {
  const clip = videoClips[lang][evidence.clipIndex];
  if (!clip) return null;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mac-portfolio-proof-video';
  button.setAttribute('aria-label', `${lang === 'zh' ? '播放' : 'Play'} ${clip.title}`);
  button.addEventListener('click', () => activateEvidence(record, evidence));

  const media = div('mac-portfolio-proof-video__media');
  const poster = document.createElement('img');
  poster.src = clip.poster;
  poster.alt = '';
  poster.loading = 'lazy';
  poster.decoding = 'async';
  const play = document.createElement('span');
  play.textContent = '▶';
  media.append(poster, play);

  const copy = div('mac-portfolio-proof-video__copy');
  const label = document.createElement('small');
  label.textContent = evidence.label;
  const title = document.createElement('strong');
  title.textContent = clip.title;
  const date = document.createElement('span');
  date.textContent = clip.date ?? '';
  copy.append(label, title, date);
  button.append(media, copy);
  return button;
}

type ShowcaseTile = {
  area: 'webgpu' | 'photo3d' | 'y2k' | 'tabrecap';
  label: string;
  title: string;
  detail: string;
  image: string;
  alt: string;
  href?: string;
  action?: () => void;
};

function renderShowcase(record: MacDomWindowRecord, lang: Lang) {
  const photo3d = videoClips[lang][0];
  const webgpu = webGpuProjects.find((project) => project.slug === '2d-gi');
  const grid = div('mac-portfolio-showcase');

  const tiles: ShowcaseTile[] = [
    ...(webgpu ? [{
      area: 'webgpu' as const,
      label: lang === 'zh' ? 'WEBGPU · 打开' : 'WEBGPU · OPEN',
      title: '2D Global Illumination',
      detail: lang === 'zh' ? '软体、遮挡与光照全留在 GPU' : 'Soft bodies, occlusion, and light stay on the GPU',
      image: webgpu.cover,
      alt: webgpu.coverAlt,
      href: webgpu.href,
    }] : []),
    {
      area: 'photo3d',
      label: lang === 'zh' ? '空间照片 · 打开' : 'SPATIAL PHOTO · OPEN',
      title: 'Photo3D',
      detail: lang === 'zh' ? '一张图，分层后跑在 Web、RN 与 Metal' : 'One image, layered for Web, RN, and Metal',
      image: photo3d.poster,
      alt: photo3d.title,
      action: () => dispatchWindowAction(record, { type: 'open-window', id: 'photo' }),
    },
    {
      area: 'y2k',
      label: lang === 'zh' ? 'WEBGL 2 · 打开' : 'WEBGL 2 · OPEN',
      title: 'Y2K Type Lab',
      detail: lang === 'zh' ? '逐字排版、材质与反射光场' : 'Per-glyph layout, materials, and reflection fields',
      image: '/lab-covers/y2k-type-lab.webp',
      alt: 'Y2K Type Lab editor',
      href: 'https://sylvanyu.io/y2k-type-lab/',
    },
    {
      area: 'tabrecap',
      label: lang === 'zh' ? 'CHROME 工具 · 源码' : 'CHROME TOOL · SOURCE',
      title: 'TabRecap',
      detail: lang === 'zh' ? '整理标签页，也整理一段工作的来龙去脉' : 'Organize tabs and reconstruct a work session',
      image: '/lab-covers/tab-recap.jpg',
      alt: 'TabRecap browser side panel',
      href: 'https://github.com/sylvanyu-io/tab-recap',
    },
  ];

  tiles.forEach((tile) => {
    const element = document.createElement(tile.href ? 'a' : 'button');
    element.className = 'mac-portfolio-showcase__tile';
    element.dataset.area = tile.area;

    if (element instanceof HTMLAnchorElement && tile.href) {
      element.href = tile.href;
      element.target = '_blank';
      element.rel = 'noreferrer';
    } else if (element instanceof HTMLButtonElement) {
      element.type = 'button';
      element.addEventListener('click', () => tile.action?.());
    }

    const image = document.createElement('img');
    image.src = tile.image;
    image.alt = tile.alt;
    image.decoding = 'async';

    const shade = div('mac-portfolio-showcase__shade');
    const copy = div('mac-portfolio-showcase__copy');
    const label = document.createElement('span');
    label.textContent = tile.label;
    const title = document.createElement('strong');
    title.textContent = tile.title;
    const detail = document.createElement('small');
    detail.textContent = tile.detail;
    copy.append(label, title, detail);
    element.append(image, shade, copy);
    grid.append(element);
  });

  return grid;
}

function renderCases(record: MacDomWindowRecord, lang: Lang, ids: readonly string[]) {
  const list = div('mac-portfolio-cases');
  const projects = ids
    .map((id) => portfolioCases[lang].find((project) => project.id === id))
    .filter((project): project is (typeof portfolioCases)[Lang][number] => Boolean(project));

  projects.forEach((project, index) => {
    const article = document.createElement('article');
    article.className = 'mac-portfolio-case';
    article.dataset.index = String(index + 1).padStart(2, '0');

    const main = div('mac-portfolio-case__main');
    const meta = document.createElement('p');
    meta.className = 'mac-portfolio-case__meta';
    meta.textContent = project.meta;
    const title = document.createElement('h3');
    title.textContent = project.title;
    const lead = document.createElement('p');
    lead.className = 'mac-portfolio-case__lead';
    lead.textContent = project.lead;

    const highlights = document.createElement('ul');
    highlights.className = 'mac-portfolio-case__highlights';
    project.highlights.forEach((highlight) => {
      const item = document.createElement('li');
      item.textContent = highlight;
      highlights.append(item);
    });

    const footer = div('mac-portfolio-case__footer');
    const metrics = div('mac-portfolio-case__metrics');
    project.metrics.forEach((metric) => {
      const item = document.createElement('span');
      item.textContent = metric;
      metrics.append(item);
    });
    footer.append(metrics, evidenceLinks(record, project.evidence));
    main.append(meta, title, lead, highlights, footer);

    const video = project.evidence.find(
      (item): item is Extract<PortfolioEvidence, { type: 'video' }> => item.type === 'video',
    );
    const preview = video ? videoPreview(record, lang, video) : null;
    if (preview) article.append(main, preview);
    else article.append(main);
    list.append(article);
  });

  return list;
}

function renderWebGpuEntries(project: PortfolioSideProject, lang: Lang) {
  const list = div('mac-portfolio-side__labs');
  project.labSlugs?.forEach((slug, index) => {
    const lab = webGpuProjects.find((entry) => entry.slug === slug);
    if (!lab) return;

    const item = document.createElement('article');
    item.className = 'mac-portfolio-side-lab';
    if (slug === 'grass-system' || slug === 'relic-block') item.dataset.secondary = 'true';

    const number = document.createElement('span');
    number.textContent = String(index + 1).padStart(2, '0');
    const copy = div('mac-portfolio-side-lab__copy');
    const title = document.createElement('strong');
    title.textContent = lab.title;
    const description = document.createElement('p');
    description.textContent = lang === 'zh' ? lab.descriptionZh : lab.description;
    copy.append(title, description);

    const links = div('mac-portfolio-side-lab__links');
    [
      { label: lang === 'zh' ? '打开' : 'Open', href: lab.href },
      { label: lang === 'zh' ? '源码' : 'Code', href: lab.sourceHref },
      { label: lang === 'zh' ? '笔记' : 'Notes', href: lab.notesHref },
    ].forEach((target) => {
      const link = document.createElement('a');
      link.href = target.href;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = `${target.label} ↗`;
      links.append(link);
    });

    item.append(number, copy, links);
    list.append(item);
  });
  return list;
}

function renderSideProjects(record: MacDomWindowRecord, lang: Lang) {
  const list = div('mac-portfolio-side');
  portfolioSideProjects[lang].forEach((project, index) => {
    const article = document.createElement('article');
    article.className = 'mac-portfolio-side__item';
    article.dataset.index = String(index + 1).padStart(2, '0');
    article.dataset.project = project.id;

    const video = project.evidence.find(
      (item): item is Extract<PortfolioEvidence, { type: 'video' }> => item.type === 'video',
    );
    const clip = video ? videoClips[lang][video.clipIndex] : null;
    const coverSource = project.cover ?? clip?.poster;
    if (coverSource) {
      const cover = document.createElement(video ? 'button' : 'div');
      cover.className = 'mac-portfolio-side__cover';
      if (cover instanceof HTMLButtonElement && video) {
        cover.type = 'button';
        cover.addEventListener('click', () => activateEvidence(record, video));
      }
      const image = document.createElement('img');
      image.src = coverSource;
      image.alt = project.coverAlt ?? '';
      image.loading = 'lazy';
      image.decoding = 'async';
      cover.append(image);
      if (video) {
        const play = document.createElement('span');
        play.textContent = '▶';
        cover.append(play);
      }
      article.append(cover);
    }

    const copy = div('mac-portfolio-side__copy');
    const meta = document.createElement('p');
    meta.className = 'mac-portfolio-side__meta';
    meta.textContent = project.meta;
    const title = document.createElement('h3');
    title.textContent = project.title;
    const description = document.createElement('p');
    description.className = 'mac-portfolio-side__description';
    description.textContent = project.description;
    copy.append(meta, title, description);

    project.details.forEach((detail) => {
      const body = document.createElement('p');
      body.className = 'mac-portfolio-side__detail';
      body.textContent = detail;
      copy.append(body);
    });
    copy.append(evidenceLinks(record, project.evidence));
    if (project.labSlugs?.length) copy.append(renderWebGpuEntries(project, lang));
    article.append(copy);
    list.append(article);
  });
  return list;
}

function renderArchive(lang: Lang) {
  const wrap = div('mac-portfolio-archive');
  const title = document.createElement('h3');
  title.textContent = lang === 'zh' ? '更早的项目' : 'Earlier projects';
  const list = div('mac-portfolio-archive__list');
  portfolioArchiveProjects[lang].forEach((project) => {
    const link = document.createElement('a');
    link.href = project.href;
    link.target = '_blank';
    link.rel = 'noreferrer';
    const name = document.createElement('strong');
    name.textContent = project.title;
    const note = document.createElement('span');
    note.textContent = project.note;
    link.append(name, note);
    list.append(link);
  });
  wrap.append(title, list);
  return wrap;
}

function renderContact() {
  const links = div('mac-portfolio-links');
  const email = document.createElement('a');
  email.href = `mailto:${profile.email}`;
  email.textContent = profile.email;
  links.append(email);

  profile.socials.forEach((social) => {
    const link = document.createElement('a');
    link.href = social.href;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = `${social.label} ↗`;
    links.append(link);
  });
  return links;
}

export function renderPortfolio(record: MacDomWindowRecord, lang: Lang) {
  record.body.replaceChildren();

  const shell = div('mac-lab-gallery mac-lab-gallery--portfolio mac-portfolio');
  const header = div('mac-lab-gallery__header mac-portfolio__header');
  const heading = div('mac-lab-gallery__heading');
  const eyebrow = document.createElement('span');
  eyebrow.className = 'mac-lab-gallery__eyebrow';
  eyebrow.textContent = 'SYLVAN YU · GRAPHICS / ENGINE / TOOLING';
  const title = document.createElement('h2');
  title.textContent = lang === 'zh'
    ? '我做渲染器，也做让它真正被用起来的工具。'
    : 'I build renderers—and the tools that make them usable.';
  const intro = document.createElement('p');
  intro.textContent = lang === 'zh'
    ? '实时动效引擎、Web 编辑器、移动端运行时，以及工作之外继续做的浏览器工具和 WebGPU 实验。'
    : 'Real-time motion engines, web editors, mobile runtimes, and the browser tools and WebGPU experiments I keep building after work.';
  heading.append(eyebrow, title, intro);

  const headerLinks = div('mac-lab-gallery__header-links');
  const email = document.createElement('a');
  email.href = `mailto:${profile.email}`;
  email.textContent = lang === 'zh' ? '联系' : 'Contact';
  const github = document.createElement('a');
  github.href = profile.github;
  github.target = '_blank';
  github.rel = 'noreferrer';
  github.textContent = 'GitHub ↗';
  headerLinks.append(email, github);
  header.append(heading, headerLinks);

  const predy = section(
    'REDNOTE',
    'Predy',
    lang === 'zh' ? '跨 Web、RN、iOS 和 Android 的实时动效引擎与编辑器。' : 'A real-time motion engine and editor spanning Web, RN, iOS, and Android.',
  );
  predy.append(renderCases(record, lang, ['predy-runtime', 'photo3d', 'predy-agent', 'production']));

  const galacean = section(
    'ANT GROUP',
    'Galacean / Alipay',
    lang === 'zh' ? '从 DCC 资产到 WebGL Runtime 的引擎、Shader 和生产工具链。' : 'Engines, shaders, and production tooling from DCC assets to the WebGL runtime.',
  );
  galacean.append(renderCases(record, lang, ['galacean', 'alipay-products', 'xr']));

  const independent = section(
    'INDEPENDENT',
    lang === 'zh' ? '个人项目' : 'Independent',
    lang === 'zh' ? '浏览器工具、WebGPU 实验，以及我想顺手做完的小东西。' : 'Browser tools, WebGPU experiments, and smaller ideas I wanted to finish properly.',
  );
  independent.append(renderSideProjects(record, lang), renderArchive(lang));

  const contact = section(
    'CONTACT',
    lang === 'zh' ? '联系' : 'Contact',
    lang === 'zh' ? '邮箱和公开主页。' : 'Email and public profiles.',
  );
  contact.append(renderContact());

  const nav = div('mac-portfolio__nav');
  [
    { label: 'Predy', note: 'RedNote', target: predy },
    { label: 'Galacean', note: 'Alipay', target: galacean },
    { label: lang === 'zh' ? '个人项目' : 'Independent', note: 'Labs', target: independent },
    { label: lang === 'zh' ? '联系' : 'Contact', note: 'Links', target: contact },
  ].forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    const label = document.createElement('span');
    label.textContent = item.label;
    const note = document.createElement('small');
    note.textContent = item.note;
    button.append(label, note);
    button.addEventListener('click', () => item.target.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    nav.append(button);
  });

  shell.append(header, renderShowcase(record, lang), nav, predy, galacean, independent, contact);
  record.body.append(shell);
}
