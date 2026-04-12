import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A headless component that listens to language changes and dynamically
 * updates the standard document title, description, and OpenGraph tags
 * to match the user's localized 'seo' preferences. Let Googlebot index dynamically!
 */
export default function SeoUpdater() {
    const { t, i18n } = useTranslation();

    useEffect(() => {
        // We only attempt to translate if the translations actually exist.
        // During early load, keys may just return themselves if missing.
        const translatedTitle = t('seo.title', { defaultValue: 'DineBuddies | Premium Social Dining' });
        const translatedDesc = t('seo.description', { defaultValue: 'DineBuddies is an exclusive social dining network where food lovers meet, join private restaurant invitations, and connect over premium meals.' });

        if (translatedTitle && translatedTitle !== 'seo.title') {
            document.title = translatedTitle;
            
            // Update primarily important meta tags
            updateMetaTag('name', 'title', translatedTitle);
            updateMetaTag('property', 'og:title', translatedTitle);
            updateMetaTag('property', 'twitter:title', translatedTitle);
        }

        if (translatedDesc && translatedDesc !== 'seo.description') {
            updateMetaTag('name', 'description', translatedDesc);
            updateMetaTag('property', 'og:description', translatedDesc);
            updateMetaTag('property', 'twitter:description', translatedDesc);
        }

    }, [t, i18n.language]);

    // Helper function to safely mutate DOM meta tags
    const updateMetaTag = (attribute, name, content) => {
        let element = document.querySelector(`meta[${attribute}="${name}"]`);
        if (element) {
            element.setAttribute('content', content);
        } else {
            // It might not exist, create it cleanly
            element = document.createElement('meta');
            element.setAttribute(attribute, name);
            element.setAttribute('content', content);
            document.head.appendChild(element);
        }
    };

    return null; // Headless component, renders no UI
}
