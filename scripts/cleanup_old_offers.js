import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env
dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanOldOffers() {
    try {
        console.log("Fetching all active_offers...");
        const activeOffersRef = collection(db, 'active_offers');
        const activeSnapshot = await getDocs(activeOffersRef);

        let deletedCount = 0;

        for (const doc of activeSnapshot.docs) {
            const data = doc.data();

            // Missing partnerId indicates it was from the old schema
            if (!data.partnerId) {
                console.log(`Deleting old active offer: ${doc.id} (Title: ${data.title || 'Unknown'})`);
                await deleteDoc(doc.ref);
                deletedCount++;
            }
        }

        console.log("Fetching all offers (history)...");
        const offersRef = collection(db, 'offers');
        const offersSnapshot = await getDocs(offersRef);

        for (const doc of offersSnapshot.docs) {
            const data = doc.data();

            if (!data.partnerId) {
                console.log(`Deleting old offer: ${doc.id} (Title: ${data.title || 'Unknown'})`);
                await deleteDoc(doc.ref);
                deletedCount++;
            }
        }

        console.log(`\nCleanup complete. Total legacy offers deleted: ${deletedCount}`);
        process.exit(0);
    } catch (error) {
        console.error("Error during cleanup:", error);
        process.exit(1);
    }
}

cleanOldOffers();
