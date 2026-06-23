import { SPATIAL_SCENE_SOURCE_URL } from './macCanvas/apps';
import { div, setText } from './macDomElements';

export type ComparePanelContent = {
  kind: 'photo' | 'spatial';
  sourceTitle: string;
  sourceMeta: string;
  sourceAlt: string;
  note: string;
  actionLabel?: string;
  metrics: Array<{
    value: string;
    label: string;
    tone: 'benefit' | 'cost' | 'neutral';
  }>;
};

export type CalibrationParamSpec = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  precision: number;
};

export function syncComparePanel(details: HTMLElement, content: ComparePanelContent) {
  setText(details.querySelector('[data-compare-source-title]'), content.sourceTitle);
  setText(details.querySelector('[data-compare-source-meta]'), content.sourceMeta);
  setText(details.querySelector('[data-compare-note]'), content.note);
  setText(details.querySelector('[data-compare-action]'), content.actionLabel ?? '');
  const image = details.querySelector('[data-compare-source-image]');
  if (image instanceof HTMLImageElement) {
    image.src = SPATIAL_SCENE_SOURCE_URL;
    image.alt = content.sourceAlt;
  }
  details.querySelectorAll('[data-compare-metric]').forEach((element, index) => {
    const metric = content.metrics[index];
    if (!metric) return;
    (element as HTMLElement).dataset.tone = metric.tone;
    setText(element.querySelector('[data-compare-metric-value]'), metric.value);
    setText(element.querySelector('[data-compare-metric-label]'), metric.label);
  });
}

export function createComparePanel(content: ComparePanelContent, onAction?: () => void) {
  const details = div(`mac-compare__details mac-compare__details--${content.kind}`);
  details.dataset.compareDetails = content.kind;

  const source = div('mac-compare__source');
  const sourceImage = document.createElement('img');
  sourceImage.dataset.compareSourceImage = '';
  const sourceCopy = div('mac-compare__source-copy');
  const sourceHeader = div('mac-compare__source-header');
  const sourceTitle = document.createElement('strong');
  sourceTitle.dataset.compareSourceTitle = '';
  const sourceMeta = document.createElement('span');
  sourceMeta.dataset.compareSourceMeta = '';
  sourceHeader.append(sourceTitle);
  if (content.actionLabel && onAction) {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'mac-compare__action';
    action.dataset.compareAction = '';
    action.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onAction();
    });
    sourceHeader.append(action);
  }
  sourceCopy.append(sourceHeader, sourceMeta);
  source.append(sourceImage, sourceCopy);

  const copy = div('mac-compare__copy');
  const note = document.createElement('p');
  note.className = 'mac-compare__note';
  note.dataset.compareNote = '';
  copy.append(note);

  const metrics = div('mac-compare__metrics');
  content.metrics.forEach(() => {
    const item = div('mac-compare__metric');
    item.dataset.compareMetric = '';
    const strong = document.createElement('strong');
    strong.dataset.compareMetricValue = '';
    const span = document.createElement('span');
    span.dataset.compareMetricLabel = '';
    item.append(strong, span);
    metrics.append(item);
  });

  details.append(source, copy, metrics);
  syncComparePanel(details, content);
  return { details, note };
}

function formatCalibrationValue(value: number, precision: number) {
  return value.toFixed(precision).replace(/\.?0+$/, '');
}

function clampCalibrationValue(value: number, spec: CalibrationParamSpec) {
  if (!Number.isFinite(value)) return spec.value;
  return Math.min(spec.max, Math.max(spec.min, value));
}

function setCalibrationPanelValue(panel: HTMLElement | null | undefined, key: string, value: number) {
  if (!panel || !Number.isFinite(value)) return;
  const row = [...panel.querySelectorAll<HTMLElement>('[data-param-row]')]
    .find((element) => element.dataset.paramRow === key);
  if (!row) return;
  const precision = Number(row.dataset.paramPrecision ?? 3);
  const formatted = formatCalibrationValue(value, precision);
  row.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
    if (document.activeElement === input) return;
    input.value = formatted;
  });
}

export function syncCalibrationPanel(panel: HTMLElement | null | undefined, values: Record<string, number>) {
  if (!panel) return;
  Object.entries(values).forEach(([key, value]) => setCalibrationPanelValue(panel, key, value));
}

function stopCalibrationGesture(event: Event) {
  event.stopPropagation();
}

export function createCalibrationPanel(
  title: string,
  specs: CalibrationParamSpec[],
  onChange: (key: string, value: number) => void,
  onReset: () => void,
) {
  const panel = div('mac-calibration-panel');
  panel.dataset.calibrationPanel = title;

  const header = div('mac-calibration-panel__header');
  const titleEl = document.createElement('strong');
  titleEl.textContent = title;
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Reset';
  reset.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onReset();
  });
  header.append(titleEl, reset);

  const list = div('mac-calibration-panel__list');
  specs.forEach((spec) => {
    const row = div('mac-calibration-panel__row');
    row.dataset.paramRow = spec.key;
    row.dataset.paramPrecision = String(spec.precision);

    const label = document.createElement('label');
    label.textContent = spec.label;

    const range = document.createElement('input');
    range.type = 'range';
    range.min = String(spec.min);
    range.max = String(spec.max);
    range.step = String(spec.step);
    range.value = formatCalibrationValue(spec.value, spec.precision);
    range.setAttribute('aria-label', `${title} ${spec.label}`);

    const number = document.createElement('input');
    number.type = 'number';
    number.min = String(spec.min);
    number.max = String(spec.max);
    number.step = String(spec.step);
    number.value = range.value;
    number.setAttribute('aria-label', `${title} ${spec.label} value`);

    const syncValue = (rawValue: number) => {
      if (!Number.isFinite(rawValue)) return;
      const next = clampCalibrationValue(rawValue, spec);
      const formatted = formatCalibrationValue(next, spec.precision);
      range.value = formatted;
      number.value = formatted;
      onChange(spec.key, next);
    };

    range.addEventListener('input', () => syncValue(Number(range.value)));
    number.addEventListener('input', () => syncValue(Number(number.value)));

    row.append(label, range, number);
    list.append(row);
  });

  panel.addEventListener('pointerdown', stopCalibrationGesture);
  panel.addEventListener('pointermove', stopCalibrationGesture);
  panel.addEventListener('pointerup', stopCalibrationGesture);
  panel.addEventListener('wheel', stopCalibrationGesture, { passive: true });
  panel.append(header, list);
  return panel;
}
