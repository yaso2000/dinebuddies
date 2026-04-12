import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

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

async function checkRecentInvitations() {
    try {
        console.log("Fetching most recent 5 invitations from Firestore...");
        const invitationsRef = collection(db, 'invitations');
        
        // We'll just fetch all recently created invitations by pulling a few and sorting manually 
        // if createdAt isn't indexed, or just fetching a bunch if there's no orderBy
        const q = query(invitationsRef, limit(10)); 
        const snapshot = await getDocs(q);
        
        const invitations = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            invitations.push({
                id: doc.id,
                title: data.title,
                hostId: data.hostId,
                restaurantId: data.restaurantId,
                partnerId: data.partnerId,
                location: data.location,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : 'No Date'
            });
        });

        console.log(JSON.stringify(invitations, null, 2));
    } catch (error) {
        console.error("Error fetching documents: ", error);
        
        // Fallback without timestamp index requirement
        try {
            const q2 = query(collection(db, 'invitations'), limit(10));
            const snapshot2 = await getDocs(q2);
            const invs = [];
            snapshot2.forEach(doc => {
                 invs.push({ id: doc.id, title: doc.data().title, restaurantId: doc.data().restaurantId, hostId: doc.data().hostId });
            });
            console.log("Fallback results (unordered): ", invs);
        } catch (e) {
            console.error("Complete failure", e);
        }
    }
    process.exit(0);
}

checkRecentInvitations();
