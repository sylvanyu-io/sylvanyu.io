import type { WindowId } from './macCanvas/windowTypes';

export const MAC_DOM_WINDOW_ACTION_EVENT = 'mac-dom-window-action';
export const MAC_BACKGROUND_POINTER_BLOCK_EVENT = 'mac-background-pointer-block';

export type MacDomWindowActionEventDetail =
  | {
      type: 'open-window';
      id: WindowId;
      clipIndex?: number;
    }
  | {
      type: 'focus-window';
      id: WindowId;
    }
  | {
      type: 'fit-video-window';
      aspectRatio: number;
    }
  | {
      type: 'compare-photo-sharp';
    };
