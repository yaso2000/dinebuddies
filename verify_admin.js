const admin = require('firebase-admin');

// Initialize the app with a service account, granting admin privileges
// Replace the path with the exact path to your service account key file
const serviceAccount = require('c:/dinebudies/dinebuddies-firebase-adminsdk-fbsvc-cc00984415.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkRecentInvitations() {
  try {
    console.log("Fetching most recent invitations from Firestore...");
    
    // We will query sort by createdAt descending, but catch error if index missing
    try {
        const snapshot = await db.collection('invitations')
                              .orderBy('createdAt', 'desc')
                              .limit(5)
                              .get();
                              
        const invs = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            invs.push({
                id: doc.id,
                title: data.title,
                hostId: data.hostId,
                restaurantId: data.restaurantId,
                partnerId: data.partnerId,
                location: data.location,
                date: data.date,
                time: data.time,
                status: data.status,
                createdAt: data.createdAt ? data.createdAt.toDate() : 'No Date'
            });
        });

        console.log(JSON.stringify(invs, null, 2));
    } catch (e) {
        console.error("Failed to query with orderBy, trying without:", e.message);
        const snapshot = await db.collection('invitations').limit(20).get();
        const invs = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            invs.push({
                id: doc.id,
                title: data.title,
                restaurantId: data.restaurantId,
                status: data.status,
                createdAt: data.createdAt ? data.createdAt.toDate() : 'No Date'
            });
        });
        
        // sort manually in JS
        invs.sort((a,b) => b.createdAt - a.createdAt);
        console.log(JSON.stringify(invs.slice(0,5), null, 2));
    }
  } catch (error) {
    console.error("Complete failure:", error);
  }
  process.exit(0);
}

checkRecentInvitations();
