import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccountData = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

initializeApp({
    credential: cert(serviceAccountData)
});

const db = getFirestore();

async function deleteAllPostsAndStories() {
    console.log("Starting full deletion of all posts and stories...");

    let deletedPostsCount = 0;
    let deletedStoriesCount = 0;

    // 1. Delete ALL Posts
    console.log("Fetching communityPosts...");
    const postsSnapshot = await db.collection('communityPosts').get();

    console.log(`Found ${postsSnapshot.docs.length} posts. Deleting...`);
    for (const postDoc of postsSnapshot.docs) {
        await db.collection('communityPosts').doc(postDoc.id).delete();
        deletedPostsCount++;
    }

    // 2. Delete ALL Stories
    console.log("Fetching stories...");
    const storiesSnapshot = await db.collection('stories').get();

    console.log(`Found ${storiesSnapshot.docs.length} stories. Deleting...`);
    for (const storyDoc of storiesSnapshot.docs) {
        await db.collection('stories').doc(storyDoc.id).delete();
        deletedStoriesCount++;
    }

    console.log("Deletion Complete!");
    console.log(`Deleted a total of ${deletedPostsCount} posts.`);
    console.log(`Deleted a total of ${deletedStoriesCount} stories.`);
    process.exit(0);
}

deleteAllPostsAndStories().catch(console.error);
