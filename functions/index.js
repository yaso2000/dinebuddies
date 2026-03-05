const admin = require('firebase-admin');
admin.initializeApp();

const stripeModule = require('./stripe');
const webhookModule = require('./webhook');
const functions = require('firebase-functions');

// ─── Stripe Functions ───────────────────────────────────
exports.createCheckoutSession = stripeModule.createCheckoutSession;
exports.createPortalSession = stripeModule.createPortalSession;

// ─── Webhook Handler ────────────────────────────────────
exports.stripeWebhook = webhookModule.stripeWebhook;

// ─── Scheduled: Reset weekly private invitation credits ─
// Runs every Monday at 00:00 UTC
exports.resetWeeklyPrivateCredits = functions.pubsub
    .schedule('0 0 * * 1') // Mon 00:00 UTC
    .timeZone('UTC')
    .onRun(async () => {
        const db = admin.firestore();
        console.log('⏰ Running weekly private credits reset...');

        try {
            // Find all users who have a weekly quota (i.e. paid plan)
            const snapshot = await db.collection('users')
                .where('weeklyPrivateQuota', '>', 0)
                .get();

            if (snapshot.empty) {
                console.log('No users to reset.');
                return null;
            }

            const batch = db.batch();
            let count = 0;

            snapshot.forEach(doc => {
                batch.update(doc.ref, {
                    usedPrivateCreditsThisWeek: 0,
                    weeklyResetAt: admin.firestore.FieldValue.serverTimestamp()
                });
                count++;
            });

            await batch.commit();
            console.log(`✅ Reset usedPrivateCreditsThisWeek for ${count} users.`);
        } catch (error) {
            console.error('❌ Error resetting weekly credits:', error);
        }

        return null;
    });
