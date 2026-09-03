/**
 * AI operating mode — who is on duty for a region.
 *
 * Default is Claude ("auto"). If Claude is technically down, the system fails
 * over automatically to "manual" (a human manager covers). On top of that,
 * the owner and managers can flip a manual switch:
 *   - owner: a global master switch + a per-region override (all regions)
 *   - regional manager: their OWN region only
 *
 * Effective mode for a region:
 *   health == 'down'            -> 'manual' (Claude unavailable, forced)
 *   region override set         -> that value
 *   else                        -> global
 *
 * Config lives at adminConfig/aiMode. Human-in-the-loop safety is unchanged:
 * "auto" governs whether Claude OPERATES (auto-triage now); outward replies stay
 * gated by their own review flow until the owner raises autonomy.
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { regionCountries } = require('./_adminRegion');

const CONFIG_PATH = ['adminConfig', 'aiMode'];
const REGION_KEYS = ['gulf', 'levant', 'egypt', 'maghreb'];
const DEFAULT_CONFIG = { global: 'auto', regions: {}, health: 'up' };

function docRef(db) {
    return db.collection(CONFIG_PATH[0]).doc(CONFIG_PATH[1]);
}

async function getConfig(db) {
    const s = await docRef(db).get();
    const d = s.exists ? s.data() || {} : {};
    return {
        global: d.global === 'manual' ? 'manual' : 'auto',
        regions: d.regions && typeof d.regions === 'object' ? d.regions : {},
        health: d.health === 'down' ? 'down' : 'up',
        healthError: d.healthError || null,
        healthCheckedAt: d.healthCheckedAt?.toMillis?.() || null,
        updatedBy: d.updatedBy || null,
        updatedAt: d.updatedAt?.toMillis?.() || null,
    };
}

/** Effective mode for one region given a config object. */
function effectiveMode(cfg, region) {
    if (!cfg || cfg.health === 'down') return 'manual';
    const r = region && cfg.regions ? cfg.regions[region] : null;
    if (r === 'auto' || r === 'manual') return r;
    return cfg.global === 'manual' ? 'manual' : 'auto';
}

/** Convenience: read config + compute effective mode for a region. */
async function effectiveModeFor(db, region) {
    const cfg = await getConfig(db);
    return effectiveMode(cfg, region);
}

/** Set health (called by the monitor + on live outage). Returns {changed, prev}. */
async function setHealth(db, status, error) {
    const next = status === 'down' ? 'down' : 'up';
    const prev = (await getConfig(db)).health;
    await docRef(db).set(
        {
            health: next,
            healthError: next === 'down' ? String(error || '').slice(0, 300) : null,
            healthCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
    );
    return { changed: prev !== next, prev };
}

function registerAiMode(exports, { db, admin, assertAdminContext, aiClaude, superOwnerUids }) {
    const now = () => admin.firestore.FieldValue.serverTimestamp();

    async function notifyOpsTeam(title, message) {
        // Owner(s) + all regional managers get an in-app push.
        const targets = new Set((superOwnerUids || []).filter(Boolean));
        try {
            const snap = await db.collection('users').where('role', '==', 'regional_manager').limit(50).get();
            snap.forEach((d) => targets.add(d.id));
        } catch (e) {
            functions.logger.warn('notifyOpsTeam manager lookup failed', e.message);
        }
        await Promise.all(
            [...targets].map((uid) =>
                db.collection('notifications').add({
                    userId: uid,
                    title,
                    message,
                    type: 'ai_mode_alert',
                    actionUrl: '/admin/reports',
                    createdAt: now(),
                }).catch(() => {}),
            ),
        );
    }

    /** Any panel staff: read config + the effective mode for their own region (or global for owner). */
    exports.getAiMode = functions.https.onCall(async (data, context) => {
        const { role, region, isSuperOwner } = await assertAdminContext(context);
        const cfg = await getConfig(db);
        return {
            isOwner: !!isSuperOwner,
            role,
            region: region || null,
            regionKeys: REGION_KEYS,
            config: cfg,
            effective: {
                self: effectiveMode(cfg, region),
                byRegion: Object.fromEntries(REGION_KEYS.map((r) => [r, effectiveMode(cfg, r)])),
            },
        };
    });

    /** Set a mode. Owner: global or any region. Manager: own region only. */
    exports.setAiMode = functions.https.onCall(async (data, context) => {
        const { isSuperOwner, role, region: callerRegion } = await assertAdminContext(context);
        const scope = String(data?.scope || '');
        const mode = String(data?.mode || '');
        if (mode !== 'auto' && mode !== 'manual') {
            throw new functions.https.HttpsError('invalid-argument', 'mode must be auto or manual.');
        }

        if (scope === 'global') {
            if (!isSuperOwner) throw new functions.https.HttpsError('permission-denied', 'Only the owner can set the global mode.');
            await docRef(db).set({ global: mode, updatedBy: context.auth.uid, updatedAt: now() }, { merge: true });
            return { ok: true, scope, mode };
        }

        if (scope === 'region') {
            const region = String(data?.region || '').toLowerCase();
            if (!regionCountries(region)) throw new functions.https.HttpsError('invalid-argument', 'Unknown region.');
            // Owner may set any region; a regional manager only their own.
            if (!isSuperOwner) {
                if (role !== 'regional_manager' || region !== String(callerRegion || '').toLowerCase()) {
                    throw new functions.https.HttpsError('permission-denied', 'You can only change your own region.');
                }
            }
            await docRef(db).set(
                { regions: { [region]: mode }, updatedBy: context.auth.uid, updatedAt: now() },
                { merge: true },
            );
            return { ok: true, scope, region, mode };
        }

        throw new functions.https.HttpsError('invalid-argument', 'scope must be global or region.');
    });

    // Scheduled health monitor — pings Claude; flips health + alerts on transition.
    exports.aiHealthMonitor = functions.pubsub.schedule('every 15 minutes').onRun(async () => {
        let ok = false;
        let err = null;
        if (!aiClaude.hasApiKey()) {
            err = 'ANTHROPIC_API_KEY not set';
        } else {
            try {
                await aiClaude.ping();
                ok = true;
            } catch (e) {
                err = String(e?.message || e).slice(0, 200);
            }
        }
        const { changed, prev } = await setHealth(db, ok ? 'up' : 'down', err);
        if (changed) {
            if (!ok) {
                await notifyOpsTeam('⚠️ Claude متوقف — التغطية اليدوية مفعّلة', `تعذّر الاتصال بـ Claude (${err || 'خطأ'}). المدراء يغطّون مناطقهم يدويًا حتى يعود.`);
            } else if (prev === 'down') {
                await notifyOpsTeam('✅ عاد Claude للعمل', 'استؤنف التشغيل التلقائي بـ Claude.');
            }
        }
        return null;
    });
}

module.exports = { registerAiMode, getConfig, effectiveMode, effectiveModeFor, setHealth, REGION_KEYS };
