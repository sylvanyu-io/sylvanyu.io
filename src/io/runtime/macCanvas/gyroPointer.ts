// Maps device orientation onto a normalized [-1, 1] pointer so the wallpaper
// parallax can follow the phone's tilt. The neutral pose follows the current
// orientation slowly, which both calibrates the first reading and recenters
// after the user settles into a new holding angle.

type PermissionDeviceOrientation = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

const TILT_RANGE_DEG = 24;
const NEUTRAL_FOLLOW = 0.012;

export type GyroPointer = {
  readonly active: boolean;
  readonly x: number;
  readonly y: number;
  /** Starts listening where no permission gate exists (Android, desktop). */
  enable: () => void;
  /** iOS 13+ requires the permission request to run inside a user gesture. */
  unlock: () => void;
  dispose: () => void;
};

export function createGyroPointer(): GyroPointer {
  let active = false;
  let listening = false;
  let x = 0;
  let y = 0;
  let neutralBeta: number | null = null;
  let neutralGamma: number | null = null;

  const onOrientation = (event: DeviceOrientationEvent) => {
    if (event.beta === null || event.gamma === null) return;

    let beta = event.beta;
    let gamma = event.gamma;

    // Landscape: the physical tilt axes swap relative to the screen.
    const angle = typeof screen !== 'undefined' && screen.orientation ? screen.orientation.angle : 0;
    if (angle === 90) {
      [beta, gamma] = [gamma, -beta];
    } else if (angle === -90 || angle === 270) {
      [beta, gamma] = [-gamma, beta];
    }

    if (neutralBeta === null || neutralGamma === null) {
      neutralBeta = beta;
      neutralGamma = gamma;
      return;
    }

    neutralBeta += (beta - neutralBeta) * NEUTRAL_FOLLOW;
    neutralGamma += (gamma - neutralGamma) * NEUTRAL_FOLLOW;

    x = Math.max(-1, Math.min(1, (gamma - neutralGamma) / TILT_RANGE_DEG));
    y = Math.max(-1, Math.min(1, (neutralBeta - beta) / TILT_RANGE_DEG));
    active = true;
  };

  function listen() {
    if (listening) return;
    listening = true;
    window.addEventListener('deviceorientation', onOrientation);
  }

  function enable() {
    if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') return;
    const ctor = DeviceOrientationEvent as PermissionDeviceOrientation;
    if (typeof ctor.requestPermission !== 'function') listen();
  }

  function unlock() {
    if (listening || typeof DeviceOrientationEvent === 'undefined') return;
    const ctor = DeviceOrientationEvent as PermissionDeviceOrientation;
    if (typeof ctor.requestPermission !== 'function') return;
    ctor.requestPermission()
      .then((result) => {
        if (result === 'granted') listen();
      })
      .catch(() => {});
  }

  return {
    get active() {
      return active;
    },
    get x() {
      return x;
    },
    get y() {
      return y;
    },
    enable,
    unlock,
    dispose() {
      if (listening) window.removeEventListener('deviceorientation', onOrientation);
      listening = false;
      active = false;
    },
  };
}
