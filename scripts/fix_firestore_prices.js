const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Assumes existence or requires substitution

// Initialize Firebase Admin with manual credentials or environment variables
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

const targetPlans = [
    { id: 'p2', type: 'user', targetAud: 8.00 },
    { id: 'p3', type: 'user', targetAud: 15.00 },
    { id: 'p4', type: 'partner', targetAud: 19.00 },
    { id: 'p5', type: 'partner', targetAud: 29.00 }
];

async function syncPrices() {
    console.log('🚀 Starting price sync...');
    const conversionRate = 1.53;

    for (const target of targetPlans) {
        const usdPrice = parseFloat((target.targetAud / conversionRate).toFixed(2));
        console.log(`Updating ${target.id} (${target.type}) to ${target.targetAud} AUD (~${usdPrice} USD)`);

        try {
            const planRef = db.collection('subscriptionPlans').doc(target.id);
            await planRef.set({
                price: usdPrice,
                currency: 'USD',
                type: target.type,
                active: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`✅ ${target.id} updated.`);
        } catch (error) {
            console.error(`❌ Failed to update ${target.id}:`, error.message);
        }
    }

    process.exit(0);
}

syncPrices();
