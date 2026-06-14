import type { CanvasDemoDefinition, CanvasDemoId, CanvasDemoModule } from './canvasDemoTypes';

const galacean09Scenes = import.meta.glob<CanvasDemoModule>('../../labs/galacean-0-9/scenes/*/index.ts');

export const macCanvasDemos = {
  'planar-reflection': {
    id: 'planar-reflection',
    title: 'Planar Reflection',
    engine: 'Galacean 0.9',
    label: 'PLANAR',
    load: async () => {
      const loadScene = galacean09Scenes['../../labs/galacean-0-9/scenes/planar-reflection/index.ts'];
      if (!loadScene) throw new Error('Planar reflection demo unavailable');
      return loadScene();
    },
  },
} satisfies Record<CanvasDemoId, CanvasDemoDefinition>;

const demoModuleCache = new Map<CanvasDemoId, Promise<CanvasDemoModule>>();

export function loadCanvasDemo(id: CanvasDemoId) {
  let cached = demoModuleCache.get(id);
  if (!cached) {
    cached = macCanvasDemos[id].load();
    cached.catch(() => demoModuleCache.delete(id));
    demoModuleCache.set(id, cached);
  }
  return cached;
}
