// Migration Script: Move subscription plans from code to Firestore
// Run this ONCE to migrate existing plans

import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

const existingPlans = [
    {
        name: 'Free Plan',
        nameEn: 'Free Plan',
        description: 'Perfect for personal use and trying out',
        descriptionEn: 'Perfect for personal use and trying out',
        type: 'user',
        price: 0,
        originalPrice: 0,
        discount: 0,
        duration: { type: 'month', value: 1 },
        design: {
            icon: '🎁',
            color: '#6366f1',
            gradient: { from: '#6366f1', to: '#8b5cf6' },
            badge: { show: false, text: 'Start Free', color: '#10b981' },
            recommended: false
        },
        features: [
            { text: 'Create up to 5 invitations per month', textEn: 'Create up to 5 invitations per month', icon: '✓', highlight: false },
            { text: 'Join unlimited invitations', textEn: 'Join unlimited invitations', icon: '✓', highlight: false },
            { text: 'Browse restaurants', textEn: 'Browse restaurants', icon: '✓', highlight: false },
            { text: 'Email support', textEn: 'Email support', icon: '✓', highlight: false }
        ],
        limits: {
            invitations: 5,
            photos: 3,
            videos: 0,
            communities: 3,
            featured: false,
            analytics: false,
            support: 'basic'
        },
        offers: {
            invitationCredits: 5,
            invitationOffers: '',
            trialDays: 0,
            moneyBackDays: 0
        },
        stripe: {
            priceId: '',
            productId: ''
        },
        active: true,
        published: true,
        order: 1
    },
    {
        name: 'Pro Plan',
        nameEn: 'Pro Plan',
        description: 'For active users who love social dining',
        descriptionEn: 'For active users who love social dining',
        type: 'user',
        price: 39,
        originalPrice: 49,
        discount: 20,
        duration: { type: 'month', value: 1 },
        design: {
            icon: '👑',
            color: '#8b5cf6',
            gradient: { from: '#8b5cf6', to: '#ec4899' },
            badge: { show: true, text: 'Most Popular', color: '#f5576c' },
            recommended: true
        },
        features: [
            { text: 'Unlimited invitations', textEn: 'Unlimited invitations', icon: '✓', highlight: true },
            { text: 'VIP badge', textEn: 'VIP badge', icon: '✓', highlight: true },
            { text: 'Priority visibility', textEn: 'Priority visibility', icon: '✓', highlight: false },
            { text: '24/7 instant support', textEn: '24/7 instant support', icon: '✓', highlight: false },
            { text: 'Detailed analytics', textEn: 'Detailed analytics', icon: '✓', highlight: false },
            { text: 'Schedule invitations', textEn: 'Schedule invitations', icon: '✓', highlight: false }
        ],
        limits: {
            invitations: -1,
            photos: -1,
            videos: 10,
            communities: -1,
            featured: true,
            analytics: true,
            support: 'priority'
        },
        offers: {
            invitationCredits: -1,
            invitationOffers: 'Book 4 get 1 free',
            trialDays: 7,
            moneyBackDays: 14
        },
        stripe: {
            priceId: 'price_1Sv9aWKpQn3RDJUCeGbeD8hc',
            productId: ''
        },
        active: true,
        published: true,
        order: 2
    },
    {
        name: 'Premium Plan',
        nameEn: 'Premium Plan',
        description: 'For premium users seeking unmatched experience',
        descriptionEn: 'For premium users seeking unmatched experience',
        type: 'user',
        price: 79,
        originalPrice: 99,
        discount: 20,
        duration: { type: 'month', value: 1 },
        design: {
            icon: '💎',
            color: '#f59e0b',
            gradient: { from: '#f59e0b', to: '#ef4444' },
            badge: { show: true, text: 'Premium', color: '#f59e0b' },
            recommended: false
        },
        features: [
            { text: 'Unlimited invitations', textEn: 'Unlimited invitations', icon: '✓', highlight: true },
            { text: 'Premium gold badge', textEn: 'Premium gold badge', icon: '✓', highlight: true },
            { text: 'Featured on homepage', textEn: 'Featured on homepage', icon: '✓', highlight: true },
            { text: 'Personal account manager', textEn: 'Personal account manager', icon: '✓', highlight: false },
            { text: 'Exclusive restaurant discounts', textEn: 'Exclusive restaurant discounts', icon: '✓', highlight: false },
            { text: 'Early access to new features', textEn: 'Early access to new features', icon: '✓', highlight: false },
            { text: 'Custom branding', textEn: 'Custom branding', icon: '✓', highlight: false }
        ],
        limits: {
            invitations: -1,
            photos: -1,
            videos: -1,
            communities: -1,
            featured: true,
            analytics: true,
            support: 'dedicated'
        },
        offers: {
            invitationCredits: -1,
            invitationOffers: 'Book 3 get 2 free',
            trialDays: 14,
            moneyBackDays: 30
        },
        stripe: {
            priceId: 'price_1Sv9bBKpQn3RDJUCBNht0Lq5',
            productId: ''
        },
        active: true,
        published: true,
        order: 3
    }
];

export const migratePlansToFirestore = async () => {
    try {
        console.log('🚀 Starting migration...');

        // Check if plans already exist
        const existingSnapshot = await getDocs(collection(db, 'subscriptionPlans'));

        if (existingSnapshot.size > 0) {
            console.log(`⚠️  Found ${existingSnapshot.size} existing plans in Firestore`);
            const confirm = window.confirm(
                `There are already ${existingSnapshot.size} plans in Firestore.\n\n` +
                'Do you want to add these plans anyway?\n\n' +
                '(This will create duplicates. Click Cancel to stop.)'
            );

            if (!confirm) {
                console.log('❌ Migration cancelled by user');
                return { success: false, message: 'Migration cancelled' };
            }
        }

        console.log(`📦 Migrating ${existingPlans.length} plans...`);

        const results = [];
        for (const plan of existingPlans) {
            const planData = {
                ...plan,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: 'migration-script'
            };

            const docRef = await addDoc(collection(db, 'subscriptionPlans'), planData);
            results.push({ id: docRef.id, name: plan.name });
            console.log(`✅ Migrated: ${plan.name} (${docRef.id})`);
        }

        console.log('🎉 Migration completed successfully!');
        console.log('Migrated plans:', results);

        return {
            success: true,
            message: `Successfully migrated ${results.length} plans`,
            plans: results
        };

    } catch (error) {
        console.error('❌ Migration failed:', error);
        return {
            success: false,
            message: error.message,
            error
        };
    }
};

// Export plans for reference
export { existingPlans };
