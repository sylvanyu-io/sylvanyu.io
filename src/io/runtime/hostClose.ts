type BridgeCloseStatus = 'requested' | 'unsupported';

type HostCloseOptions = {
  allowWindowClose?: boolean;
};

type WeixinJSBridgeApi = {
  call: (method: 'closeWindow') => void;
};

type AlipayJSBridgeApi = {
  call: (method: 'popWindow' | 'closeWebview') => void;
};

type DingTalkApi = {
  closePage?: () => void;
  ready?: (callback: () => void) => void;
  biz?: {
    navigation?: {
      quit?: (options?: { onSuccess?: () => void; onFail?: (error: unknown) => void }) => void;
    };
  };
};

type FeishuH5SdkApi = {
  ready?: (callback: () => void) => void;
};

type FeishuTtApi = {
  closeWindow?: () => void;
};

type LineLiffApi = {
  closeWindow?: () => void;
};

type TelegramApi = {
  WebApp?: {
    close?: () => void;
  };
};

type MessengerExtensionsApi = {
  requestCloseBrowser?: (success?: () => void, fail?: (error: unknown) => void) => void;
};

type MqqApi = {
  ui?: {
    closeWebViews?: (options?: Record<string, unknown>) => void;
  };
};

type HostWindow = Window & typeof globalThis & {
  WeixinJSBridge?: WeixinJSBridgeApi;
  AlipayJSBridge?: AlipayJSBridgeApi;
  dd?: DingTalkApi;
  h5sdk?: FeishuH5SdkApi;
  tt?: FeishuTtApi;
  liff?: LineLiffApi;
  Telegram?: TelegramApi;
  MessengerExtensions?: MessengerExtensionsApi;
  mqq?: MqqApi;
};

const embeddedBrowserPatterns = [
  /MicroMessenger/i,
  /AlipayClient/i,
  /DingTalk/i,
  /Lark|Feishu/i,
  /Line\//i,
  /Telegram/i,
  /FBAN|FBAV|FB_IAB|FB4A|Messenger/i,
  /Instagram/i,
  /LinkedInApp/i,
  /Twitter/i,
  /TikTok|Musical_ly|BytedanceWebview/i,
  /\bQQ\//i,
];

function callBridge(close: () => void) {
  try {
    close();
    return true;
  } catch {
    return false;
  }
}

function onceBridgeReady(eventName: string, close: () => void) {
  document.addEventListener(eventName, close, { once: true });
}

function isEmbeddedBrowser(ua: string) {
  return embeddedBrowserPatterns.some((pattern) => pattern.test(ua));
}

export function requestHostClose(options: HostCloseOptions = {}): BridgeCloseStatus {
  const host = window as HostWindow;
  const ua = window.navigator.userAgent;

  if (host.WeixinJSBridge && callBridge(() => host.WeixinJSBridge?.call('closeWindow'))) return 'requested';
  if (/MicroMessenger/i.test(ua)) {
    onceBridgeReady('WeixinJSBridgeReady', () => host.WeixinJSBridge?.call('closeWindow'));
    return 'requested';
  }

  if (host.AlipayJSBridge && callBridge(() => host.AlipayJSBridge?.call('popWindow'))) return 'requested';
  if (/AlipayClient/i.test(ua)) {
    onceBridgeReady('AlipayJSBridgeReady', () => host.AlipayJSBridge?.call('popWindow'));
    return 'requested';
  }

  if (host.dd?.closePage && callBridge(() => host.dd?.closePage?.())) return 'requested';
  if (host.dd?.biz?.navigation?.quit && callBridge(() => host.dd?.biz?.navigation?.quit?.())) return 'requested';
  if (/DingTalk/i.test(ua) && host.dd?.ready) {
    host.dd.ready(() => {
      if (host.dd?.closePage) {
        host.dd.closePage();
        return;
      }
      host.dd?.biz?.navigation?.quit?.();
    });
    return 'requested';
  }

  if (host.tt?.closeWindow && callBridge(() => host.tt?.closeWindow?.())) return 'requested';
  if (/Lark|Feishu/i.test(ua) && host.h5sdk?.ready) {
    host.h5sdk.ready(() => host.tt?.closeWindow?.());
    return 'requested';
  }

  if (host.liff?.closeWindow && callBridge(() => host.liff?.closeWindow?.())) return 'requested';
  if (host.Telegram?.WebApp?.close && callBridge(() => host.Telegram?.WebApp?.close?.())) return 'requested';
  if (
    host.MessengerExtensions?.requestCloseBrowser
    && callBridge(() => host.MessengerExtensions?.requestCloseBrowser?.())
  ) {
    return 'requested';
  }
  if (host.mqq?.ui?.closeWebViews && callBridge(() => host.mqq?.ui?.closeWebViews?.())) return 'requested';

  if (!isEmbeddedBrowser(ua) && !options.allowWindowClose) return 'unsupported';
  window.close();
  return 'requested';
}
