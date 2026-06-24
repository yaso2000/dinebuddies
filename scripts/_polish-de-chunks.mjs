/**
 * Post-polish DE batches: fix MT glitches and shift UI copy toward informal du.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MANUAL = {
    no_account: 'Noch kein Konto? Registrieren',
    no_account_create: 'Noch kein Konto? Erstelle eins',
    new_user: 'Neuer Nutzer',
    next: 'Weiter',
    reset_data_warn: 'Bist du sicher? Alle deine lokalen Daten werden gelöscht.',
    review_before_publishing: 'Prüfe alle Details vor der Veröffentlichung',
    run_device_diagnostics: 'Gerätediagnose ausführen',
    save_hours: 'Öffnungszeiten speichern',
    save_pending: 'Wird gespeichert…',
    saving: 'Wird gespeichert…',
    save_delivery_links_failed: 'Fehler beim Speichern der Lieferlinks',
    restaurant_community: 'Community des Lokals',
    reviews_count: 'Bewertungen',
    search_dineBuddies_venue: 'Registrierte Lokale auf DineBuddies suchen…',
    secure_payment: '🔒 Vollständig sichere und verschlüsselte Zahlung',
    select_conversation_prompt: 'Wähle links ein Gespräch aus, um zu chatten',
    sign_in_up: 'Anmelden / Registrieren',
    smart_bio_disclaimer: 'Nutzt nur deine Formularfelder (keine Cloud-KI). Deaktiviere Einträge, die nicht in der Nachricht stehen sollen.',
    smart_bio_disclaimer_ai: 'Die Optionen unten steuern, welche Details an die KI gesendet werden. Der Button fordert 10 kurze Überschriften vom Server an (Gemini); kein Schlüssel wird in der App gespeichert.',
    smart_bio_suggestions_hint: 'Tippe eine Zeile an, um sie als Nachricht zu übernehmen (du kannst sie danach bearbeiten).',
    stripe_test_mode_banner: 'Stripe-Testmodus — Karte 4242 4242 4242 4242 verwenden. Keine echten Abbuchungen.',
    subscribe_now: '🚀 Jetzt abonnieren',
    subscription_success: 'Abonnement erfolgreich! 🎉',
    suggest_messages_internal: 'Der KI-Vorschlagsdienst ist fehlgeschlagen (oft ein Gemini-API-Schlüssel, Kontingent oder Modellproblem auf dem Server). Versuche es später erneut oder schreibe die Nachricht selbst.',
    time_change_confirm: '⚠️ Wichtiger Hinweis:\n\nDas wird:\n1. Die Zeit von {{oldDate}} {{oldTime}} auf {{newDate}} {{newTime}} ändern\n2. Eine Benachrichtigung an alle Teilnehmenden senden ({{count}} Personen)\n3. Deren Status von „Angenommen“ auf „Ausstehend“ setzen\n\nBist du sicher?',
    time_change_success: '✅ Zeit erfolgreich geändert!\n\nBenachrichtigungen an {{count}} Teilnehmende gesendet.',
    verify_email_hint: 'Öffne die E-Mail und tippe auf „Konto verifizieren“. Kehre dann hierher zurück und tippe auf „Ich habe verifiziert“.',
    verify_venue_location: '📍 Wir müssen prüfen, ob du am Lokal bist\n\nBitte erlaube den Standortzugriff in deinen Browser-Einstellungen',
    not_at_venue_yet: '😊 Du scheinst noch nicht am Lokal zu sein\n\nDu kannst die Einladung abschließen, sobald du im Restaurant angekommen bist',
    '🎯 Add-on Offer Slots': '🎯 Zusatz-Angebotsslots',
    '💕 Dating Invitation Packs': '💕 Dating-Einladungspakete',
};

function polishDu(text) {
    if (typeof text !== 'string') return text;
    let s = text;

    const replacements = [
        [/\bMelden Sie sich an\b/g, 'Registrieren'],
        [/\bErstellen Sie\b/g, 'Erstelle'],
        [/\bÜberprüfen Sie\b/g, 'Prüfe'],
        [/\bFühren Sie\b/g, 'Führe'],
        [/\bFinden Sie\b/g, 'Finde'],
        [/\bTippen Sie\b/g, 'Tippe'],
        [/\bÖffnen Sie\b/g, 'Öffne'],
        [/\bGehen Sie\b/g, 'Gehe'],
        [/\bNavigieren Sie\b/g, 'Gehe'],
        [/\bVerwenden Sie\b/g, 'Nutze'],
        [/\bSpeichern Sie\b/g, 'Speichere'],
        [/\bGeben Sie\b/g, 'Gib'],
        [/\bWählen Sie\b/g, 'Wähle'],
        [/\bLaden Sie\b/g, 'Lade'],
        [/\bBitte beachten Sie\b/g, 'Bitte beachte'],
        [/\bSchreiben Sie\b/g, 'Schreib'],
        [/\bVersuchen Sie\b/g, 'Versuche'],
        [/\bStellen Sie\b/g, 'Stelle'],
        [/\bFügen Sie\b/g, 'Füge'],
        [/\bTeilen Sie\b/g, 'Teile'],
        [/\bKopieren Sie\b/g, 'Kopiere'],
        [/\bBestätigen Sie\b/g, 'Bestätige'],
        [/\bErlauben Sie\b/g, 'Erlaube'],
        [/\bSie können\b/g, 'Du kannst'],
        [/\bSie haben\b/g, 'Du hast'],
        [/\bSie sind\b/g, 'Du bist'],
        [/\bSie müssen\b/g, 'Du musst'],
        [/\bSie sollten\b/g, 'Du solltest'],
        [/\bSie werden\b/g, 'Du wirst'],
        [/\bSie erhalten\b/g, 'Du erhältst'],
        [/\bSie bekommen\b/g, 'Du bekommst'],
        [/\bSie sehen\b/g, 'Du siehst'],
        [/\bSie nutzen\b/g, 'Du nutzt'],
        [/\bSie wählen\b/g, 'Du wählst'],
        [/\bSie senden\b/g, 'Du sendest'],
        [/\bSie erstellen\b/g, 'Du erstellst'],
        [/\bSie veröffentlichen\b/g, 'Du veröffentlichst'],
        [/\bSie teilen\b/g, 'Du teilst'],
        [/\bSie akzeptieren\b/g, 'Du akzeptierst'],
        [/\bSie verwalten\b/g, 'Du verwaltest'],
        [/\bSie löschen\b/g, 'Du löschst'],
        [/\bSie filtern\b/g, 'Du filterst'],
        [/\bSie aktualisieren\b/g, 'Du aktualisierst'],
        [/\bSie navigieren\b/g, 'Du navigierst'],
        [/\bSie betreten\b/g, 'Du betrittst'],
        [/\bSie treten\b/g, 'Du trittst'],
        [/\bSie treten der\b/g, 'Du trittst der'],
        [/\bWenn Sie\b/g, 'Wenn du'],
        [/\bSobald Sie\b/g, 'Sobald du'],
        [/\bDamit Sie\b/g, 'Damit du'],
        [/\bIhre lokalen\b/g, 'deine lokalen'],
        [/\bIhre Einladung\b/g, 'deine Einladung'],
        [/\bIhre Einladungen\b/g, 'deine Einladungen'],
        [/\bIhr Profil\b/g, 'dein Profil'],
        [/\bIhr Konto\b/g, 'dein Konto'],
        [/\bIhr Passwort\b/g, 'dein Passwort'],
        [/\bIhr Menü\b/g, 'dein Menü'],
        [/\bIhr Plan\b/g, 'dein Plan'],
        [/\bIhr Beitrag\b/g, 'dein Beitrag'],
        [/\bIhr Algorithmus\b/g, 'dein Algorithmus-Ranking'],
        [/\bIhre Menü\b/g, 'dein Menü'],
        [/\bIhre Öffnungszeiten\b/g, 'deine Öffnungszeiten'],
        [/\bIhre Bewertungen\b/g, 'deine Bewertungen'],
        [/\bIhre Storefront\b/g, 'deine Storefront'],
        [/\bIhre Nachricht\b/g, 'deine Nachricht'],
        [/\bIhre E-Mail\b/g, 'deine E-Mail'],
        [/\bIhre Daten\b/g, 'deine Daten'],
        [/\bIhre Einstellungen\b/g, 'deine Einstellungen'],
        [/\bIhre Fragen\b/g, 'deine Fragen'],
        [/\bIhre Zuverlässigkeit\b/g, 'deine Zuverlässigkeit'],
        [/\bIhren Standort\b/g, 'deinen Standort'],
        [/\bIhrem Gerät\b/g, 'deinem Gerät'],
        [/\bIhrem Browser\b/g, 'deinem Browser'],
        [/\bIhrem Dashboard\b/g, 'deinem Dashboard'],
        [/\bIhrem Profil\b/g, 'deinem Profil'],
        [/\bIhrem Konto\b/g, 'deinem Konto'],
        [/\bIhrem Restaurant\b/g, 'deinem Restaurant'],
        [/\bIhrem Chat\b/g, 'deinem Chat'],
        [/\bIhrer Community\b/g, 'deiner Community'],
        [/\bIhrer Bewertungen\b/g, 'deiner Bewertungen'],
        [/\bIhrer Einladung\b/g, 'deiner Einladung'],
        [/\bIhrer Registerkarte\b/g, 'deiner Registerkarte'],
        [/\bIhrer Öffnungszeiten\b/g, 'deiner Öffnungszeiten'],
        [/\bIhrer Verzeichniseintrag\b/g, 'deinen Verzeichniseintrag'],
        [/\bIhren Verzeichniseintrag\b/g, 'deinen Verzeichniseintrag'],
        [/\bIhnen\b/g, 'dir'],
        [/\bIhnen außerdem\b/g, 'dir außerdem'],
        [/\bIhnen gewährt\b/g, 'dir gewährt'],
        [/\bSparen\.\.\./g, 'Wird gespeichert…'],
        [/\bSparen Sie Stunden\b/g, 'Öffnungszeiten speichern'],
        [/\bkönnen Du wählst\b/g, 'kannst du wählen'],
        [/\bIn den Einstellungen können Du wählst\b/g, 'In den Einstellungen kannst du wählen'],
    ];

    for (const [re, rep] of replacements) s = s.replace(re, rep);
    return s;
}

function polishObject(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (MANUAL[k] !== undefined) {
            out[k] = MANUAL[k];
        } else if (typeof v === 'string') {
            out[k] = polishDu(v);
        } else {
            out[k] = v;
        }
    }
    return out;
}

function polishNested(val) {
    if (typeof val === 'string') return polishDu(val);
    if (Array.isArray(val)) return val.map((item) => polishNested(item));
    if (val && typeof val === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(val)) out[k] = polishNested(v);
        return out;
    }
    return val;
}

const faqManual = {
    subtitle: 'Finde Antworten auf deine Fragen und erfahre, wie du das Beste aus DineBuddies herausholst.',
    empty: 'Derzeit sind keine Fragen verfügbar.',
};

for (const name of ['locale-de-batch-5.json', 'locale-de-batch-6.json']) {
    const file = path.join(__dirname, name);
    const data = polishObject(JSON.parse(fs.readFileSync(file, 'utf8')));
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

const faqFile = path.join(__dirname, 'locale-de-faq-seo.json');
const faqSeo = JSON.parse(fs.readFileSync(faqFile, 'utf8'));
faqSeo.faq = polishNested(faqSeo.faq);
faqSeo.seo = polishNested(faqSeo.seo);
Object.assign(faqSeo.faq, faqManual);

const faqFixes = [
    ['Wie erstelle ich eine Einladung und teile die Rechnung auf?', 'Tippe auf die (+)-Schaltfläche, wähle ein Restaurant und lege Datum und Uhrzeit fest. In den Einstellungen kannst du wählen, ob die Rechnung „Geht auf den Gastgeber“, „Gleichmäßig geteilt“ oder „Jeder zahlt für sich“ ist.'],
    ['Wie akzeptiere ich Beitrittsanfragen für meine Einladung?', 'Wenn jemand eine Beitrittsanfrage stellt, erhältst du sofort eine Benachrichtigung. Öffne die Einladungsdetails, sieh dir das Profil an und tippe auf „Annehmen“ oder „Ablehnen“. Nach der Annahme wird automatisch ein privater Gruppenchat freigeschaltet.'],
    ['Was ist der Community-Chat?', 'Jedes Restaurant in der App hat seine eigene „Community“. Wenn du der Community eines Restaurants beitrittst, betrittst du einen öffentlichen Chatraum mit dem Team und anderen Gästen, um nach Gerichten zu fragen, Empfehlungen auszutauschen und exklusive Angebote zu entdecken.'],
    ['Wie kann ich mein Konto aufleveln und Reputationspunkte sammeln?', 'Reputationspunkte zeigen deine Zuverlässigkeit! Sie steigen, wenn du pünktlich zu Events kommst und 5-Sterne-Bewertungen von Gastgebern oder Gästen erhältst. Sie sinken bei No-Shows oder Beschwerden.'],
    ['Wie aktualisiere ich auf Premium (VIP)?', 'Gehe zu Profil > Einstellungen > Abonnements. Die VIP-Stufe gibt dir besondere Suchfilter, vollen Zugriff auf Dating-Einladungen, Einblicke in Profilbesucher und unbegrenzte private Einladungen.'],
    ['Wie lösche ich mein Konto dauerhaft?', 'Gehe zu Profil > Einstellungen > Konto > Konto löschen. Bitte beachte: Diese Aktion ist endgültig und Daten können nach 30 Tagen nicht wiederhergestellt werden.'],
    ['Wie filtere ich Restaurants und Cafés?', 'Nutze die Suchleiste und Filter, um nach Restaurants, Cafés, aktuell geöffneten Lokale zu sortieren oder nach bester Bewertung und Entfernung zu ordnen.'],
    ['Wie funktionieren direkte E-Einladungen?', 'Statt auf App-Nutzer zu warten, erstelle eine „Private“-Einladung, kopiere den Link zur eleganten E-Karte und teile ihn über WhatsApp! Jede Person, die auf den Link tippt, wird nahtlos zur RSVP mit dir geführt.'],
];

for (const item of faqSeo.faq.user_questions) {
    const fix = faqFixes.find(([q]) => item.q === q || item.a.includes('können Du'));
    if (fix && fix[0] === item.q) item.a = fix[1];
    else item.a = polishDu(item.a);
    item.q = polishDu(item.q);
}

for (const item of faqSeo.faq.business_questions) {
    item.q = polishDu(item.q);
    item.a = polishDu(item.a);
}

faqSeo.faq.business_questions[0].a = 'Ein professionelles Kontrollzentrum für DineBuddies-Restaurantpartner. Du hast volle Kontrolle über dein Menü, Öffnungszeiten, Direkt-Chats und Marketing-Posts auf der Plattform.';
faqSeo.faq.business_questions[1].a = 'Gehe im Pro-Dashboard zu „Featured Posts“, lade dein Werbebild hoch und schreibe eine Bildunterschrift. Dein Beitrag erscheint sofort im Haupt-Feed der App für alle Nutzer.';
faqSeo.faq.business_questions[2].a = 'Jeder Nutzer, der deiner „Community“ beitritt, erscheint in deinem Mitglieder-Tab. Du kannst große Rabatte direkt im „Community Chat“ posten, um außerhalb der Stoßzeiten sofort mehr Gäste anzuziehen.';
faqSeo.faq.business_questions[4].a = 'Die „Pro“-Stufe richtet deine Storefront und den Verzeichniseintrag ein. „Elite“ ist unser Power-Paket: besseres Algorithmus-Ranking und unbegrenzte, priorisierte Featured Slides für maximale Sichtbarkeit.';
faqSeo.faq.business_questions[5].a = 'Im Tab „Bewertungen“ findest du detaillierte Analysen deiner Ratings. Du kannst außerdem offiziell unter dem verifizierten Namen deines Restaurants auf Bewertungen antworten und so Kundenbindung aufbauen.';

fs.writeFileSync(faqFile, `${JSON.stringify(faqSeo, null, 2)}\n`, 'utf8');

console.log('Polished DE batches and faq-seo');
