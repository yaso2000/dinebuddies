import { fakerEN_AU as faker } from '@faker-js/faker';
import { doc, collection, writeBatch, GeoPoint, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';

// --- Configuration ---
const DEMO_USER_COUNT = 15;
const DEMO_BUSINESS_COUNT = 5;
const DEMO_INVITATION_COUNT_PER_USER = 1;
const DEMO_INVITATION_COUNT_PER_BUSINESS = 1;

// Bundaberg, QLD, Australia Locations
const BASE_LAT = -24.8661;
const BASE_LNG = 152.3489;

const generateRandomLocation = () => {
    // Generate random location within ~10km of Bundaberg
    const lat = BASE_LAT + (Math.random() - 0.5) * 0.1;
    const lng = BASE_LNG + (Math.random() - 0.5) * 0.1;
    return { lat, lng };
};

// --- Real-looking Data Sets (Localized for QLD) ---

const REAL_AVATARS = [
    'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&h=200&fit=crop', // Male 1
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop', // Female 1
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop', // Male 2
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop', // Female 2
    'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=200&h=200&fit=crop', // Male 3
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop', // Female 3
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop', // Male 4
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop', // Female 4
    'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200&h=200&fit=crop', // Male 5
    'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=200&h=200&fit=crop', // Female 5
];

const REAL_RESTAURANTS = [
    {
        name: 'The River Cruz Cafe',
        type: 'Cafe',
        image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
        logo: 'https://cdn-icons-png.flaticon.com/512/924/924514.png',
        gallery: [
            'https://images.unsplash.com/photo-1525610553991-2bede1a236e2?w=600',
            'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600'
        ],
        menu: [
            { name: 'Eggs Benedict', price: '$22', desc: 'Poached eggs on sourdough with hollandaise' },
            { name: 'Bundaberg Rum Cake', price: '$12', desc: 'Classic dessert made with local rum' }
        ]
    },
    {
        name: 'Bundaberg Brewed Drinks Tasting Room',
        type: 'Beverage & Experience',
        image: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800',
        logo: 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png',
        gallery: [
            'https://images.unsplash.com/photo-1541626244-63385213bfe9?w=600'
        ],
        menu: [
            { name: 'Ginger Beer Flight', price: '$15', desc: 'Taste all our famous brewed drinks' }
        ]
    },
    {
        name: 'The Spotted Dog Tavern',
        type: 'Pub Food',
        image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800',
        logo: 'https://cdn-icons-png.flaticon.com/512/3014/3014520.png',
        gallery: [
            'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600'
        ],
        menu: [
            { name: 'Chicken Parmi', price: '$28', desc: 'Giant crumbed breast with ham and cheese' },
            { name: 'Rump Steak', price: '$34', desc: 'Local beef cooked to your liking' }
        ]
    }
];

// --- Data Generators ---

const generateDemoUser = (index) => {
    const sex = index < 8 ? 'male' : 'female';
    const firstName = faker.person.firstName(sex);
    const lastName = faker.person.lastName();
    const email = `u${index + 1}@d.c`;
    const password = '123';

    const avatar = REAL_AVATARS[index % REAL_AVATARS.length];

    return {
        uid: `demo_user_${faker.string.uuid()}`,
        display_name: `${firstName} ${lastName}`,
        email: email,
        password: password,
        photo_url: avatar,
        role: 'user',
        accountType: 'individual',
        isDemo: true,
        city: 'Bundaberg',
        country: 'Australia',
        countryCode: 'AU',
        location: 'Bundaberg, QLD, Australia',
        coordinates: generateRandomLocation(),
        bio: faker.person.bio(),
        created_at: serverTimestamp(),
        last_active_time: serverTimestamp(),
        reputation: faker.number.int({ min: 50, max: 500 }),
        following: [],
        followersCount: faker.number.int({ min: 0, max: 50 }),
        isGuest: false
    };
};

const generateDemoBusiness = (index) => {
    const bizData = REAL_RESTAURANTS[index % REAL_RESTAURANTS.length];
    const location = generateRandomLocation();

    const isPremium = Math.random() < 0.6; // High premium rate for demos
    const tier = isPremium ? 'premium' : 'free';

    return {
        uid: `demo_biz_${faker.string.uuid()}`,
        display_name: bizData.name,
        email: `b${index + 1}@d.c`,
        photo_url: bizData.logo,
        role: 'business',
        accountType: 'business',
        isDemo: true,
        password: '123',
        subscriptionTier: tier,
        isVerified: isPremium,
        reputation: isPremium ? faker.number.int({ min: 300, max: 1000 }) : faker.number.int({ min: 50, max: 200 }),

        businessInfo: {
            businessType: bizData.type,
            cuisine: bizData.type,
            phone: faker.phone.number(),
            city: 'Bundaberg',
            country: 'Australia',
            address: `${faker.location.street()}, Bundaberg, QLD`,
            lat: location.lat,
            lng: location.lng,
            description: `Welcome to ${bizData.name}, a favorite spot in Bundaberg for genuine ${bizData.type}.`,
            isPublished: true,
            createdAt: serverTimestamp(),
            coverImage: bizData.image,
            menu: bizData.menu,
            gallery: bizData.gallery,
            rating: isPremium ? (4.5 + Math.random() * 0.5).toFixed(1) : (3.5 + Math.random()).toFixed(1),
            website: isPremium ? `www.${bizData.name.replace(/\s+/g, '').toLowerCase()}.com.au` : '',
            features: isPremium ? ['Outdoor Seating', 'Live Music', 'WiFi', 'Parking'] : ['Outdoor Seating']
        },
        created_at: serverTimestamp(),
        last_active_time: serverTimestamp(),
        followersCount: isPremium ? faker.number.int({ min: 100, max: 500 }) : faker.number.int({ min: 5, max: 50 }),
        ownedCommunities: []
    };
};

const generateDemoInvitation = (creator) => {
    const isBusiness = creator.accountType === 'business';

    const location = isBusiness ?
        { lat: creator.businessInfo.lat, lng: creator.businessInfo.lng, address: creator.businessInfo.address } :
        { ...generateRandomLocation(), address: faker.location.streetAddress() + ', Bundaberg' };

    const date = faker.date.soon({ days: 10 });
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().slice(0, 5);

    let title, description;
    const titles = ['Dinner in Bundaberg', 'Beachfront Coffee', 'Pub Night at Spotted Dog', 'Fishing Trip & Picnic', 'Local Networking Meetup'];

    if (isBusiness) {
        title = `Special: ${creator.display_name} Event!`;
        description = `Join us for a great time at ${creator.display_name} in sunny Bundaberg.`;
    } else {
        title = faker.helpers.arrayElement(titles);
        description = `Looking for some friendly company to enjoy Bundaberg's best spots. Let's hang out!`;
    }

    return {
        title: title,
        description: description,
        date: dateStr,
        time: timeStr,
        location: isBusiness ? creator.display_name : 'Bundaberg CBD',
        address: location.address,
        lat: location.lat,
        lng: location.lng,
        city: 'Bundaberg',
        country: 'AU',
        author: {
            id: creator.uid,
            name: creator.display_name,
            avatar: creator.photo_url || '',
            isPartner: isBusiness
        },
        guestsNeeded: faker.number.int({ min: 2, max: 6 }),
        joined: [],
        requests: [],
        meetingStatus: 'planning',
        status: 'published',
        type: isBusiness ? 'Restaurant' : 'Social',
        paymentType: faker.helpers.arrayElement(['Split', 'Host Pays', 'Each Pays Own']),
        genderGroups: ['male', 'female', 'unspecified'],
        ageGroups: ['18-24', '25-34', '35-44', '45-54', '55+'],
        isDemo: true,
        createdAt: serverTimestamp(),
        image: isBusiness ? creator.businessInfo.coverImage : `https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=800`
    };
};

export const createDemoData = async () => {
    console.log("🚀 Starting Demo Data Generation (Bundaberg Edition)...");
    const batch = writeBatch(db);
    let opCount = 0;

    const users = [];
    const businesses = [];

    for (let i = 0; i < DEMO_USER_COUNT; i++) {
        const user = generateDemoUser(i);
        users.push(user);
        batch.set(doc(db, 'users', user.uid), user);
        opCount++;
    }

    for (let i = 0; i < DEMO_BUSINESS_COUNT; i++) {
        const biz = generateDemoBusiness(i);
        businesses.push(biz);
        batch.set(doc(db, 'users', biz.uid), biz);
        opCount++;
    }

    for (const user of users) {
        for (let j = 0; j < DEMO_INVITATION_COUNT_PER_USER; j++) {
            const invite = generateDemoInvitation(user);
            batch.set(doc(collection(db, 'invitations')), invite);
            opCount++;
        }
    }

    for (const biz of businesses) {
        for (let j = 0; j < DEMO_INVITATION_COUNT_PER_BUSINESS; j++) {
            const invite = generateDemoInvitation(biz);
            batch.set(doc(collection(db, 'invitations')), invite);
            opCount++;
        }
    }

    await batch.commit();
    console.log("✅ Demo Data Generation Complete (Bundaberg)!");
    return { users: users.length, businesses: businesses.length, invitations: opCount - users.length - businesses.length };
};

export const wipeAllData = async () => {
    console.log("🧹 Deleting ALL Demo Data...");
    let totalDeleted = 0;
    const usersSnapshot = await getDocs(query(collection(db, 'users'), where('isDemo', '==', true)));
    const invitesSnapshot = await getDocs(query(collection(db, 'invitations'), where('isDemo', '==', true)));

    const batch = writeBatch(db);
    usersSnapshot.forEach(d => { batch.delete(d.ref); totalDeleted++; });
    invitesSnapshot.forEach(d => { batch.delete(d.ref); totalDeleted++; });

    await batch.commit();
    return totalDeleted;
};

export const deleteAllDemoData = wipeAllData;
