/**
 * Fatal boot error copy — used before React/i18n mount; reads stored language preference.
 * @returns {'ar' | 'en' | 'fr' | 'es' | 'it' | 'de' | 'pt' | 'tr'}
 */
export function getBootUiLanguage() {
    try {
        const stored = window.localStorage.getItem('i18nextLng') || '';
        const lc = stored.toLowerCase();
        if (lc.startsWith('ar')) return 'ar';
        if (lc.startsWith('fr')) return 'fr';
        if (lc.startsWith('es')) return 'es';
        if (lc.startsWith('it')) return 'it';
        if (lc.startsWith('de')) return 'de';
        if (lc.startsWith('pt')) return 'pt';
        if (lc.startsWith('tr')) return 'tr';
    } catch {
        /* ignore */
    }
    const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
    const navLc = nav.toLowerCase();
    if (navLc.startsWith('ar')) return 'ar';
    if (navLc.startsWith('fr')) return 'fr';
    if (navLc.startsWith('es')) return 'es';
    if (navLc.startsWith('it')) return 'it';
    if (navLc.startsWith('de')) return 'de';
    if (navLc.startsWith('pt')) return 'pt';
    if (navLc.startsWith('tr')) return 'tr';
    return 'en';
}

const COPY = {
    en: {
        cssBody:
            'Failed to load a stylesheet (CSS) while starting the app. This often happens due to a <strong>stale Vite or browser cache</strong>, or after code changes while an old session is still open.',
        cssFooter:
            'Try: stop the dev server (Ctrl+C), delete <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">node_modules/.vite</code>, run <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code>, then hard-refresh (Ctrl+Shift+R).',
        firebaseBody:
            'Likely invalid or missing <strong>Firebase</strong> keys in <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env</code> (copy from <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env.example</code> and fill values from Firebase Console).',
        firebaseFooter:
            'After saving <code>.env</code>: restart the server with <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code>',
        genericBody:
            'Could not load the UI. See the technical message below. If it mentions Firebase, check <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env</code> and restart the server.',
        genericFooter:
            'Restart <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code> after any environment or dependency changes.',
    },
    ar: {
        cssBody:
            'فشل تحميل ملف تنسيق (CSS) أثناء بدء التطبيق. غالباً يحدث ذلك بسبب <strong>ذاكرة تخزين قديمة</strong> لخادم Vite أو للمتصفح، أو بعد تغيير الكود بينما الجلسة القديمة ما زالت مفتوحة.',
        cssFooter:
            'جرّب: إيقاف الخادم (Ctrl+C)، حذف المجلد <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">node_modules/.vite</code>، ثم <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code>، وتحديثاً قوياً للصفحة (Ctrl+Shift+R).',
        firebaseBody:
            'غالباً مفاتيح <strong>Firebase</strong> غير صحيحة أو غير موجودة في ملف <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env</code> (انسخ من <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env.example</code> واملأ القيم من Firebase Console).',
        firebaseFooter:
            'بعد حفظ <code>.env</code>: أعد تشغيل الخادم <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code>',
        genericBody:
            'تعذّر تحميل الواجهة. راجع الرسالة التقنية أدناه. إن كانت تتعلق بـ Firebase، تحقق من ملف <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env</code> وأعد تشغيل الخادم.',
        genericFooter:
            'أعد تشغيل <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code> بعد أي تعديل على البيئة أو الاعتماديات.',
    },
    fr: {
        cssBody:
            'Échec du chargement d’une feuille de style (CSS) au démarrage de l’application. Cela arrive souvent à cause d’un <strong>cache Vite ou navigateur obsolète</strong>, ou après des changements de code avec une ancienne session encore ouverte.',
        cssFooter:
            'Essayez : arrêtez le serveur de dev (Ctrl+C), supprimez <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">node_modules/.vite</code>, lancez <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code>, puis actualisez fort (Ctrl+Shift+R).',
        firebaseBody:
            'Clés <strong>Firebase</strong> probablement invalides ou manquantes dans <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env</code> (copiez depuis <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env.example</code> et remplissez depuis Firebase Console).',
        firebaseFooter:
            'Après avoir enregistré <code>.env</code> : redémarrez le serveur avec <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code>',
        genericBody:
            'Impossible de charger l’interface. Voir le message technique ci-dessous. S’il mentionne Firebase, vérifiez <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env</code> et redémarrez le serveur.',
        genericFooter:
            'Redémarrez <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code> après toute modification d’environnement ou de dépendances.',
    },
    es: {
        cssBody:
            'No se pudo cargar una hoja de estilos (CSS) al iniciar la aplicación. Suele deberse a una <strong>caché obsoleta de Vite o del navegador</strong>, o a cambios de código con una sesión antigua aún abierta.',
        cssFooter:
            'Prueba: detén el servidor de desarrollo (Ctrl+C), elimina <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">node_modules/.vite</code>, ejecuta <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code> y recarga forzando (Ctrl+Shift+R).',
        firebaseBody:
            'Probablemente faltan o son inválidas las claves de <strong>Firebase</strong> en <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env</code> (copia desde <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env.example</code> y complétalas desde Firebase Console).',
        firebaseFooter:
            'Tras guardar <code>.env</code>: reinicia el servidor con <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code>',
        genericBody:
            'No se pudo cargar la interfaz. Consulta el mensaje técnico abajo. Si menciona Firebase, revisa <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env</code> y reinicia el servidor.',
        genericFooter:
            'Reinicia <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code> tras cualquier cambio de entorno o dependencias.',
    },
    it: {
        cssBody:
            'Impossibile caricare un foglio di stile (CSS) all\'avvio dell\'app. Spesso succede per una <strong>cache obsoleta di Vite o del browser</strong>, o dopo modifiche al codice con una sessione precedente ancora aperta.',
        cssFooter:
            'Prova: ferma il server di sviluppo (Ctrl+C), elimina <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">node_modules/.vite</code>, esegui <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code> e ricarica forzando (Ctrl+Shift+R).',
        firebaseBody:
            'Probabilmente mancano o non sono valide le chiavi <strong>Firebase</strong> in <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env</code> (copia da <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env.example</code> e compilale da Firebase Console).',
        firebaseFooter:
            'Dopo aver salvato <code>.env</code>: riavvia il server con <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code>',
        genericBody:
            'Impossibile caricare l\'interfaccia. Vedi il messaggio tecnico sotto. Se menziona Firebase, controlla <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env</code> e riavvia il server.',
        genericFooter:
            'Riavvia <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code> dopo qualsiasi modifica all\'ambiente o alle dipendenze.',
    },
    de: {
        cssBody:
            'Beim Start der App konnte kein Stylesheet (CSS) geladen werden. Das passiert oft durch einen <strong>veralteten Vite- oder Browser-Cache</strong> oder nach Codeänderungen bei noch geöffneter alter Sitzung.',
        cssFooter:
            'Versuche: Dev-Server stoppen (Strg+C), <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">node_modules/.vite</code> löschen, <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code> ausführen und hart neu laden (Strg+Umschalt+R).',
        firebaseBody:
            'Wahrscheinlich fehlen oder sind ungültig: <strong>Firebase</strong>-Schlüssel in <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env</code> (aus <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env.example</code> kopieren und in der Firebase Console ausfüllen).',
        firebaseFooter:
            'Nach dem Speichern von <code>.env</code>: Server mit <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code> neu starten',
        genericBody:
            'Die Oberfläche konnte nicht geladen werden. Siehe die technische Meldung unten. Bei Firebase: <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env</code> prüfen und Server neu starten.',
        genericFooter:
            'Starte <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code> nach Änderungen an Umgebung oder Abhängigkeiten neu.',
    },
    pt: {
        cssBody:
            'Não foi possível carregar uma folha de estilo (CSS) ao iniciar o app. Isso costuma ocorrer por <strong>cache desatualizado do Vite ou do navegador</strong>, ou após mudanças no código com uma sessão antiga ainda aberta.',
        cssFooter:
            'Tente: pare o servidor de desenvolvimento (Ctrl+C), exclua <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">node_modules/.vite</code>, execute <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code> e recarregue forçando (Ctrl+Shift+R).',
        firebaseBody:
            'Provavelmente faltam ou são inválidas as chaves do <strong>Firebase</strong> em <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env</code> (copie de <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env.example</code> e preencha no Firebase Console).',
        firebaseFooter:
            'Após salvar <code>.env</code>: reinicie o servidor com <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code>',
        genericBody:
            'Não foi possível carregar a interface. Veja a mensagem técnica abaixo. Se mencionar Firebase, verifique <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env</code> e reinicie o servidor.',
        genericFooter:
            'Reinicie <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code> após qualquer alteração de ambiente ou dependências.',
    },
    tr: {
        cssBody:
            'Uygulama başlatılırken bir stil sayfası (CSS) yüklenemedi. Bu genellikle <strong>eski Vite veya tarayıcı önbelleği</strong> ya da kod değişikliklerinden sonra açık kalan eski oturumdan kaynaklanır.',
        cssFooter:
            'Dene: geliştirme sunucusunu durdur (Ctrl+C), <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">node_modules/.vite</code> klasörünü sil, <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code> çalıştır, ardından sert yenile (Ctrl+Shift+R).',
        firebaseBody:
            '<code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env</code> dosyasında <strong>Firebase</strong> anahtarları eksik veya geçersiz olabilir (<code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env.example</code> dosyasından kopyala ve Firebase Console\'dan doldur).',
        firebaseFooter:
            '<code>.env</code> kaydettikten sonra sunucuyu <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code> ile yeniden başlat',
        genericBody:
            'Arayüz yüklenemedi. Aşağıdaki teknik mesaja bak. Firebase geçiyorsa <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">.env</code> dosyasını kontrol et ve sunucuyu yeniden başlat.',
        genericFooter:
            'Ortam veya bağımlılık değişikliklerinden sonra <code style="background:#1e293b;padding:2px 8px;border-radius:6px;">npm run dev</code> komutunu yeniden çalıştır.',
    },
};

/**
 * @param {string} msg
 * @param {'ar' | 'en'} [lang]
 */
export function bootFailureExplanation(msg, lang = getBootUiLanguage()) {
    const m = String(msg || '').toLowerCase();
    const c = COPY[lang] || COPY.en;

    if (m.includes('preload') && m.includes('css')) {
        return { bodyHtml: c.cssBody, footerHtml: c.cssFooter };
    }
    if (m.includes('firebase') || (m.includes('missing') && m.includes('credential'))) {
        return { bodyHtml: c.firebaseBody, footerHtml: c.firebaseFooter };
    }
    return { bodyHtml: c.genericBody, footerHtml: c.genericFooter };
}
