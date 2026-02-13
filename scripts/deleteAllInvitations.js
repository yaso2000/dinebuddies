// Delete All Invitations Script
// WARNING: This will delete ALL invitations and related data from Firestore

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';

// Firebase config (same as your app)
const firebaseConfig = {
    apiKey: "AIzaSyBcR9vKZ8QxH9xH9xH9xH9xH9xH9xH9xH9",
    authDomain: "your-app.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-app.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function deleteAllInvitations() {
    console.log('🗑️ Starting deletion process...');

    try {
        // 1. Delete all invitations
        console.log('📋 Fetching all invitations...');
        const invitationsSnapshot = await getDocs(collection(db, 'invitations'));
        console.log(`Found ${invitationsSnapshot.size} invitations`);

        for (const invDoc of invitationsSnapshot.docs) {
            await deleteDoc(doc(db, 'invitations', invDoc.id));
            console.log(`✅ Deleted invitation: ${invDoc.id}`);
        }

        // 2. Delete all invitation-related notifications
        console.log('📧 Fetching all notifications...');
        const notificationsSnapshot = await getDocs(collection(db, 'notifications'));
        console.log(`Found ${notificationsSnapshot.size} notifications`);

        let deletedNotifications = 0;
        for (const notifDoc of notificationsSnapshot.docs) {
            const data = notifDoc.data();
            // Delete if it's invitation-related
            if (data.invitationId || data.type?.includes('invitation') || data.type?.includes('join')) {
                await deleteDoc(doc(db, 'notifications', notifDoc.id));
                deletedNotifications++;
                console.log(`✅ Deleted notification: ${notifDoc.id}`);
            }
        }

        console.log('');
        console.log('🎉 Deletion complete!');
        console.log(`📊 Summary:`);
        console.log(`   - Invitations deleted: ${invitationsSnapshot.size}`);
        console.log(`   - Notifications deleted: ${deletedNotifications}`);

    } catch (error) {
        console.error('❌ Error during deletion:', error);
    }
}

// Run the script
deleteAllInvitations();
