import { db } from './src/firebase/config.js';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

async function deletePrivateInvitations() {
    console.log('🧹 Searching for private invitations to delete...');
    const invitationsRef = collection(db, 'invitations');

    // Target invitations explicitly marked as private
    const q = query(invitationsRef, where('privacy', '==', 'private'));
    const snapshot = await getDocs(q);

    let count = 0;
    for (const d of snapshot.docs) {
        console.log(`🗑️ Deleting: ${d.id} - ${d.data().title}`);
        await deleteDoc(doc(db, 'invitations', d.id));
        count++;
    }

    // Also check for legacy ones that might not have the 'privacy' field set to 'private' 
    // but have 'invitedFriends' (the old way they were identified)
    const allSnapshot = await getDocs(invitationsRef);
    for (const d of allSnapshot.docs) {
        const data = d.data();
        if (!data.privacy && data.invitedFriends && data.invitedFriends.length > 0) {
            console.log(`🗑️ Deleting legacy private (no privacy field): ${d.id} - ${data.title}`);
            await deleteDoc(doc(db, 'invitations', d.id));
            count++;
        }
    }

    console.log(`✅ Finished! Deleted ${count} invitations.`);
}

deletePrivateInvitations().catch(err => {
    console.error('❌ Error during cleanup:', err);
});
