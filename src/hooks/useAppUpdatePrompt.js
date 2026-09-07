import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getRuntime } from '../platform/runtime';

/**
 * Detects whether the installed NATIVE app is behind the latest published build
 * and should prompt the user to update. Web/PWA are always the latest deploy, so
 * this is a no-op there.
 *
 * Reads the public `app_settings/version` doc (admin-writable, world-readable):
 *   {
 *     enabled: true,
 *     androidLatestBuild: <versionCode>, androidForceBelow: <versionCode|null>,
 *     iosLatestBuild: <build>,           iosForceBelow: <build|null>,
 *     storeUrlAndroid, storeUrlIos,
 *     updateTitleEn/Ar, updateMessageEn/Ar
 *   }
 * The installed version comes from Capacitor App.getInfo() (`build` = Android
 * versionCode / iOS build number).
 */
const DEFAULT_ANDROID_STORE = 'https://play.google.com/store/apps/details?id=com.dinebuddies.app';

export function useAppUpdatePrompt() {
    const [state, setState] = useState({ show: false, forced: false });

    useEffect(() => {
        const rt = getRuntime();
        if (!rt.isNative) return undefined; // web/PWA is always up to date

        let unsub = null;
        let cancelled = false;
        let currentBuild = NaN;

        const evaluate = (cfg) => {
            if (cancelled || !cfg || cfg.enabled === false) return;
            let latest = NaN;
            let forceBelow = NaN;
            let storeUrl = DEFAULT_ANDROID_STORE;
            if (rt.platform === 'android') {
                latest = Number(cfg.androidLatestBuild);
                forceBelow = Number(cfg.androidForceBelow);
                storeUrl = cfg.storeUrlAndroid || DEFAULT_ANDROID_STORE;
            } else if (rt.platform === 'ios') {
                latest = Number(cfg.iosLatestBuild);
                forceBelow = Number(cfg.iosForceBelow);
                storeUrl = cfg.storeUrlIos || '';
            }
            if (!Number.isFinite(latest) || !Number.isFinite(currentBuild)) return;
            if (currentBuild >= latest) {
                setState({ show: false, forced: false });
                return;
            }
            setState({
                show: true,
                forced: Number.isFinite(forceBelow) && currentBuild < forceBelow,
                storeUrl,
                cfg,
            });
        };

        (async () => {
            try {
                const { App: CapApp } = await import('@capacitor/app');
                const info = await CapApp.getInfo();
                currentBuild = Number(info?.build);
            } catch {
                return; // can't read native version → don't prompt
            }
            if (cancelled || !Number.isFinite(currentBuild)) return;
            // Live-subscribe so a config bump (new release) can prompt open sessions too.
            unsub = onSnapshot(
                doc(db, 'app_settings', 'version'),
                (snap) => { if (snap.exists()) evaluate(snap.data() || {}); },
                () => { /* read failed → stay silent */ }
            );
        })();

        return () => {
            cancelled = true;
            if (unsub) unsub();
        };
    }, []);

    return state;
}
