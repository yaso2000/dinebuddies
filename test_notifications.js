const admin = require("firebase-admin");
const serviceAccount = require("C:\\dinebudies\\dinebuddies-firebase-adminsdk-fbsvc-cc00984415.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkDatabase() {
    try {
        console.log("Fetching latest 3 private invitations...");
        const invSnap = await db.collection("private_invitations")
            .orderBy("createdAt", "desc")
            .limit(3)
            .get();
        
        invSnap.forEach(doc => {
            const data = doc.data();
            console.log(`\n--- Invitation ID: ${doc.id} ---`);
            console.log(`Title: ${data.title}`);
            console.log(`Status: ${data.status}`);
            console.log(`Author ID: ${data.authorId || data.author?.id}`);
            console.log(`Invited Friends (${(data.invitedFriends || []).length}):`, data.invitedFriends);
        });

        console.log("\n==========================================\n");
        console.log("Fetching latest 5 notifications of type 'private_invitation'...");
        
        const notifSnap = await db.collection("notifications")
            .where("type", "==", "private_invitation")
            .orderBy("createdAt", "desc")
            .limit(5)
            .get();

        if (notifSnap.empty) {
            console.log("No 'private_invitation' notifications found!");
        } else {
            notifSnap.forEach(doc => {
                const data = doc.data();
                console.log(`\n--- Notification ID: ${doc.id} ---`);
                console.log(`Target UserId: ${data.userId}`);
                console.log(`From UserId/Name: ${data.fromUserId} / ${data.fromUserName}`);
                console.log(`Message: ${data.title} - ${data.message}`);
                console.log(`InvitationId: ${data.invitationId}`);
                console.log(`CreatedAt:`, data.createdAt ? data.createdAt.toDate() : 'N/A');
            });
        }
        
    } catch (error) {
        console.error("Error connecting to database:", error);
    }
}

checkDatabase();
