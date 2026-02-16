/**
 * Social Media Meta Tags Utility
 * Updates Open Graph and Twitter Card meta tags dynamically for rich social sharing
 */

/**
 * Update meta tags for social media sharing
 * @param {Object} data - The data to use for meta tags
 * @param {string} data.title - Page title
 * @param {string} data.description - Page description
 * @param {string} data.image - Image URL (should be absolute URL)
 * @param {string} data.url - Page URL (should be absolute URL)
 * @param {string} data.type - OG type (default: 'website')
 */
export const updateSocialMetaTags = (data) => {
    const {
        title = 'DineBuddies - Premium Social Events',
        description = 'Connect with food lovers and discover amazing dining experiences',
        image = 'https://dinebuddies.com/og-default.jpg',
        url = window.location.href,
        type = 'website'
    } = data;

    // Update document title
    document.title = title;

    // Helper function to update or create meta tag
    const updateMetaTag = (selector, content, property = 'content') => {
        let element = document.querySelector(selector);
        if (!element) {
            element = document.createElement('meta');
            const attr = selector.includes('property=') ? 'property' : 'name';
            const value = selector.match(/["']([^"']+)["']/)[1];
            element.setAttribute(attr, value);
            document.head.appendChild(element);
        }
        element.setAttribute(property, content);
    };

    // Primary Meta Tags
    updateMetaTag('meta[name="title"]', title);
    updateMetaTag('meta[name="description"]', description);

    // Open Graph / Facebook
    updateMetaTag('meta[property="og:type"]', type);
    updateMetaTag('meta[property="og:url"]', url);
    updateMetaTag('meta[property="og:title"]', title);
    updateMetaTag('meta[property="og:description"]', description);
    updateMetaTag('meta[property="og:image"]', image);
    updateMetaTag('meta[property="og:image:alt"]', title);

    // Twitter
    updateMetaTag('meta[property="twitter:url"]', url);
    updateMetaTag('meta[property="twitter:title"]', title);
    updateMetaTag('meta[property="twitter:description"]', description);
    updateMetaTag('meta[property="twitter:image"]', image);

    console.log('✅ Social meta tags updated:', { title, description, image, url });
};

/**
 * Generate meta tags for an invitation
 * @param {Object} invitation - The invitation object
 * @returns {Object} Meta tags data
 */
export const generateInvitationMetaTags = (invitation) => {
    if (!invitation) return {};

    const { title, description, image, location, date, time, author } = invitation;

    // Format date nicely
    const formattedDate = date ? new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : 'Soon';

    // Create rich description
    const richDescription = description
        ? `${description}\n\n📍 ${location}\n📅 ${formattedDate}\n⏰ ${time || '20:30'}\n👤 Hosted by ${author?.name || 'DineBuddy'}`
        : `Join ${author?.name || 'a DineBuddy'} for a meal at ${location} on ${formattedDate} at ${time || '20:30'}`;

    return {
        title: `${title} - DineBuddies`,
        description: richDescription,
        image: image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200',
        url: window.location.href,
        type: 'article'
    };
};

/**
 * Generate meta tags for a partner/restaurant profile
 * @param {Object} partner - The partner object
 * @returns {Object} Meta tags data
 */
export const generatePartnerMetaTags = (partner) => {
    if (!partner) return {};

    const { businessInfo } = partner;
    const name = businessInfo?.businessName || partner.name || 'Restaurant';
    const description = businessInfo?.description || `Discover ${name} on DineBuddies`;
    const image = businessInfo?.logo || partner.avatar || 'https://dinebuddies.com/og-default.jpg';
    const location = businessInfo?.location || '';

    return {
        title: `${name} - DineBuddies`,
        description: `${description}${location ? `\n📍 ${location}` : ''}`,
        image,
        url: window.location.href,
        type: 'profile'
    };
};

/**
 * Reset meta tags to default
 */
export const resetSocialMetaTags = () => {
    updateSocialMetaTags({
        title: 'DineBuddies - Premium Social Events',
        description: 'Connect with food lovers and discover amazing dining experiences. Join exclusive invitations and make new friends over great meals.',
        image: 'https://dinebuddies.com/og-default.jpg',
        url: 'https://dinebuddies.com/',
        type: 'website'
    });
};
