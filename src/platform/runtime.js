import { Capacitor } from '@capacitor/core';

export function getRuntime() {
  if (typeof window === 'undefined') {
    return { channel: 'web', platform: 'web', isNative: false, isPwa: false };
  }

  const cap = window.Capacitor || Capacitor;
  const isNative = Boolean(cap?.isNativePlatform?.());
  const platform = String(cap?.getPlatform?.() || 'web').toLowerCase();
  const isPwa = !isNative && window.matchMedia?.('(display-mode: standalone)').matches === true;

  return {
    channel: isNative ? `capacitor-${platform}` : isPwa ? 'pwa' : 'web',
    platform,
    isNative,
    isPwa,
  };
}

export function isNativeAndroid() {
  const runtime = getRuntime();
  return runtime.isNative && runtime.platform === 'android';
}

export function isNativeIos() {
  const runtime = getRuntime();
  return runtime.isNative && runtime.platform === 'ios';
}
