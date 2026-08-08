/**
 * Updates Open Graph and Twitter Card meta tags dynamically for rich social sharing
 */
import { getSafeAvatar } from './avatarUtils';
import { resolvePrivateInvitationShareOgImage } from './privateInvitationShare';

const DEFAULT_OG_FALLBACK = 'https://www.dinebuddies.com/icon-light-512.png';

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
 * Generate meta tags for a business profile
 * @param {Object} business - The business (user with role business) object
 * @returns {Object} Meta tags data
 */
export const generateBusinessMetaTags = (business) => {
    if (!business) return {};
    const { businessInfo } = business;
    const name = businessInfo?.businessName || business.name || 'Restaurant';
    const description = businessInfo?.description || `Discover ${name} on DineBuddies`;
    const location = businessInfo?.location || '';
    return {
        title: `${name} - DineBuddies`,
        description: `${description}${location ? `\n📍 ${location}` : ''}`,
        image: getSafeAvatar(business),
        url: window.location.href,
        type: 'profile'
    };
};

/** @deprecated Use generateBusinessMetaTags */
export const generatePartnerMetaTags = generateBusinessMetaTags;

/**
 * Open Graph data for a community / featured post page.
 */
export const generatePostMetaTags = (post) => {
    if (!post) return {};
    const content =
        typeof post.content === 'string'
            ? post.content
            : post.caption || post.description || '';
    const titleText =
        (typeof post.content === 'object' && post.content?.title) ||
        String(content).split('\n')[0]?.slice(0, 80) ||
        'DineBuddies Post';
    const description =
        (typeof post.content === 'object' && (post.content.description || post.content.subtitle)) ||
        String(content).slice(0, 200) ||
        'See this post on DineBuddies';
    const image =
        post.mediaUrl ||
        post.image ||
        post.thumbnailUrl ||
        (post.media && typeof post.media === 'object' ? post.media.imageUrl : null) ||
        'https://www.dinebuddies.com/icon-light-512.png';
    const absImage =
        image.startsWith('http') || image.startsWith('data:')
            ? image
            : typeof window !== 'undefined'
              ? `${window.location.origin}${image.startsWith('/') ? image : `/${image}`}`
              : image;
    const path = post._isFeatured ? `/post/featured/${post.id}` : `/post/${post.id}`;
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
    return {
        title: `${titleText} - DineBuddies`,
        description,
        image: absImage,
        url: shareUrl,
        type: 'article',
    };
};

/**
 * Open Graph data for a private invitation share link (/invite/p/:token).
 * @param {Record<string, unknown>} preview
 * @param {string} shareUrl
 */
export const generatePrivateInvitationMetaTags = (preview, shareUrl) => {
    if (!preview) return {};

    const titleText = String(preview.title || '').trim() || 'Private Invitation';
    const inviter = String(preview.inviterName || '').trim();
    const location = String(preview.location || preview.venueName || '').trim();
    const formattedDate = preview.date
        ? new Date(preview.date).toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })
        : '';
    const formattedTime = preview.time
        ? String(preview.time).includes('T')
            ? String(preview.time).split('T')[1].substring(0, 5)
            : String(preview.time)
        : '';
    const whenLine = [formattedDate, formattedTime].filter(Boolean).join(' · ');

    const descriptionParts = [];
    if (inviter) descriptionParts.push(`${inviter} invited you`);
    if (titleText) descriptionParts.push(titleText);
    if (whenLine) descriptionParts.push(whenLine);
    if (location) descriptionParts.push(location);
    if (preview.description) {
        descriptionParts.push(String(preview.description).trim().slice(0, 180));
    }
    descriptionParts.push('Open the link to view the invitation and respond on DineBuddies.');

    let image = resolvePrivateInvitationShareOgImage(preview);
    if (!image) {
        image = preview.customImage || preview.videoThumbnail || preview.image || DEFAULT_OG_FALLBACK;
        if (image && !String(image).startsWith('http')) {
            image =
                typeof window !== 'undefined'
                    ? `${window.location.origin}${String(image).startsWith('/') ? image : `/${image}`}`
                    : image;
        }
    }

    const absUrl =
        shareUrl ||
        (typeof window !== 'undefined' ? window.location.href : 'https://www.dinebuddies.com/invite/p');

    return {
        title: `${titleText} · DineBuddies`,
        description: descriptionParts.filter(Boolean).join('\n'),
        image,
        url: absUrl,
        type: 'website',
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
