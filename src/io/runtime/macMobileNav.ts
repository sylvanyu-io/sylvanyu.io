import { createMacPowerOffOverlay } from './macPowerOff';
import { isEmbeddedBrowserHost, requestHostClose } from './hostClose';
import { MAC_WINDOW_IDS, type WindowId } from './macCanvas/ui';

// The phone build maps the browser back button onto in-app navigation via the
// History API. Three kinds of entry are pushed onto the stack:
//   - app:   an app is open fullscreen (back returns to the home screen)
//   - home:  the home screen, guarding the very first back press
//   - power: the "slide to power off" sheet (back from home, when there is an
//            external entry to fall back to / we run inside an embedded host)
// This module owns that whole state machine plus the power-off overlay, so the
// canvas orchestrator only has to forward a handful of intents.
const MAC_APP_HISTORY_KEY = '__sylvanMacApp';
const MAC_HOME_GUARD_HISTORY_KEY = '__sylvanMacHomeGuard';
const MAC_POWER_HISTORY_KEY = '__sylvanMacPowerConfirm';

export type MacMobileNavHooks = {
  root: HTMLElement;
  /** Whether the layout is currently in its phone (fullscreen-app) variant. */
  isMobile: () => boolean;
  /** Topmost open window id, or null when the home screen is showing. */
  topOpenWindowId: () => WindowId | null;
  openWindow: (id: WindowId, updateHistory?: boolean) => void;
  minimizeWindow: (id: WindowId) => void;
};

export type MacMobileNav = {
  /** Push an app entry when a window opens (no-op off-mobile). */
  pushAppHistory: (id: WindowId) => void;
  /** Mobile "back": pop the app entry if this window owns the top entry. */
  requestWindowClose: (id: WindowId) => boolean;
  /** Seed the home/power guard entries (or reopen a deep-linked app) once. */
  ensureHomeHistory: () => void;
  handlePopState: (event: PopStateEvent) => void;
  /** Tear the mobile guards down when the layout switches back to desktop. */
  resetForDesktop: () => void;
  destroy: () => void;
};

export function createMacMobileNav(hooks: MacMobileNavHooks): MacMobileNav {
  const { root, isMobile, topOpenWindowId, openWindow, minimizeWindow } = hooks;
  const hasExternalBackEntry = window.history.length > 1;
  const usesPowerGuard = hasExternalBackEntry || isEmbeddedBrowserHost();
  let historyReady = false;
  let powerExiting = false;

  const powerOffOverlay = createMacPowerOffOverlay(root, {
    onCancel: cancelPowerConfirm,
    onComplete: completePowerOff,
  });

  function historyAppId(value: unknown): WindowId | null {
    if (!value || typeof value !== 'object') return null;
    const id = (value as Record<string, unknown>)[MAC_APP_HISTORY_KEY];
    return MAC_WINDOW_IDS.includes(id as WindowId) ? id as WindowId : null;
  }

  function historyHasKey(value: unknown, key: string) {
    return Boolean(value && typeof value === 'object' && (value as Record<string, unknown>)[key]);
  }

  // History state carries app/home/power flags on top of whatever the host put
  // there; strip ours so a re-push never stacks duplicates.
  function historyBaseState() {
    const stateValue = window.history.state;
    const baseState = stateValue && typeof stateValue === 'object'
      ? { ...(stateValue as Record<string, unknown>) }
      : {};
    delete baseState[MAC_APP_HISTORY_KEY];
    delete baseState[MAC_HOME_GUARD_HISTORY_KEY];
    delete baseState[MAC_POWER_HISTORY_KEY];
    return baseState;
  }

  function appHistoryUrl(id: WindowId) {
    const url = new URL(window.location.href);
    url.hash = `app=${encodeURIComponent(id)}`;
    return url;
  }

  function homeHistoryUrl() {
    const url = new URL(window.location.href);
    url.hash = 'home';
    return url;
  }

  function powerHistoryUrl() {
    const url = new URL(window.location.href);
    url.hash = 'power-off';
    return url;
  }

  function pushAppHistory(id: WindowId) {
    if (!isMobile() || historyAppId(window.history.state) === id) return;
    window.history.pushState({ ...historyBaseState(), [MAC_APP_HISTORY_KEY]: id }, '', appHistoryUrl(id));
  }

  function writeHomeGuard(mode: 'push' | 'replace') {
    if (!isMobile()) return;
    const nextState = { ...historyBaseState(), [MAC_HOME_GUARD_HISTORY_KEY]: true };
    if (mode === 'push') {
      window.history.pushState(nextState, '', homeHistoryUrl());
      return;
    }
    window.history.replaceState(nextState, '', homeHistoryUrl());
  }

  function writePowerGuard(mode: 'push' | 'replace') {
    if (!isMobile()) return;
    const nextState = { ...historyBaseState(), [MAC_POWER_HISTORY_KEY]: true };
    if (mode === 'push') {
      window.history.pushState(nextState, '', powerHistoryUrl());
      return;
    }
    window.history.replaceState(nextState, '', powerHistoryUrl());
  }

  function pushPowerConfirm() {
    if (!isMobile() || !usesPowerGuard || historyHasKey(window.history.state, MAC_POWER_HISTORY_KEY)) return;
    writePowerGuard('push');
  }

  function requestWindowClose(id: WindowId) {
    if (!isMobile() || historyAppId(window.history.state) !== id) return false;
    window.history.back();
    return true;
  }

  function ensureHomeHistory() {
    if (!isMobile() || historyReady) return;

    const appId = historyAppId(window.history.state);
    if (appId) {
      historyReady = true;
      openWindow(appId, false);
      return;
    }

    if (usesPowerGuard) {
      writePowerGuard('replace');
      writeHomeGuard('push');
    }
    historyReady = true;
  }

  function hidePowerConfirm() {
    root.dataset.macPowerConfirm = 'false';
    powerOffOverlay.hide();
  }

  function showPowerConfirm(updateHistory = true) {
    if (!isMobile() || !usesPowerGuard || topOpenWindowId() || powerExiting) return;
    if (updateHistory) pushPowerConfirm();
    root.dataset.macPowerConfirm = 'true';
    powerOffOverlay.show();
  }

  function cancelPowerConfirm() {
    hidePowerConfirm();
    if (!isMobile()) return;
    if (historyHasKey(window.history.state, MAC_POWER_HISTORY_KEY)) {
      window.history.forward();
      window.setTimeout(() => {
        if (historyHasKey(window.history.state, MAC_POWER_HISTORY_KEY)) writeHomeGuard('replace');
      }, 180);
      return;
    }
    writeHomeGuard('replace');
  }

  function resetPowerExit() {
    powerExiting = false;
    root.dataset.macPowerConfirm = 'false';
    powerOffOverlay.setExiting(false);
    powerOffOverlay.hide();
    if (isMobile() && historyHasKey(window.history.state, MAC_POWER_HISTORY_KEY)) {
      writeHomeGuard('replace');
    }
  }

  function completePowerOff() {
    if (!isMobile() || powerExiting) return;
    powerExiting = true;
    root.dataset.macPowerConfirm = 'exiting';
    powerOffOverlay.setExiting(true);
    if (hasExternalBackEntry) {
      window.setTimeout(() => {
        if (document.hidden) return;
        window.history.go(-1);
        window.setTimeout(() => {
          if (!document.hidden) resetPowerExit();
        }, 1200);
      }, 160);
      return;
    }

    const closeRequested = requestHostClose({ allowWindowClose: true }) === 'requested';
    window.setTimeout(() => {
      if (!document.hidden) resetPowerExit();
    }, closeRequested ? 1200 : 160);
  }

  function handlePopState(event: PopStateEvent) {
    if (!isMobile() || powerExiting) return;

    const appId = historyAppId(event.state);
    if (appId) {
      hidePowerConfirm();
      openWindow(appId, false);
      return;
    }

    if (historyHasKey(event.state, MAC_POWER_HISTORY_KEY)) {
      showPowerConfirm(false);
      return;
    }

    if (historyHasKey(event.state, MAC_HOME_GUARD_HISTORY_KEY)) {
      hidePowerConfirm();
      const activeId = topOpenWindowId();
      if (activeId) minimizeWindow(activeId);
      return;
    }

    if (powerOffOverlay.isVisible()) {
      hidePowerConfirm();
      writeHomeGuard('push');
      return;
    }

    const activeId = topOpenWindowId();
    if (activeId) {
      minimizeWindow(activeId);
      return;
    }

    showPowerConfirm();
  }

  function resetForDesktop() {
    historyReady = false;
    hidePowerConfirm();
  }

  return {
    pushAppHistory,
    requestWindowClose,
    ensureHomeHistory,
    handlePopState,
    resetForDesktop,
    destroy: () => powerOffOverlay.destroy(),
  };
}
