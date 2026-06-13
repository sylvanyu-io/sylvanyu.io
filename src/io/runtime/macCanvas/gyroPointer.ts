// Maps device orientation onto a normalized [-1, 1] pointer so the wallpaper
// parallax can follow the phone's tilt. The neutral pose follows the current
// orientation slowly, which both calibrates the first reading and recenters
// after the user settles into a new holding angle.

type PermissionDeviceOrientation = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

type PermissionDeviceMotion = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

const TILT_RANGE_DEG = 24;
const NEUTRAL_FOLLOW = 0.012;

export type GyroPointer = {
  readonly active: boolean;
  readonly x: number;
  readonly y: number;
  readonly permissionState: 'idle' | 'prompt' | 'granted' | 'denied' | 'unsupported' | 'insecure';
  /** Starts listening where no permission gate exists (Android, desktop). */
  enable: () => void;
  /** iOS 13+ requires the permission request to run inside a user gesture. */
  unlock: () => Promise<boolean>;
  dispose: () => void;
};

export function createGyroPointer(): GyroPointer {
  let active = false;
  let listening = false;
  let x = 0;
  let y = 0;
  let neutralBeta: number | null = null;
  let neutralGamma: number | null = null;
  let pendingUnlock: Promise<boolean> | null = null;
  let permissionState: GyroPointer['permissionState'] = 'idle';

  const onOrientation = (event: DeviceOrientationEvent) => {
    if (event.beta === null || event.gamma === null) return;

    let beta = event.beta;
    let gamma = event.gamma;

    // Landscape: the physical tilt axes swap relative to the screen.
    const legacyOrientation = (window as Window & { orientation?: number }).orientation;
    const angle = typeof screen !== 'undefined' && screen.orientation
      ? screen.orientation.angle
      : (typeof legacyOrientation === 'number' ? legacyOrientation : 0);
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
    permissionState = 'granted';
    window.addEventListener('deviceorientation', onOrientation);
  }

  function permissionRequests() {
    const requests: (() => Promise<'granted' | 'denied'>)[] = [];

    // Safari's public examples feature-detect DeviceMotion first; some iOS
    // builds gate orientation events behind the motion permission prompt.
    if (typeof DeviceMotionEvent !== 'undefined') {
      const motionCtor = DeviceMotionEvent as PermissionDeviceMotion;
      if (typeof motionCtor.requestPermission === 'function') {
        requests.push(() => motionCtor.requestPermission?.() ?? Promise.resolve('denied'));
      }
    }

    if (typeof DeviceOrientationEvent !== 'undefined') {
      const orientationCtor = DeviceOrientationEvent as PermissionDeviceOrientation;
      if (typeof orientationCtor.requestPermission === 'function') {
        requests.push(() => orientationCtor.requestPermission?.() ?? Promise.resolve('denied'));
      }
    }

    return requests;
  }

  function enable() {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      permissionState = 'insecure';
      return;
    }
    if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
      permissionState = 'unsupported';
      return;
    }
    if (permissionRequests().length === 0) listen();
  }

  function unlock() {
    if (listening) return Promise.resolve(true);
    if (pendingUnlock) return pendingUnlock;
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      permissionState = 'insecure';
      return Promise.resolve(false);
    }
    if (typeof DeviceOrientationEvent === 'undefined') {
      permissionState = 'unsupported';
      return Promise.resolve(false);
    }

    const requests = permissionRequests();
    if (requests.length === 0) {
      listen();
      return Promise.resolve(true);
    }

    permissionState = 'prompt';
    pendingUnlock = Promise.all(requests.map((request) => request()))
      .then((results) => {
        if (!results.every((result) => result === 'granted')) {
          permissionState = 'denied';
          return false;
        }
        listen();
        return true;
      })
      .catch(() => {
        permissionState = 'denied';
        return false;
      })
      .finally(() => {
        pendingUnlock = null;
      });

    return pendingUnlock;
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
    get permissionState() {
      return permissionState;
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
