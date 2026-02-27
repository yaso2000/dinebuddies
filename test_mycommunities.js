import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

console.log("Config keys found:", Object.keys(firebaseConfig).filter(k => !!firebaseConfig[k]));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkUser(uid) {
    try {
        console.log(`Checking user: ${uid}`);
        const userDocRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            console.log('User not found');
            return;
        }

        const data = userDoc.data();
        console.log('\nUser joinedCommunities array:');
        console.log(data.joinedCommunities);

        if (data.joinedCommunities && data.joinedCommunities.length > 0) {
            console.log('\nIterating over partners:');
            for (const partnerId of data.joinedCommunities) {
                const pDoc = await getDoc(doc(db, 'users', partnerId));
                if (pDoc.exists()) {
                    const pData = pDoc.data();
                    console.log(`\nPartner [${partnerId}]:`, {
                        accountType: pData.accountType,
                        role: pData.role,
                        name: pData.businessInfo?.businessName || pData.display_name || pData.name
                    });
                } else {
                    console.log(`\nPartner [${partnerId}] NOT FOUND in 'users' collection`);
                }
            }
        } else {
            console.log('\nNo joined communities found for this user.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Check the UID
const uid = process.argv[2] || 'LdJ41iNnd1hKibODtly4T4P09gV2';
checkUser(uid);
