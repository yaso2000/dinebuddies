import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { renderMotionPost } from '../../features/motion-post/renderMotionPost';
import { validateMotionPost } from '../../features/motion-post/validateMotionPost';
import {
    ALLOWED_MOTION_ANIMATIONS,
    ALLOWED_MOTION_THEMES,
    EVENT_TEMPLATE_IDS,
    MOTION_TEMPLATE_REGISTRY,
    SPECIAL_OFFER_TEMPLATE_IDS,
} from '../../features/motion-post/templates/registry';
import { motionPostPreviewAspectFromDoc } from '../../features/motion-post/motionPostFeedUtils';
import {
    archiveMotionPost,
    createMotionPostDraft,
    listMotionPostsForBusiness,
    publishMotionPost,
    unpublishMotionPost,
    updateMotionPostDraft,
} from '../../features/motion-post/motionPostDraftService';
import { uploadImage } from '../../utils/imageUpload';
import { callSuggestMotionPostContent } from '../../utils/callSuggestMotionPostContent';
import '../../pages/MyCommunity.css';

const CREATION_TYPES = [
    { id: 'regular', label: 'Regular Post', desc: 'General marketing update' },
    { id: 'event', label: 'Event Post', desc: 'Date / timing-focused story' },
    { id: 'offer', label: 'Special Offer Post', desc: 'Discount or promo focused' },
];

const POST_SIZES = [
    { id: 'landscape', label: 'Landscape', ratio: '16:9' },
    { id: 'square', label: 'Square', ratio: '1:1' },
    { id: 'vertical', label: 'Mobile', ratio: '9:16' },
];

const POST_SIZE_TO_ASPECT = {
    landscape: '16:9',
    square: '1:1',
    vertical: '9:16',
};

/** Placeholder post layout templates (normal post mode). IDs stored as `selectedPostTemplateId`. */
const POST_TEMPLATE_CARDS = [
    { id: 'classic_split', title: 'Classic Split', desc: 'Balanced split between headline and copy.' },
    { id: 'editorial_luxury', title: 'Editorial Luxury', desc: 'Magazine-style typography and spacing.' },
    { id: 'wide_banner', title: 'Wide Banner', desc: 'Bold banner headline over edge-to-edge imagery.' },
    { id: 'free_hero_center', title: 'Free Hero Center', desc: 'Centered free text over full image and gradient.' },
    { id: 'free_editorial_left', title: 'Free Editorial Left', desc: 'Editorial left-aligned free text with side gradient.' },
];

/** Special-offer layouts (each is a separate preview component + Firestore `templateId`). */
const OFFER_TEMPLATE_CARDS = [
    { id: 'discount_hero', title: 'Discount Hero', desc: 'Huge offer line, backdrop photo, CTA bottom.' },
    { id: 'premium_offer', title: 'Spotlight Offer', desc: 'Dark overlay, inset editorial column, refined CTA.' },
    { id: 'split_promo', title: 'Split Promo', desc: 'Text slab beside image (or stacked on mobile ratio).' },
    { id: 'coupon_style', title: 'Coupon Style', desc: 'Voucher card, tear strip, CTA inside the coupon.' },
    { id: 'flash_sale', title: 'Flash Sale', desc: 'Bold sale energy, accent stripes, loud CTA.' },
];

const EVENT_TEMPLATE_CARDS = [
    { id: 'elegant_invitation', title: 'Elegant Invitation', desc: 'Centered premium invite; date, time, location; optional CTA.' },
    { id: 'party_night', title: 'Party Night', desc: 'Bold nightlife typography with neon-style accents.' },
    { id: 'birthday_celebration', title: 'Birthday Celebration', desc: 'Colorful festive layout with room for celebration imagery.' },
    { id: 'business_event', title: 'Business Event', desc: 'Clean corporate editorial layout for events and launches.' },
    { id: 'romantic_dinner', title: 'Romantic Dinner', desc: 'Warm romantic overlay with soft elegant type.' },
];

function clampMotionThemeId(id, fallback = 'midnight') {
    const s = String(id || '').trim().toLowerCase();
    if (ALLOWED_MOTION_THEMES.includes(s)) return s;
    const fb = String(fallback || '').trim().toLowerCase();
    return ALLOWED_MOTION_THEMES.includes(fb) ? fb : 'midnight';
}

function normalizeMotionThemeSuggestion(raw, fallbackThemeId = 'midnight') {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return clampMotionThemeId(fallbackThemeId);
    if (['clean_dark_overlay', 'soft_light_overlay', 'story_gradient', 'bottom_caption', 'center_bold', 'minimal_card'].includes(s)) {
        // Legacy AI tokens no longer map 1:1 to the new palette; keep user's current theme.
        return clampMotionThemeId(fallbackThemeId);
    }
    if (s.includes('sunset') || s.includes('glow') || s.includes('soft_light_overlay')) return 'sunset';
    if (s.includes('ocean') || s.includes('night') || s.includes('midnight') || s.includes('clean_dark_overlay')) return 'midnight';
    if (s.includes('noir') || s.includes('black') || s.includes('monochrome') || s.includes('mono_black')) return 'noir';
    if (s.includes('forest') || s.includes('mint') || s.includes('emerald') || s.includes('story_gradient')) return 'emerald';
    if (s.includes('royal') || s.includes('purple') || s.includes('violet') || s.includes('bottom_caption') || s.includes('center_bold')) return 'violet';
    if (s.includes('gold') || s.includes('luxe') || s.includes('mono') || s.includes('minimal_card')) return 'mono';
    if (s.includes('rose') || s.includes('blush')) return 'rose';
    return clampMotionThemeId(s, fallbackThemeId);
}

function clampMotionAnimation(id) {
    const s = String(id || '').trim().toLowerCase();
    return ALLOWED_MOTION_ANIMATIONS.includes(s) ? s : 'stagger';
}

function normalizeMotionFormatSuggestion(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (s === 'landscape' || s.includes('16:9') || s.includes('wide') || s.includes('horizontal')) return 'landscape';
    if (s === 'vertical' || s.includes('9:16') || s.includes('mobile') || s.includes('story') || s.includes('portrait')) return 'vertical';
    return 'square';
}

function normalizePostSize(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (s === 'landscape' || s.includes('16:9') || s.includes('wide') || s.includes('horizontal')) return 'landscape';
    if (s === 'vertical' || s.includes('9:16') || s.includes('mobile') || s.includes('portrait') || s.includes('story')) return 'vertical';
    return 'square';
}

const MOTION_THEME_PICKER = [
    { id: 'sunset', title: 'Sunset Glow', hint: 'Warm premium sunset palette' },
    { id: 'midnight', title: 'Ocean Night', hint: 'Deep cool marine contrast' },
    { id: 'noir', title: 'Noir Mono', hint: 'Black-to-white editorial monochrome' },
    { id: 'emerald', title: 'Forest Mint', hint: 'Fresh natural green blend' },
    { id: 'violet', title: 'Royal Purple', hint: 'Bold royal purple highlights' },
    { id: 'mono', title: 'Golden Luxe', hint: 'Luxury gold-forward look' },
    { id: 'rose', title: 'Rose Blush', hint: 'Soft rosy lifestyle tone' },
];

const MOTION_ANIMATION_PICKER = [
    { id: 'fade', title: 'Fade', sample: 'Opacity transition' },
    { id: 'slide', title: 'Slide', sample: 'Directional entrance' },
    { id: 'pop', title: 'Pop', sample: 'Quick scale reveal' },
    { id: 'stagger', title: 'Stagger', sample: 'Layered text timing' },
];

const MOTION_COLOR_THEME_PICKER = [
    {
        id: 'sunset-glow',
        title: 'Sunset Glow',
        preview: 'linear-gradient(160deg, #2b1320 0%, #8a2b4f 45%, #ff8a3d 100%)',
        themeId: 'sunset',
        colors: ['#ff7a45', '#8a2b4f', '#ffd166', '#f8e9dc'],
    },
    {
        id: 'ocean-night',
        title: 'Ocean Night',
        preview: 'linear-gradient(160deg, #071a2b 0%, #123d5b 52%, #2c6f9e 100%)',
        themeId: 'midnight',
        colors: ['#2c6f9e', '#123d5b', '#5bc0eb', '#d9edf7'],
    },
    {
        id: 'forest-mint',
        title: 'Forest Mint',
        preview: 'linear-gradient(160deg, #0f2f23 0%, #1f7a5b 52%, #7dd3a7 100%)',
        themeId: 'emerald',
        colors: ['#1f7a5b', '#14532d', '#7dd3a7', '#e8fff5'],
    },
    {
        id: 'royal-purple',
        title: 'Royal Purple',
        preview: 'linear-gradient(160deg, #1b1330 0%, #4b2c86 50%, #8b5cf6 100%)',
        themeId: 'violet',
        colors: ['#6d4ecf', '#35205d', '#c4b5fd', '#efe9ff'],
    },
    {
        id: 'golden-luxe',
        title: 'Golden Luxe',
        preview: 'linear-gradient(160deg, #2b2011 0%, #7c5a24 48%, #d4a84f 100%)',
        themeId: 'mono',
        colors: ['#d4a84f', '#7c5a24', '#f4d58d', '#fff8ea'],
    },
    {
        id: 'rose-blush',
        title: 'Rose Blush',
        preview: 'linear-gradient(160deg, #301320 0%, #8c3f6a 50%, #f48fb1 100%)',
        themeId: 'rose',
        colors: ['#f48fb1', '#8c3f6a', '#ffd1dc', '#fff0f4'],
    },
    {
        id: 'noir-mono',
        title: 'Noir Mono',
        preview: 'linear-gradient(160deg, #050505 0%, #2a2a2a 55%, #8b8b8b 100%)',
        themeId: 'noir',
        colors: ['#050505', '#2a2a2a', '#d4d4d8', '#f8fafc'],
    },
];

function motionCoverFileExtension(file) {
    const fromName = (file.name || '').match(/\.([a-zA-Z0-9]+)$/);
    if (fromName) {
        const e = fromName[1].toLowerCase();
        if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(e)) return e === 'jpeg' ? 'jpg' : e;
    }
    const t = file.type || '';
    if (t === 'image/png') return 'png';
    if (t === 'image/webp') return 'webp';
    if (t === 'image/gif') return 'gif';
    return 'jpg';
}

function motionDocStatus(row) {
    const s = row?.status;
    if (s === 'published') return 'published';
    if (s === 'archived') return 'archived';
    return 'draft';
}

function motionPostSearchHaystack(row) {
    const c = row?.content || {};
    const bits = [
        c.title,
        c.subtitle,
        c.description,
        c.badgeText,
        c.dateText,
        c.timeText,
        c.locationText,
        String(row?.status || ''),
    ].map((x) => String(x || '').toLowerCase());
    const updated = row?.updatedAt?.toDate ? row.updatedAt.toDate() : null;
    const created = row?.createdAt?.toDate ? row.createdAt.toDate() : null;
    if (updated) bits.push(updated.toLocaleDateString().toLowerCase(), String(updated.getTime()));
    if (created) bits.push(created.toLocaleDateString().toLowerCase(), String(created.getTime()));
    return bits.join(' ');
}

/**
 * Full AI + motion post builder (moved from My Community dashboard for a cleaner hub).
 */
const MotionPostStudio = ({ showComposer = true, showSavedPosts = true, savedPostsPagePath = '/ai-marketing-studio/saved-posts' }) => {
    const { t, i18n } = useTranslation();
    const { currentUser, userProfile } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isBusinessAccount = userProfile?.isBusiness || false;

    const [motionPreviewPost, setMotionPreviewPost] = useState({
        type: 'normal_post',
        format: 'square',
        templateId: 'normal_post_stub_v1',
        content: {
            title: 'Chef special tonight',
            subtitle: 'Fresh ingredients, limited seats',
            description: 'Book now and enjoy our signature experience.',
            cta: '',
            badgeText: '',
            dateText: '',
            timeText: '',
            locationText: '',
            imageUrl: '',
        },
        style: {
            themeId: 'sunset',
            animation: 'stagger',
            durationMs: 700,
        },
    });
    const [creationType, setCreationType] = useState('regular');
    const [postSize, setPostSize] = useState('square');
    const [previewReplaySeed, setPreviewReplaySeed] = useState(0);

    const activeTemplate =
        MOTION_TEMPLATE_REGISTRY[motionPreviewPost.templateId] ||
        (motionPreviewPost.type === 'special_offer_post'
            ? MOTION_TEMPLATE_REGISTRY.discount_hero
            : motionPreviewPost.type === 'event_post'
              ? MOTION_TEMPLATE_REGISTRY.elegant_invitation
              : MOTION_TEMPLATE_REGISTRY.normal_post_stub_v1);
    const maxLens = activeTemplate.maxLengths;
    const validation = validateMotionPost(motionPreviewPost);
    const [motionPosts, setMotionPosts] = useState([]);
    const [loadingMotionPosts, setLoadingMotionPosts] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [motionPostBusyId, setMotionPostBusyId] = useState(null);
    const [activeDraftId, setActiveDraftId] = useState(null);
    const [draftActionError, setDraftActionError] = useState('');
    const [draftActionMessage, setDraftActionMessage] = useState('');
    const [motionListTab, setMotionListTab] = useState('all');
    const [motionSearchQuery, setMotionSearchQuery] = useState('');
    const [motionSort, setMotionSort] = useState('recent');
    const [motionImageUploading, setMotionImageUploading] = useState(false);
    const [motionImageUploadProgress, setMotionImageUploadProgress] = useState(null);
    const [motionImageUploadError, setMotionImageUploadError] = useState('');
    const motionCoverFileInputRef = useRef(null);
    const motionPreDraftStorageKeyRef = useRef(null);
    const motionPreviewDesignReasonRef = useRef('init');
    const motionAutoDraftLoadDoneRef = useRef(false);
    const themeCarouselRef = useRef(null);
    const themeDragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0, moved: false });
    const postTemplateCarouselRef = useRef(null);
    const postTemplateDragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0, moved: false });
    const offerTemplateCarouselRef = useRef(null);
    const offerTemplateDragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0, moved: false });
    const eventTemplateCarouselRef = useRef(null);
    const eventTemplateDragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0, moved: false });
    const [motionAiPrompt, setMotionAiPrompt] = useState('');
    const [motionAiTone, setMotionAiTone] = useState('friendly');
    const [motionAiLanguage, setMotionAiLanguage] = useState('en');
    const [motionTextGenerating, setMotionTextGenerating] = useState(false);
    const [motionAiError, setMotionAiError] = useState('');
    const [motionTextGenerated, setMotionTextGenerated] = useState(false);
    /** Studio-only AI design hints (overlay, placement, focus) — not saved to Firestore. */
    const [motionPreviewDesign, setMotionPreviewDesign] = useState(null);
    const [selectedColorThemeId, setSelectedColorThemeId] = useState('sunset-glow');
    const [selectedPostTemplateId, setSelectedPostTemplateId] = useState('classic_split');
    const [selectedAspectRatio, setSelectedAspectRatio] = useState('1:1');
    const [isDesktopLayout, setIsDesktopLayout] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 980 : false));
    const previewAutoReplayBootedRef = useRef(false);

    useEffect(() => {
        const lang = i18n.language && String(i18n.language).toLowerCase().startsWith('ar') ? 'ar' : 'en';
        setMotionAiLanguage(lang);
    }, [i18n.language]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onResize = () => setIsDesktopLayout(window.innerWidth >= 980);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        console.log('[MotionAI][state] previewDesign changed', {
            value: motionPreviewDesign,
            reason: motionPreviewDesignReasonRef.current,
        });
    }, [motionPreviewDesign]);

    useEffect(() => {
        console.log('[MotionAI][state] postSize', postSize);
    }, [postSize]);

    useEffect(() => {
        const ar = POST_SIZE_TO_ASPECT[normalizePostSize(postSize)] || '1:1';
        setSelectedAspectRatio(ar);
    }, [postSize]);

    useEffect(() => {
        console.log('[MotionAI][renderer-input]', {
            previewAspect: postSize,
            previewDesign: motionPreviewDesign,
            style: motionPreviewPost?.style,
            templateId: motionPreviewPost?.templateId,
            postType: motionPreviewPost?.type,
            selectedPostTemplateId,
            selectedAspectRatio,
        });
    }, [
        postSize,
        motionPreviewDesign,
        motionPreviewPost?.style,
        motionPreviewPost?.templateId,
        motionPreviewPost?.type,
        selectedPostTemplateId,
        selectedAspectRatio,
    ]);

    // Keep motion preview animation independent from AI design generation.
    // Any meaningful visual/content change replays the card automatically.
    useEffect(() => {
        if (!previewAutoReplayBootedRef.current) {
            previewAutoReplayBootedRef.current = true;
            return;
        }
        const timer = setTimeout(() => {
            setPreviewReplaySeed((x) => x + 1);
        }, 80);
        return () => clearTimeout(timer);
    }, [
        motionPreviewPost.style.animation,
        motionPreviewPost.style.themeId,
        motionPreviewPost.content.title,
        motionPreviewPost.content.subtitle,
        motionPreviewPost.content.description,
        motionPreviewPost.content.imageUrl,
        motionPreviewPost.content.dateText,
        motionPreviewPost.content.timeText,
        motionPreviewPost.content.locationText,
        motionPreviewPost.content.cta,
        motionPreviewPost.templateId,
        postSize,
        selectedPostTemplateId,
    ]);

    const motionSearchTrimmed = motionSearchQuery.trim().toLowerCase();
    const motionAiBusy = motionTextGenerating;
    const motionStepLabelStyle = { fontSize: '0.92rem', color: 'var(--text-main)', fontWeight: 900, letterSpacing: 0.015, paddingInline: 6 };

    const scrollThemeIntoView = useCallback((colorThemeId) => {
        const host = themeCarouselRef.current;
        if (!host) return;
        const target = host.querySelector(`[data-theme-card="${colorThemeId}"]`);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, []);

    const handleThemeMouseDown = useCallback((e) => {
        const host = themeCarouselRef.current;
        if (!host) return;
        themeDragRef.current = {
            isDown: true,
            startX: e.pageX - host.offsetLeft,
            scrollLeft: host.scrollLeft,
            moved: false,
        };
    }, []);

    const handleThemeMouseLeave = useCallback(() => {
        themeDragRef.current.isDown = false;
    }, []);

    const handleThemeMouseUp = useCallback(() => {
        themeDragRef.current.isDown = false;
    }, []);

    const handleThemeMouseMove = useCallback((e) => {
        const host = themeCarouselRef.current;
        const drag = themeDragRef.current;
        if (!host || !drag.isDown) return;
        e.preventDefault();
        const x = e.pageX - host.offsetLeft;
        const walk = (x - drag.startX) * 1.15;
        host.scrollLeft = drag.scrollLeft - walk;
        if (Math.abs(walk) > 5) drag.moved = true;
    }, []);

    const scrollPostTemplateIntoView = useCallback((templateId) => {
        const host = postTemplateCarouselRef.current;
        if (!host) return;
        const target = host.querySelector(`[data-post-template-card="${templateId}"]`);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, []);

    const handlePostTemplateMouseDown = useCallback((e) => {
        const host = postTemplateCarouselRef.current;
        if (!host) return;
        postTemplateDragRef.current = {
            isDown: true,
            startX: e.pageX - host.offsetLeft,
            scrollLeft: host.scrollLeft,
            moved: false,
        };
    }, []);

    const handlePostTemplateMouseLeave = useCallback(() => {
        postTemplateDragRef.current.isDown = false;
    }, []);

    const handlePostTemplateMouseUp = useCallback(() => {
        postTemplateDragRef.current.isDown = false;
    }, []);

    const handlePostTemplateMouseMove = useCallback((e) => {
        const host = postTemplateCarouselRef.current;
        const drag = postTemplateDragRef.current;
        if (!host || !drag.isDown) return;
        e.preventDefault();
        const x = e.pageX - host.offsetLeft;
        const walk = (x - drag.startX) * 1.15;
        host.scrollLeft = drag.scrollLeft - walk;
        if (Math.abs(walk) > 5) drag.moved = true;
    }, []);

    useEffect(() => {
        scrollThemeIntoView(selectedColorThemeId);
    }, [selectedColorThemeId, scrollThemeIntoView]);

    const scrollOfferTemplateIntoView = useCallback((templateId) => {
        const host = offerTemplateCarouselRef.current;
        if (!host) return;
        const target = host.querySelector(`[data-offer-template-card="${templateId}"]`);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, []);

    const handleOfferTemplateMouseDown = useCallback((e) => {
        const host = offerTemplateCarouselRef.current;
        if (!host) return;
        offerTemplateDragRef.current = {
            isDown: true,
            startX: e.pageX - host.offsetLeft,
            scrollLeft: host.scrollLeft,
            moved: false,
        };
    }, []);

    const handleOfferTemplateMouseLeave = useCallback(() => {
        offerTemplateDragRef.current.isDown = false;
    }, []);

    const handleOfferTemplateMouseUp = useCallback(() => {
        offerTemplateDragRef.current.isDown = false;
    }, []);

    const handleOfferTemplateMouseMove = useCallback((e) => {
        const host = offerTemplateCarouselRef.current;
        const drag = offerTemplateDragRef.current;
        if (!host || !drag.isDown) return;
        e.preventDefault();
        const x = e.pageX - host.offsetLeft;
        const walk = (x - drag.startX) * 1.15;
        host.scrollLeft = drag.scrollLeft - walk;
        if (Math.abs(walk) > 5) drag.moved = true;
    }, []);

    const scrollEventTemplateIntoView = useCallback((templateId) => {
        const host = eventTemplateCarouselRef.current;
        if (!host) return;
        const target = host.querySelector(`[data-event-template-card="${templateId}"]`);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, []);

    const handleEventTemplateMouseDown = useCallback((e) => {
        const host = eventTemplateCarouselRef.current;
        if (!host) return;
        eventTemplateDragRef.current = {
            isDown: true,
            startX: e.pageX - host.offsetLeft,
            scrollLeft: host.scrollLeft,
            moved: false,
        };
    }, []);

    const handleEventTemplateMouseLeave = useCallback(() => {
        eventTemplateDragRef.current.isDown = false;
    }, []);

    const handleEventTemplateMouseUp = useCallback(() => {
        eventTemplateDragRef.current.isDown = false;
    }, []);

    const handleEventTemplateMouseMove = useCallback((e) => {
        const host = eventTemplateCarouselRef.current;
        const drag = eventTemplateDragRef.current;
        if (!host || !drag.isDown) return;
        e.preventDefault();
        const x = e.pageX - host.offsetLeft;
        const walk = (x - drag.startX) * 1.15;
        host.scrollLeft = drag.scrollLeft - walk;
        if (Math.abs(walk) > 5) drag.moved = true;
    }, []);

    useEffect(() => {
        if (motionPreviewPost.type !== 'normal_post') return;
        scrollPostTemplateIntoView(selectedPostTemplateId);
    }, [motionPreviewPost.type, selectedPostTemplateId, scrollPostTemplateIntoView]);

    useEffect(() => {
        if (motionPreviewPost.type !== 'special_offer_post') return;
        scrollOfferTemplateIntoView(motionPreviewPost.templateId);
    }, [motionPreviewPost.type, motionPreviewPost.templateId, scrollOfferTemplateIntoView]);

    useEffect(() => {
        if (motionPreviewPost.type !== 'event_post') return;
        scrollEventTemplateIntoView(motionPreviewPost.templateId);
    }, [motionPreviewPost.type, motionPreviewPost.templateId, scrollEventTemplateIntoView]);

    useEffect(() => {
        const matched = MOTION_COLOR_THEME_PICKER.find((x) => x.themeId === motionPreviewPost.style.themeId);
        if (matched) setSelectedColorThemeId(matched.id);
    }, [motionPreviewPost.style.themeId]);

    const motionDraftRowsOnly = useMemo(
        () => motionPosts.filter((r) => motionDocStatus(r) === 'draft'),
        [motionPosts]
    );
    const motionPublishedRows = useMemo(
        () => motionPosts.filter((r) => motionDocStatus(r) === 'published'),
        [motionPosts]
    );
    const motionArchivedRows = useMemo(
        () => motionPosts.filter((r) => motionDocStatus(r) === 'archived'),
        [motionPosts]
    );

    const motionTabFiltered = useMemo(() => {
        if (motionListTab === 'drafts') return motionDraftRowsOnly;
        if (motionListTab === 'published') return motionPublishedRows;
        if (motionListTab === 'archived') return motionArchivedRows;
        return motionPosts;
    }, [motionListTab, motionPosts, motionDraftRowsOnly, motionPublishedRows, motionArchivedRows]);

    const motionSearchFiltered = useMemo(() => {
        if (!motionSearchTrimmed) return motionTabFiltered;
        return motionTabFiltered.filter((row) => motionPostSearchHaystack(row).includes(motionSearchTrimmed));
    }, [motionTabFiltered, motionSearchTrimmed]);

    const motionSortedList = useMemo(() => {
        const list = [...motionSearchFiltered];
        const getMs = (row) =>
            row?.updatedAt?.toMillis?.() ||
            row?.createdAt?.toMillis?.() ||
            0;
        const titleKey = (row) => String(row?.content?.title || '').trim().toLowerCase();
        if (motionSort === 'oldest') {
            list.sort((a, b) => getMs(a) - getMs(b));
        } else if (motionSort === 'title-az') {
            list.sort((a, b) => titleKey(a).localeCompare(titleKey(b)));
        } else {
            list.sort((a, b) => getMs(b) - getMs(a));
        }
        return list;
    }, [motionSearchFiltered, motionSort]);

    const activeMotionRow = useMemo(
        () => motionPosts.find((r) => r.id === activeDraftId),
        [motionPosts, activeDraftId]
    );
    const isViewingArchivedMotion = activeMotionRow?.status === 'archived';

    const motionSavedListEmpty = useMemo(() => {
        if (loadingMotionPosts) return 'loading';
        const q = motionSearchTrimmed;
        if (motionPosts.length === 0 && !q) return 'no-posts';
        if (motionListTab === 'drafts' && motionDraftRowsOnly.length === 0 && !q) return 'no-drafts';
        if (motionListTab === 'published' && motionPublishedRows.length === 0 && !q) return 'no-published';
        if (motionListTab === 'archived' && motionArchivedRows.length === 0 && !q) return 'no-archived';
        if (motionSortedList.length === 0 && q) return 'no-search';
        return null;
    }, [
        loadingMotionPosts,
        motionSearchTrimmed,
        motionPosts.length,
        motionListTab,
        motionDraftRowsOnly.length,
        motionPublishedRows.length,
        motionArchivedRows.length,
        motionSortedList.length,
    ]);

    const motionFieldsLocked = isViewingArchivedMotion;

    const getMotionPreDraftStorageKey = () => {
        if (!motionPreDraftStorageKeyRef.current) {
            motionPreDraftStorageKeyRef.current =
                typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        }
        return motionPreDraftStorageKeyRef.current;
    };

    const resetMotionPreDraftStorageKey = () => {
        motionPreDraftStorageKeyRef.current = null;
    };

    const buildMotionSaveInput = useCallback((mode = 'draft') => {
        const safePost = validation.safePost;
        if (!safePost) return null;
        const normalizedSize = normalizePostSize(postSize);
        const aspectRatio = POST_SIZE_TO_ASPECT[normalizedSize] || '1:1';
        const aiDesignExists = !!motionPreviewDesign;
        const imageUrl = safePost.content?.imageUrl || '';
        const finalImageSource = aiDesignExists && imageUrl ? 'aiDesign' : 'previewFallback';

        return {
            ownerId: currentUser.uid,
            businessId: currentUser.uid,
            subscriptionTier: userProfile?.subscriptionTier || 'free',
            payload: safePost,
            ui: {
                postSize: normalizedSize,
                aspectRatio,
                postTemplateId: motionPreviewPost.type === 'normal_post' ? selectedPostTemplateId : '',
                aiDesign: motionPreviewDesign
                    ? {
                          textPlacement: motionPreviewDesign.textPlacement || '',
                          overlayStrength: motionPreviewDesign.overlayStrength ?? 0.32,
                          imageFocus: motionPreviewDesign.imageFocus || 'center',
                          styleMood: motionPreviewDesign.styleMood || '',
                          themeSuggestion: motionPreviewPost.style?.themeId || '',
                          animationSuggestion: motionPreviewPost.style?.animation || '',
                          formatSuggestion: normalizedSize,
                      }
                    : null,
                finalImage: imageUrl
                    ? {
                          source: finalImageSource,
                          imageUrl,
                      }
                    : null,
            },
            _debug: {
                mode,
                selectedPostSize: normalizedSize,
                aspectRatio,
                selectedPostTemplateId: motionPreviewPost.type === 'normal_post' ? selectedPostTemplateId : null,
                postType: motionPreviewPost.type,
                aiDesignExists,
                finalImageSource,
                imageUrl,
            },
        };
    }, [
        validation.safePost,
        postSize,
        motionPreviewDesign,
        motionPreviewPost.style,
        motionPreviewPost.type,
        selectedPostTemplateId,
        currentUser?.uid,
        userProfile?.subscriptionTier,
    ]);

    const applyMotionPreviewDesign = useCallback((nextDesign, reason) => {
        motionPreviewDesignReasonRef.current = reason || 'unknown';
        console.log('[MotionAI][state-set] setMotionPreviewDesign', { reason, nextDesign });
        setMotionPreviewDesign(nextDesign);
    }, []);

    const clearMotionPreviewDesign = useCallback((reason) => {
        motionPreviewDesignReasonRef.current = reason || 'unknown';
        console.log('[MotionAI][state-set] clearMotionPreviewDesign', { reason });
        setMotionPreviewDesign(null);
    }, []);

    const buildMotionCoverStoragePath = (file) => {
        const businessId = currentUser?.uid;
        if (!businessId) return null;
        const postKey = activeDraftId || getMotionPreDraftStorageKey();
        const ext = motionCoverFileExtension(file);
        return `business_motion_posts/${businessId}/${postKey}/cover.${ext}`;
    };

    const handleMotionCoverFileChange = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!currentUser?.uid) {
            setMotionImageUploadError('You must be signed in to upload.');
            return;
        }
        if (!file.type.startsWith('image/')) {
            setMotionImageUploadError('Please choose an image file (JPEG, PNG, WebP, or GIF).');
            return;
        }

        const path = buildMotionCoverStoragePath(file);
        if (!path) {
            setMotionImageUploadError('Could not build storage path.');
            return;
        }

        setMotionImageUploadError('');
        setMotionImageUploadProgress(0);
        setMotionImageUploading(true);
        try {
            const url = await uploadImage(file, path, (pct) => {
                setMotionImageUploadProgress(typeof pct === 'number' ? pct : 0);
            });
            setMotionPreviewPost((prev) => ({
                ...prev,
                content: {
                    ...prev.content,
                    imageUrl: url,
                },
            }));
            setMotionImageUploadProgress(100);
        } catch (err) {
            console.error('Motion cover upload failed:', err);
            setMotionImageUploadError(err?.message || 'Image upload failed. Check your connection and try again.');
            setMotionImageUploadProgress(null);
        } finally {
            setMotionImageUploading(false);
            setTimeout(() => setMotionImageUploadProgress(null), 800);
        }
    };

    const updateMotionContent = (key, value) => {
        setMotionPreviewPost((prev) => ({
            ...prev,
            content: {
                ...prev.content,
                [key]: value,
            },
        }));
    };

    const setMotionType = (type, { regularMode = false } = {}) => {
        if (type === 'normal_post') {
            setMotionPreviewPost((prev) => ({
                ...prev,
                type: 'normal_post',
                templateId: 'normal_post_stub_v1',
                content: {
                    ...prev.content,
                    cta: '',
                    badgeText: '',
                    dateText: '',
                    timeText: '',
                    locationText: '',
                },
            }));
            return;
        }
        if (type === 'special_offer_post') {
            setMotionPreviewPost((prev) => {
                const prevTid = String(prev.templateId || '').trim();
                const keepOfferLayout =
                    prev.type === 'special_offer_post' && SPECIAL_OFFER_TEMPLATE_IDS.includes(prevTid);
                return {
                    ...prev,
                    type,
                    templateId: keepOfferLayout ? prevTid : 'discount_hero',
                    content: {
                        ...prev.content,
                        badgeText: regularMode ? '' : (prev.content.badgeText || 'LIMITED OFFER'),
                        dateText: '',
                        timeText: '',
                        locationText: '',
                    },
                };
            });
            return;
        }
        setMotionPreviewPost((prev) => {
            const prevTid = String(prev.templateId || '').trim();
            const keepEventLayout = prev.type === 'event_post' && EVENT_TEMPLATE_IDS.includes(prevTid);
            return {
                ...prev,
                type: 'event_post',
                templateId: keepEventLayout ? prevTid : 'elegant_invitation',
                content: {
                    ...prev.content,
                    dateText: prev.content.dateText || 'SAT 8:00 PM',
                    badgeText: '',
                },
            };
        });
    };

    useEffect(() => {
        if (creationType === 'event') {
            setMotionType('event_post');
            return;
        }
        if (creationType === 'offer') {
            setMotionType('special_offer_post', { regularMode: false });
            return;
        }
        setMotionType('normal_post');
    }, [creationType]);

    const loadMotionPosts = async () => {
        if (!currentUser?.uid || !isBusinessAccount) return;
        setLoadingMotionPosts(true);
        try {
            const rows = await listMotionPostsForBusiness(currentUser.uid, currentUser.uid);
            setMotionPosts(rows);
        } catch (err) {
            console.error('Failed to load motion posts:', err);
            setDraftActionError(err?.message || 'Failed to load motion posts');
        } finally {
            setLoadingMotionPosts(false);
        }
    };

    useEffect(() => {
        loadMotionPosts();
    }, [currentUser?.uid, isBusinessAccount]);

    const toPreviewPayload = (docData) => {
        const rawType = docData?.type;
        const type =
            rawType === 'event_post' ? 'event_post' : rawType === 'normal_post' ? 'normal_post' : 'special_offer_post';
        const tidRaw = String(docData?.templateId || '').trim();
        const tid =
            tidRaw === 'sq_offer_v1' ? 'discount_hero' : tidRaw === 'sq_event_v1' ? 'elegant_invitation' : tidRaw;
        const templateId =
            type === 'event_post'
                ? EVENT_TEMPLATE_IDS.includes(tid)
                    ? tid
                    : 'elegant_invitation'
                : type === 'normal_post'
                  ? 'normal_post_stub_v1'
                  : SPECIAL_OFFER_TEMPLATE_IDS.includes(tid)
                    ? tid
                    : 'discount_hero';
        return {
            type,
            format: 'square',
            templateId,
            content: {
                title: docData?.content?.title || '',
                subtitle: docData?.content?.subtitle || '',
                description: docData?.content?.description || '',
                cta: docData?.content?.cta || '',
                badgeText: docData?.content?.badgeText || '',
                dateText: docData?.content?.dateText || '',
                timeText: docData?.content?.timeText || '',
                locationText: docData?.content?.locationText || '',
                imageUrl: docData?.media?.imageUrl || docData?.content?.imageUrl || '',
            },
            style: {
                animation: docData?.style?.animation || 'stagger',
                themeId: docData?.style?.themeId || 'midnight',
                durationMs: docData?.style?.durationMs || 700,
            },
        };
    };

    const toStoredUiPreview = (docData) => {
        const s = normalizePostSize(docData?.ui?.postSize || 'square');
        const d = docData?.ui?.aiDesign || null;
        return {
            postSize: s,
            previewDesign: d
                ? {
                      textPlacement: d.textPlacement || 'bottom',
                      overlayStrength: typeof d.overlayStrength === 'number' ? d.overlayStrength : 0.32,
                      imageFocus: d.imageFocus || 'center',
                      styleMood: d.styleMood || '',
                  }
                : null,
        };
    };

    const handlePublishFromComposer = async () => {
        setDraftActionError('');
        setDraftActionMessage('');

        if (!isBusinessAccount) {
            setDraftActionError('Motion posts are available for business accounts.');
            return;
        }

        if (isViewingArchivedMotion) {
            setDraftActionError('Archived posts are view-only. Publishing is not available yet.');
            return;
        }

        if (!validation.valid || !validation.safePost) {
            setDraftActionError('Please fix validation errors before saving.');
            return;
        }

        setSavingDraft(true);
        try {
            const saveInput = buildMotionSaveInput('publish');
            if (!saveInput) {
                setDraftActionError('Could not build publish payload.');
                return;
            }
            console.log('[MotionAI][publish] selectedPostSize before publish', saveInput._debug.selectedPostSize);
            console.log('[MotionAI][publish] payload aspectRatio on publish', saveInput.ui?.aspectRatio);
            if (saveInput._debug.aiDesignExists && saveInput.ui?.finalImage?.source !== 'aiDesign') {
                throw new Error('Publish blocked: AI design exists but final image source is not aiDesign.');
            }
            if (saveInput._debug.selectedPostSize !== 'square' && saveInput.ui?.aspectRatio === '1:1') {
                throw new Error('Publish blocked: non-square selected size cannot publish with 1:1 aspect ratio.');
            }

            let targetId = activeDraftId;
            if (targetId) {
                await updateMotionPostDraft(targetId, saveInput);
            } else {
                targetId = await createMotionPostDraft(saveInput);
                setActiveDraftId(targetId);
                resetMotionPreDraftStorageKey();
            }

            await publishMotionPost(targetId, currentUser.uid, currentUser.uid);
            setDraftActionMessage(
                activeMotionRow?.status === 'published'
                    ? 'Post updated and remains published.'
                    : 'Post published.'
            );
            setMotionImageUploadError('');
            await loadMotionPosts();
        } catch (err) {
            console.error('Publish from composer failed:', err);
            setDraftActionError(err?.message || 'Failed to publish post');
        } finally {
            setSavingDraft(false);
        }
    };

    const handleEditDraft = (row) => {
        if (!showComposer) {
            navigate(`/ai-marketing-studio?draft=${encodeURIComponent(row.id)}`);
            return;
        }
        setDraftActionError('');
        setDraftActionMessage('');
        setMotionImageUploadError('');
        setMotionImageUploadProgress(null);
        setMotionImageUploading(false);
        setMotionAiError('');
        setMotionTextGenerated(false);
        setActiveDraftId(row.id);
        setMotionPreviewPost(toPreviewPayload(row));
        const storedUi = toStoredUiPreview(row);
        setPostSize(storedUi.postSize);
        const tpl = String(row?.ui?.postTemplateId || '').trim();
        setSelectedPostTemplateId(
            tpl && POST_TEMPLATE_CARDS.some((c) => c.id === tpl) ? tpl : 'classic_split'
        );
        if (storedUi.previewDesign) {
            applyMotionPreviewDesign(storedUi.previewDesign, 'handleEditDraft:storedUi');
        } else {
            clearMotionPreviewDesign('handleEditDraft');
        }
        if (row.type === 'event_post') {
            setCreationType('event');
        } else if (row.type === 'normal_post') {
            setCreationType('regular');
        } else if (row.type === 'special_offer_post') {
            setCreationType('offer');
        } else if (row?.content?.badgeText) {
            setCreationType('offer');
        } else {
            setCreationType('regular');
        }
    };

    const handleArchiveDraft = async (row) => {
        setDraftActionError('');
        setDraftActionMessage('');
        if (!isBusinessAccount) {
            setDraftActionError('Motion posts are available for business accounts.');
            return;
        }
        setMotionPostBusyId(row.id);
        try {
            await archiveMotionPost(row.id, currentUser.uid, currentUser.uid);
            if (activeDraftId === row.id) setActiveDraftId(null);
            setDraftActionMessage('Post archived.');
            await loadMotionPosts();
        } catch (err) {
            console.error('Archive failed:', err);
            setDraftActionError(err?.message || 'Failed to archive post');
        } finally {
            setMotionPostBusyId(null);
        }
    };

    const handlePublishMotionPost = async (row) => {
        setDraftActionError('');
        setDraftActionMessage('');
        if (!isBusinessAccount) {
            setDraftActionError('Motion posts are available for business accounts.');
            return;
        }
        const payload = toPreviewPayload(row);
        const v = validateMotionPost(payload);
        if (!v.valid || !v.safePost) {
            setDraftActionError(
                v.errors?.length
                    ? `Cannot publish: ${v.errors.join(' ')}`
                    : 'Cannot publish until the post passes validation.'
            );
            return;
        }
        setMotionPostBusyId(row.id);
        try {
            await publishMotionPost(row.id, currentUser.uid, currentUser.uid);
            setDraftActionMessage('Post published (internal only — not on the public feed yet).');
            await loadMotionPosts();
        } catch (err) {
            console.error('Publish failed:', err);
            setDraftActionError(err?.message || 'Failed to publish post');
        } finally {
            setMotionPostBusyId(null);
        }
    };

    const handleUnpublishMotionPost = async (row) => {
        setDraftActionError('');
        setDraftActionMessage('');
        if (!isBusinessAccount) {
            setDraftActionError('Motion posts are available for business accounts.');
            return;
        }
        setMotionPostBusyId(row.id);
        try {
            await unpublishMotionPost(row.id, currentUser.uid, currentUser.uid);
            setDraftActionMessage('Post moved back to draft.');
            await loadMotionPosts();
        } catch (err) {
            console.error('Unpublish failed:', err);
            setDraftActionError(err?.message || 'Failed to unpublish post');
        } finally {
            setMotionPostBusyId(null);
        }
    };

    const handleMotionAiGenerateText = async () => {
        setMotionAiError('');
        setDraftActionError('');
        if (!isBusinessAccount) {
            setMotionAiError('AI motion generation is available for business accounts.');
            return;
        }
        const trimmed = motionAiPrompt.trim();
        if (trimmed.length < 3) {
            setMotionAiError('Please enter a short idea (at least 3 characters).');
            return;
        }
        setMotionTextGenerating(true);
        try {
            console.log('[MotionAI][request] sending', {
                type: motionPreviewPost.type,
                prompt: trimmed,
                tone: motionAiTone,
                language: motionAiLanguage === 'ar' ? 'ar' : 'en',
                imageUrl: motionPreviewPost.content.imageUrl || '',
                selectedPostSize: normalizePostSize(postSize),
                generationMode: 'text',
            });
            const fields = await callSuggestMotionPostContent({
                type: motionPreviewPost.type,
                prompt: trimmed,
                tone: motionAiTone,
                language: motionAiLanguage === 'ar' ? 'ar' : 'en',
                imageUrl: motionPreviewPost.content.imageUrl || '',
                selectedPostSize: normalizePostSize(postSize),
                generationMode: 'text',
            });
            console.log('[MotionAI][response][text] raw fields', fields);
            const normalizedType = motionPreviewPost.type === 'normal_post' ? 'regular_post' : motionPreviewPost.type;
            const isOffer = normalizedType === 'special_offer_post';
            const isEvent = normalizedType === 'event_post';
            const isRegularPost = normalizedType === 'regular_post';
            const nextContent = { ...motionPreviewPost.content };
            if (isRegularPost) {
                nextContent.title = fields.title != null ? String(fields.title) : nextContent.title;
                nextContent.subtitle = fields.subtitle != null ? String(fields.subtitle) : nextContent.subtitle;
                nextContent.description =
                    fields.body != null
                        ? String(fields.body)
                        : fields.description != null
                          ? String(fields.description)
                          : nextContent.description;
                nextContent.cta = '';
                nextContent.badgeText = '';
                nextContent.dateText = '';
                nextContent.timeText = '';
                nextContent.locationText = '';
            } else if (isOffer) {
                nextContent.title = fields.title != null ? String(fields.title) : nextContent.title;
                nextContent.subtitle = fields.subtitle != null ? String(fields.subtitle) : nextContent.subtitle;
                nextContent.description = fields.description != null ? String(fields.description) : nextContent.description;
                nextContent.cta =
                    fields.ctaText != null
                        ? String(fields.ctaText)
                        : fields.cta != null
                          ? String(fields.cta)
                          : nextContent.cta;
                nextContent.badgeText =
                    fields.offerLabel != null
                        ? String(fields.offerLabel)
                        : fields.badgeText != null
                          ? String(fields.badgeText)
                          : nextContent.badgeText;
                nextContent.dateText = '';
                nextContent.timeText = '';
                nextContent.locationText = '';
            } else if (isEvent) {
                nextContent.title = fields.title != null ? String(fields.title) : nextContent.title;
                nextContent.subtitle = fields.subtitle != null ? String(fields.subtitle) : nextContent.subtitle;
                nextContent.description = fields.description != null ? String(fields.description) : nextContent.description;
                nextContent.cta =
                    fields.ctaText != null
                        ? String(fields.ctaText)
                        : fields.cta != null
                          ? String(fields.cta)
                          : nextContent.cta;
                nextContent.dateText =
                    fields.eventDetails != null
                        ? String(fields.eventDetails)
                        : fields.dateText != null
                          ? String(fields.dateText)
                          : nextContent.dateText;
                nextContent.timeText = fields.timeText != null ? String(fields.timeText) : nextContent.timeText;
                nextContent.locationText =
                    fields.locationText != null ? String(fields.locationText) : nextContent.locationText;
                nextContent.badgeText = '';
            }
            const nextPost = {
                ...motionPreviewPost,
                content: nextContent,
            };
            const v = validateMotionPost(nextPost);
            setMotionPreviewPost(nextPost);
            setMotionTextGenerated(true);
            console.log('[MotionAI][state-apply][text]', {
                nextPostContent: nextPost.content,
                selectedPostSizeAfterText: normalizePostSize(postSize),
            });
            if (!v.valid) {
                setMotionAiError(
                    v.errors?.length ? v.errors.join(' ') : 'Generated content does not pass validation. Edit fields manually.'
                );
                setDraftActionMessage('');
            } else {
                setMotionAiError('');
                setDraftActionMessage(t('motion_text_generated', 'Text generated. You can edit it now.'));
            }
        } catch (err) {
            console.error('Motion AI text generate failed:', err);
            setMotionAiError(err?.message || 'Text generation failed. Try again.');
        } finally {
            setMotionTextGenerating(false);
        }
    };

    const draftIdFromQuery = searchParams.get('draft');
    useEffect(() => {
        if (!showComposer || !motionPosts.length) return;
        const draftId = draftIdFromQuery;
        if (!draftId) return;
        if (motionAutoDraftLoadDoneRef.current && activeDraftId === draftId) return;
        const row = motionPosts.find((r) => r.id === draftId);
        if (!row) return;
        motionAutoDraftLoadDoneRef.current = true;
        handleEditDraft(row);
    }, [showComposer, motionPosts, draftIdFromQuery, activeDraftId]);

    return (
        <div id="motion-posts-studio" className="my-community-section">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 12, color: 'var(--text-main)', paddingInline: 12 }}>
                {t('motion_studio_section_title', 'AI & Motion posts')}
            </h3>
            <div className="my-community-card" style={{ display: 'grid', gap: '16px', padding: '20px' }}>
                {!isBusinessAccount ? (
                    <div
                        style={{
                            border: '1px solid rgba(245,158,11,0.45)',
                            background: 'rgba(245,158,11,0.1)',
                            borderRadius: 10,
                            padding: '12px 14px',
                            color: '#fbbf24',
                        }}
                    >
                        {t(
                            'motion_studio_business_only',
                            'Motion posts are a business feature. Switch to a business profile to create posts. AI uses Dine Credits for every generation.'
                        )}
                    </div>
                ) : (
                    <>
                        {showComposer && motionFieldsLocked ? (
                            <div
                                style={{
                                    border: '1px solid rgba(148,163,184,0.45)',
                                    background: 'rgba(148,163,184,0.12)',
                                    borderRadius: 10,
                                    padding: '10px 12px',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.85rem',
                                }}
                            >
                                {t(
                                    'motion_studio_archived_readonly',
                                    'Viewing an archived post (read-only). You can inspect the live preview below; saving changes is not available yet.'
                                )}
                            </div>
                        ) : null}

                        {showComposer ? (
                        <>
                        <div
                            style={
                                isDesktopLayout
                                    ? {
                                          display: 'grid',
                                          gap: 14,
                                          gridTemplateColumns: 'minmax(320px, 1fr) minmax(460px, 1.25fr)',
                                          gridTemplateAreas: `
                                            "theme theme"
                                            "template aspect"
                                            "left right"
                                            "bottom bottom"
                                            "actions actions"
                                          `,
                                          alignItems: 'start',
                                      }
                                    : { display: 'grid', gap: '14px' }
                            }
                        >
                            <div style={isDesktopLayout ? { display: 'grid', gap: 8, gridArea: 'left' } : { display: 'grid', gap: 8 }}>
                            <div style={{ display: 'grid', gap: '8px' }}>
                                <label style={motionStepLabelStyle}>{t('post_type', 'Post Type')}</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(100px, 1fr))', gap: '8px', padding: '6px', borderRadius: 12 }}>
                                    {CREATION_TYPES.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setCreationType(item.id)}
                                            className="my-community-btn my-community-btn--post"
                                            disabled={motionFieldsLocked}
                                            style={{
                                                minHeight: 46,
                                                padding: '8px 10px',
                                                display: 'grid',
                                                justifyItems: 'start',
                                                gap: 1,
                                                opacity: motionFieldsLocked ? 0.7 : 1,
                                                border: creationType === item.id ? '1px solid var(--primary)' : '1px solid rgba(148,163,184,0.45)',
                                                background: creationType === item.id ? 'transparent' : 'rgba(255,255,255,0.06)',
                                                color: creationType === item.id ? 'var(--primary)' : '#e5e7eb',
                                                boxShadow: creationType === item.id ? '0 0 0 1px rgba(232,110,46,0.2) inset' : 'none',
                                            }}
                                        >
                                            <span style={{ fontWeight: 800, fontSize: '0.83rem', lineHeight: 1.1 }}>{item.label}</span>
                                            <span style={{ fontSize: '0.66rem', opacity: 0.8, lineHeight: 1.1 }}>{item.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: 'grid', gap: 6 }}>
                                <label style={motionStepLabelStyle}>{t('idea_prompt', 'Idea / prompt')}</label>
                                <textarea value={motionAiPrompt} onChange={(e) => setMotionAiPrompt(e.target.value)} placeholder={t('idea_prompt_placeholder', 'e.g. brunch launch this weekend with family menu and live music')} rows={2} disabled={motionAiBusy || motionFieldsLocked} style={{ padding: '10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', resize: 'vertical' }} />
                            </div>
                            <div style={{ display: 'grid', gap: 6 }}>
                                <label style={motionStepLabelStyle}>{t('generate_text_with_ai', 'Generate Text with AI')}</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    <select value={motionAiTone} onChange={(e) => setMotionAiTone(e.target.value)} disabled={motionAiBusy || motionFieldsLocked} style={{ padding: '10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }}>
                                        <option value="friendly">Friendly</option><option value="elegant">Elegant</option><option value="energetic">Energetic</option><option value="luxury">Luxury</option><option value="fun">Fun</option>
                                    </select>
                                    <select value={motionAiLanguage} onChange={(e) => setMotionAiLanguage(e.target.value)} disabled={motionAiBusy || motionFieldsLocked} style={{ padding: '10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }}>
                                        <option value="en">English</option><option value="ar">Arabic</option>
                                    </select>
                                </div>
                                <button type="button" className="my-community-btn my-community-btn--post" disabled={motionTextGenerating || motionAiPrompt.trim().length < 3 || motionFieldsLocked} onClick={handleMotionAiGenerateText} style={{ opacity: motionTextGenerating || motionAiPrompt.trim().length < 3 || motionFieldsLocked ? 0.65 : 1, justifySelf: 'start' }}>
                                    {motionTextGenerating ? t('generating_text', 'Generating text...') : t('generate_text_with_ai', 'Generate Text with AI')}
                                </button>
                            </div>
                            <div style={{ display: 'grid', gap: '8px' }}>
                                <label style={motionStepLabelStyle}>{t('manual_editing', 'Manual text editing')}</label>
                                <input readOnly={motionFieldsLocked} value={motionPreviewPost.content.title || ''} onChange={(e) => updateMotionContent('title', e.target.value)} placeholder={`title (max ${maxLens.title})`} style={{ padding: '10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', opacity: motionFieldsLocked ? 0.85 : 1 }} />
                                <input readOnly={motionFieldsLocked} value={motionPreviewPost.content.subtitle || ''} onChange={(e) => updateMotionContent('subtitle', e.target.value)} placeholder={`subtitle (max ${maxLens.subtitle})`} style={{ padding: '10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', opacity: motionFieldsLocked ? 0.85 : 1 }} />
                                <textarea readOnly={motionFieldsLocked} value={motionPreviewPost.content.description || ''} onChange={(e) => updateMotionContent('description', e.target.value)} placeholder={`description (max ${maxLens.description})`} rows={3} style={{ padding: '10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', resize: 'vertical', opacity: motionFieldsLocked ? 0.85 : 1 }} />
                                {motionPreviewPost.type !== 'normal_post' ? (
                                    <input readOnly={motionFieldsLocked} value={motionPreviewPost.content.cta || ''} onChange={(e) => updateMotionContent('cta', e.target.value)} placeholder={`cta (max ${maxLens.cta})`} style={{ padding: '10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', opacity: motionFieldsLocked ? 0.85 : 1 }} />
                                ) : null}
                                {creationType === 'offer' ? <input readOnly={motionFieldsLocked} value={motionPreviewPost.content.badgeText || ''} onChange={(e) => updateMotionContent('badgeText', e.target.value)} placeholder={`badgeText (max ${maxLens.badgeText})`} style={{ padding: '10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', opacity: motionFieldsLocked ? 0.85 : 1 }} /> : null}
                                {creationType === 'event' ? (
                                    <>
                                        <input readOnly={motionFieldsLocked} value={motionPreviewPost.content.dateText || ''} onChange={(e) => updateMotionContent('dateText', e.target.value)} placeholder={`dateText (max ${maxLens.dateText})`} style={{ padding: '10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', opacity: motionFieldsLocked ? 0.85 : 1 }} />
                                        <input readOnly={motionFieldsLocked} value={motionPreviewPost.content.timeText || ''} onChange={(e) => updateMotionContent('timeText', e.target.value)} placeholder={`timeText (max ${maxLens.timeText ?? 44})`} style={{ padding: '10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', opacity: motionFieldsLocked ? 0.85 : 1 }} />
                                        <input readOnly={motionFieldsLocked} value={motionPreviewPost.content.locationText || ''} onChange={(e) => updateMotionContent('locationText', e.target.value)} placeholder={`locationText (max ${maxLens.locationText ?? 96})`} style={{ padding: '10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', opacity: motionFieldsLocked ? 0.85 : 1 }} />
                                    </>
                                ) : null}
                            </div>
                            </div>
                            <div style={isDesktopLayout ? { display: 'grid', gap: 8, gridArea: 'bottom' } : { display: 'grid', gap: 8 }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>{t('cover_image', 'Cover image')}</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                                    <input ref={motionCoverFileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={handleMotionCoverFileChange} />
                                    <button type="button" className="my-community-btn my-community-btn--story" disabled={motionFieldsLocked || motionImageUploading || !currentUser?.uid} onClick={() => motionCoverFileInputRef.current?.click()}>
                                        {motionImageUploading ? t('uploading', 'Uploading…') : t('upload_image', 'Upload image')}
                                    </button>
                                    {motionImageUploading && motionImageUploadProgress != null ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{Math.round(motionImageUploadProgress)}%</span> : null}
                                </div>
                                {motionImageUploading ? <div style={{ height: 6, borderRadius: 999, background: 'var(--hover-overlay)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, Math.max(0, motionImageUploadProgress ?? 0))}%`, background: 'var(--primary)', transition: 'width 0.15s ease-out' }} /></div> : null}
                                {motionImageUploadError ? <div style={{ fontSize: '0.8rem', color: '#fecaca', border: '1px solid rgba(239,68,68,0.45)', background: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: '8px 10px' }}>{motionImageUploadError}</div> : null}
                                <input readOnly={motionFieldsLocked} value={motionPreviewPost.content.imageUrl || ''} onChange={(e) => updateMotionContent('imageUrl', e.target.value)} placeholder={t('image_url_placeholder', 'Image URL (optional — paste a link or use Upload image)')} style={{ padding: '10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', opacity: motionFieldsLocked ? 0.85 : 1 }} />
                            </div>
                            <div style={isDesktopLayout ? { display: 'grid', gap: 8, gridArea: 'theme' } : { display: 'grid', gap: 8 }}>
                                <label style={motionStepLabelStyle}>{t('color_theme', 'Theme')}</label>
                                <div
                                    ref={themeCarouselRef}
                                    onMouseDown={handleThemeMouseDown}
                                    onMouseLeave={handleThemeMouseLeave}
                                    onMouseUp={handleThemeMouseUp}
                                    onMouseMove={handleThemeMouseMove}
                                    style={{
                                        display: 'flex',
                                        gap: 12,
                                        overflowX: 'auto',
                                        padding: '4px 11% 10px',
                                        scrollSnapType: 'x mandatory',
                                        scrollbarWidth: 'none',
                                        msOverflowStyle: 'none',
                                        cursor: motionFieldsLocked ? 'not-allowed' : 'grab',
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                        touchAction: 'pan-x',
                                    }}
                                >
                                    {MOTION_COLOR_THEME_PICKER.map((theme) => {
                                        const isSelected = selectedColorThemeId === theme.id;
                                        return (
                                            <button
                                                key={theme.id}
                                                type="button"
                                                data-theme-card={theme.id}
                                                disabled={motionFieldsLocked}
                                                onClick={() => {
                                                    if (themeDragRef.current.moved) {
                                                        themeDragRef.current.moved = false;
                                                        return;
                                                    }
                                                    setSelectedColorThemeId(theme.id);
                                                    setMotionPreviewPost((prev) => ({
                                                        ...prev,
                                                        style: { ...prev.style, themeId: clampMotionThemeId(theme.themeId) },
                                                    }));
                                                    scrollThemeIntoView(theme.id);
                                                }}
                                                style={{
                                                    scrollSnapAlign: 'center',
                                                    flex: '0 0 min(78%, 250px)',
                                                    borderRadius: 16,
                                                    border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                                    background: 'rgba(15,23,42,0.88)',
                                                    boxShadow: isSelected ? '0 0 0 1px rgba(232,110,46,0.28) inset, 0 16px 30px -16px rgba(232,110,46,0.7)' : '0 12px 24px -18px rgba(2,6,23,0.9)',
                                                    transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                                                    transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
                                                    padding: '10px',
                                                    display: 'grid',
                                                    gap: 8,
                                                    textAlign: 'left',
                                                    opacity: motionFieldsLocked ? 0.7 : 1,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        minHeight: 116,
                                                        borderRadius: 12,
                                                        border: '1px solid rgba(255,255,255,0.18)',
                                                        background: theme.preview,
                                                        padding: '10px',
                                                        display: 'grid',
                                                        alignContent: 'space-between',
                                                    }}
                                                >
                                                    <div style={{ color: '#f8fafc', fontWeight: 900, fontSize: '0.95rem', lineHeight: 1.06, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                                                        <div>DINNER</div>
                                                        <div style={{ fontSize: '1.05rem' }}>Tonight</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        {theme.colors.map((color) => (
                                                            <span key={`${theme.id}-${color}`} style={{ width: 16, height: 16, borderRadius: 999, background: color, border: '1px solid rgba(255,255,255,0.55)' }} />
                                                        ))}
                                                    </div>
                                                </div>
                                                <div style={{ color: '#f8fafc', fontSize: '0.82rem', fontWeight: 800 }}>{theme.title}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            {motionPreviewPost.type === 'normal_post' ? (
                                <div style={isDesktopLayout ? { display: 'grid', gap: 8, gridArea: 'template' } : { display: 'grid', gap: 8 }}>
                                    <label style={motionStepLabelStyle}>{t('post_template', 'Post Template')}</label>
                                    <div
                                        ref={postTemplateCarouselRef}
                                        onMouseDown={handlePostTemplateMouseDown}
                                        onMouseLeave={handlePostTemplateMouseLeave}
                                        onMouseUp={handlePostTemplateMouseUp}
                                        onMouseMove={handlePostTemplateMouseMove}
                                        style={{
                                            display: 'flex',
                                            gap: 12,
                                            overflowX: 'auto',
                                            padding: '4px 11% 10px',
                                            scrollSnapType: 'x mandatory',
                                            scrollbarWidth: 'none',
                                            msOverflowStyle: 'none',
                                            cursor: motionFieldsLocked ? 'not-allowed' : 'grab',
                                            userSelect: 'none',
                                            WebkitUserSelect: 'none',
                                            touchAction: 'pan-x',
                                        }}
                                    >
                                        {POST_TEMPLATE_CARDS.map((card) => {
                                            const isSel = selectedPostTemplateId === card.id;
                                            return (
                                                <button
                                                    key={card.id}
                                                    type="button"
                                                    data-post-template-card={card.id}
                                                    disabled={motionFieldsLocked}
                                                    onClick={() => {
                                                        if (postTemplateDragRef.current.moved) {
                                                            postTemplateDragRef.current.moved = false;
                                                            return;
                                                        }
                                                        setSelectedPostTemplateId(card.id);
                                                        scrollPostTemplateIntoView(card.id);
                                                    }}
                                                    style={{
                                                        scrollSnapAlign: 'center',
                                                        flex: '0 0 min(78%, 250px)',
                                                        borderRadius: 16,
                                                        border: isSel ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                                        background: 'rgba(15,23,42,0.88)',
                                                        boxShadow: isSel ? '0 0 0 1px rgba(232,110,46,0.28) inset, 0 16px 30px -16px rgba(232,110,46,0.7)' : '0 12px 24px -18px rgba(2,6,23,0.9)',
                                                        transform: isSel ? 'scale(1.04)' : 'scale(1)',
                                                        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
                                                        padding: '12px 14px',
                                                        display: 'grid',
                                                        gap: 8,
                                                        textAlign: 'left',
                                                        opacity: motionFieldsLocked ? 0.7 : 1,
                                                    }}
                                                >
                                                    <div style={{ color: '#f8fafc', fontWeight: 900, fontSize: '0.95rem' }}>{card.title}</div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.35 }}>{card.desc}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : motionPreviewPost.type === 'special_offer_post' ? (
                                <div style={isDesktopLayout ? { display: 'grid', gap: 8, gridArea: 'template' } : { display: 'grid', gap: 8 }}>
                                    <label style={motionStepLabelStyle}>{t('offer_layout', 'Offer layout')}</label>
                                    <div
                                        ref={offerTemplateCarouselRef}
                                        onMouseDown={handleOfferTemplateMouseDown}
                                        onMouseLeave={handleOfferTemplateMouseLeave}
                                        onMouseUp={handleOfferTemplateMouseUp}
                                        onMouseMove={handleOfferTemplateMouseMove}
                                        style={{
                                            display: 'flex',
                                            gap: 12,
                                            overflowX: 'auto',
                                            padding: '4px 11% 10px',
                                            scrollSnapType: 'x mandatory',
                                            scrollbarWidth: 'none',
                                            msOverflowStyle: 'none',
                                            cursor: motionFieldsLocked ? 'not-allowed' : 'grab',
                                            userSelect: 'none',
                                            WebkitUserSelect: 'none',
                                            touchAction: 'pan-x',
                                        }}
                                    >
                                        {OFFER_TEMPLATE_CARDS.map((card) => {
                                            const isSel = motionPreviewPost.templateId === card.id;
                                            return (
                                                <button
                                                    key={card.id}
                                                    type="button"
                                                    data-offer-template-card={card.id}
                                                    disabled={motionFieldsLocked}
                                                    onClick={() => {
                                                        if (offerTemplateDragRef.current.moved) {
                                                            offerTemplateDragRef.current.moved = false;
                                                            return;
                                                        }
                                                        setMotionPreviewPost((prev) => ({ ...prev, templateId: card.id }));
                                                        scrollOfferTemplateIntoView(card.id);
                                                    }}
                                                    style={{
                                                        scrollSnapAlign: 'center',
                                                        flex: '0 0 min(78%, 250px)',
                                                        borderRadius: 16,
                                                        border: isSel ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                                        background: 'rgba(15,23,42,0.88)',
                                                        boxShadow: isSel ? '0 0 0 1px rgba(232,110,46,0.28) inset, 0 16px 30px -16px rgba(232,110,46,0.7)' : '0 12px 24px -18px rgba(2,6,23,0.9)',
                                                        transform: isSel ? 'scale(1.04)' : 'scale(1)',
                                                        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
                                                        padding: '12px 14px',
                                                        display: 'grid',
                                                        gap: 8,
                                                        textAlign: 'left',
                                                        opacity: motionFieldsLocked ? 0.7 : 1,
                                                    }}
                                                >
                                                    <div style={{ color: '#f8fafc', fontWeight: 900, fontSize: '0.95rem' }}>{card.title}</div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.35 }}>{card.desc}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : motionPreviewPost.type === 'event_post' ? (
                                <div style={isDesktopLayout ? { display: 'grid', gap: 8, gridArea: 'template' } : { display: 'grid', gap: 8 }}>
                                    <label style={motionStepLabelStyle}>{t('event_layout', 'Event layout')}</label>
                                    <div
                                        ref={eventTemplateCarouselRef}
                                        onMouseDown={handleEventTemplateMouseDown}
                                        onMouseLeave={handleEventTemplateMouseLeave}
                                        onMouseUp={handleEventTemplateMouseUp}
                                        onMouseMove={handleEventTemplateMouseMove}
                                        style={{
                                            display: 'flex',
                                            gap: 12,
                                            overflowX: 'auto',
                                            padding: '4px 11% 10px',
                                            scrollSnapType: 'x mandatory',
                                            scrollbarWidth: 'none',
                                            msOverflowStyle: 'none',
                                            cursor: motionFieldsLocked ? 'not-allowed' : 'grab',
                                            userSelect: 'none',
                                            WebkitUserSelect: 'none',
                                            touchAction: 'pan-x',
                                        }}
                                    >
                                        {EVENT_TEMPLATE_CARDS.map((card) => {
                                            const isSel = motionPreviewPost.templateId === card.id;
                                            return (
                                                <button
                                                    key={card.id}
                                                    type="button"
                                                    data-event-template-card={card.id}
                                                    disabled={motionFieldsLocked}
                                                    onClick={() => {
                                                        if (eventTemplateDragRef.current.moved) {
                                                            eventTemplateDragRef.current.moved = false;
                                                            return;
                                                        }
                                                        setMotionPreviewPost((prev) => ({ ...prev, templateId: card.id }));
                                                        scrollEventTemplateIntoView(card.id);
                                                    }}
                                                    style={{
                                                        scrollSnapAlign: 'center',
                                                        flex: '0 0 min(78%, 250px)',
                                                        borderRadius: 16,
                                                        border: isSel ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                                        background: 'rgba(15,23,42,0.88)',
                                                        boxShadow: isSel ? '0 0 0 1px rgba(232,110,46,0.28) inset, 0 16px 30px -16px rgba(232,110,46,0.7)' : '0 12px 24px -18px rgba(2,6,23,0.9)',
                                                        transform: isSel ? 'scale(1.04)' : 'scale(1)',
                                                        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
                                                        padding: '12px 14px',
                                                        display: 'grid',
                                                        gap: 8,
                                                        textAlign: 'left',
                                                        opacity: motionFieldsLocked ? 0.7 : 1,
                                                    }}
                                                >
                                                    <div style={{ color: '#f8fafc', fontWeight: 900, fontSize: '0.95rem' }}>{card.title}</div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.35 }}>{card.desc}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : null}
                            {isDesktopLayout ? (
                                <div style={{ display: 'grid', gap: 8, gridArea: 'aspect' }}>
                                    <label style={motionStepLabelStyle}>{t('post_size', 'Post Size')}</label>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {POST_SIZES.map((size) => (
                                            <button
                                                key={`desktop-size-${size.id}`}
                                                type="button"
                                                onClick={() => setPostSize(size.id)}
                                                disabled={motionFieldsLocked}
                                                style={{
                                                    padding: '9px 14px',
                                                    borderRadius: 12,
                                                    border: postSize === size.id ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                                    background: postSize === size.id ? 'rgba(232,110,46,0.14)' : 'var(--bg-input)',
                                                    color: 'var(--text-main)',
                                                    fontSize: '0.86rem',
                                                    fontWeight: 800,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    lineHeight: 1.1,
                                                }}
                                            >
                                                <span>{size.label}</span>
                                                <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>{size.ratio}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {!validation.valid && (
                            <div style={{ border: '1px solid rgba(239,68,68,0.45)', background: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: '10px 12px' }}>
                                <div style={{ color: '#ef4444', fontWeight: 800, marginBottom: 6, fontSize: '0.85rem' }}>{t('validation_errors', 'Validation errors')}</div>
                                <ul style={{ margin: 0, paddingInlineStart: 18, color: '#fecaca', fontSize: '0.8rem' }}>
                                    {validation.errors.map((err, i) => <li key={`${err}-${i}`}>{err}</li>)}
                                </ul>
                            </div>
                        )}

                        {draftActionError ? (
                            <div style={{ border: '1px solid rgba(239,68,68,0.45)', background: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: '10px 12px', color: '#fecaca', fontSize: '0.85rem' }}>{draftActionError}</div>
                        ) : null}
                        {draftActionMessage ? (
                            <div style={{ border: '1px solid rgba(34,197,94,0.45)', background: 'rgba(34,197,94,0.1)', borderRadius: 10, padding: '10px 12px', color: '#bbf7d0', fontSize: '0.85rem' }}>{draftActionMessage}</div>
                        ) : null}

                        <div style={isDesktopLayout ? { display: 'grid', gap: 8, gridArea: 'right' } : { display: 'grid', gap: '8px' }}>
                            <div style={{ display: isDesktopLayout ? 'none' : 'grid', gap: '8px' }}>
                                <label style={motionStepLabelStyle}>{t('post_size', 'Post Size')}</label>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {POST_SIZES.map((size) => (
                                        <button
                                            key={size.id}
                                            type="button"
                                            onClick={() => setPostSize(size.id)}
                                            disabled={motionFieldsLocked}
                                            style={{
                                                padding: '9px 14px',
                                                borderRadius: 12,
                                                border: postSize === size.id ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                                background: postSize === size.id ? 'rgba(232,110,46,0.14)' : 'var(--bg-input)',
                                                color: 'var(--text-main)',
                                                fontSize: '0.86rem',
                                                fontWeight: 800,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                lineHeight: 1.1,
                                            }}
                                        >
                                            <span>{size.label}</span>
                                            <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>{size.ratio}</span>
                                        </button>
                                    ))}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('post_size_ui_only', 'Size is currently a UI-only selection and does not change template storage yet.')}</div>
                            </div>
                            <div
                                style={{
                                    borderRadius: 14,
                                    border: '1px solid var(--border-color)',
                                    padding: 10,
                                    background: 'var(--bg-input)',
                                    display: 'grid',
                                    alignContent: 'start',
                                    justifyItems: 'center',
                                    gap: 8,
                                    overflow: 'visible',
                                    minHeight: isDesktopLayout ? 640 : undefined,
                                }}
                            >
                                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        aria-label={t('replay_animation', 'Replay animation')}
                                        title={t('replay_animation', 'Replay animation')}
                                        onClick={() => setPreviewReplaySeed((x) => x + 1)}
                                        style={{
                                            borderRadius: 999,
                                            border: '1px solid var(--border-color)',
                                            background: 'rgba(15,23,42,0.72)',
                                            color: 'var(--text-main)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 6,
                                            fontSize: '0.8rem',
                                            fontWeight: 800,
                                            cursor: 'pointer',
                                            padding: '6px 10px',
                                            lineHeight: 1,
                                        }}
                                    >
                                        <span aria-hidden="true">↻</span>
                                        <span>{t('replay_animation', 'إعادة تشغيل')}</span>
                                    </button>
                                    {MOTION_ANIMATION_PICKER.map((anim) => {
                                        const isActive = motionPreviewPost.style.animation === anim.id;
                                        const animIcon = anim.id === 'fade' ? '◍' : anim.id === 'slide' ? '⇢' : anim.id === 'pop' ? '✦' : '⋯';
                                        return (
                                            <button
                                                key={anim.id}
                                                type="button"
                                                aria-label={`${t('animation', 'Animation')}: ${anim.title}`}
                                                title={anim.title}
                                                disabled={motionFieldsLocked}
                                                onClick={() =>
                                                    setMotionPreviewPost((prev) => {
                                                        const nextAnim = clampMotionAnimation(anim.id);
                                                        if (prev.style.animation !== nextAnim) {
                                                            setPreviewReplaySeed((x) => x + 1);
                                                        }
                                                        return {
                                                            ...prev,
                                                            style: { ...prev.style, animation: nextAnim },
                                                        };
                                                    })
                                                }
                                                style={{
                                                    borderRadius: 999,
                                                    border: isActive ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                                    background: isActive ? 'rgba(232,110,46,0.14)' : 'rgba(15,23,42,0.72)',
                                                    color: 'var(--text-main)',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: 6,
                                                    fontSize: '0.78rem',
                                                    fontWeight: 800,
                                                    cursor: motionFieldsLocked ? 'not-allowed' : 'pointer',
                                                    padding: '6px 10px',
                                                    lineHeight: 1,
                                                    opacity: motionFieldsLocked ? 0.7 : 1,
                                                }}
                                            >
                                                <span aria-hidden="true">{animIcon}</span>
                                                <span>{anim.title}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div key={previewReplaySeed} style={{ width: '100%', maxWidth: '100%', display: 'flex', justifyContent: 'center', marginTop: 2 }}>
                                    {renderMotionPost(motionPreviewPost, {
                                        previewAspect: postSize,
                                        previewDesign: motionPreviewDesign || undefined,
                                        postTemplateId:
                                            motionPreviewPost.type === 'normal_post' ? selectedPostTemplateId : undefined,
                                        aspectRatio:
                                            motionPreviewPost.type === 'normal_post' ? selectedAspectRatio : undefined,
                                    })}
                                </div>
                            </div>
                        </div>

                        <div style={isDesktopLayout ? { display: 'grid', gap: 8, gridArea: 'actions' } : { display: 'grid', gap: 8 }}>
                            <div style={motionStepLabelStyle}>{t('save_publish', 'Save / Publish')}</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button type="button" onClick={handlePublishFromComposer} className="my-community-btn my-community-btn--post" disabled={savingDraft || motionFieldsLocked} style={{ opacity: savingDraft || motionFieldsLocked ? 0.7 : 1 }}>
                                    {savingDraft ? t('publishing', 'Publishing...') : t('publish', 'Publish')}
                                </button>
                                {activeDraftId ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveDraftId(null);
                                            setDraftActionError('');
                                            setDraftActionMessage('');
                                            setMotionImageUploadError('');
                                            setMotionImageUploadProgress(null);
                                            setMotionImageUploading(false);
                                            setMotionAiError('');
                                            setMotionTextGenerated(false);
                                            clearMotionPreviewDesign('newDraftButton');
                                            resetMotionPreDraftStorageKey();
                                        }}
                                        className="my-community-btn my-community-btn--story"
                                    >
                                        {t('new_draft', 'New draft')}
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        {savedPostsPagePath ? (
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="my-community-btn my-community-btn--chat"
                                    onClick={() => navigate(savedPostsPagePath)}
                                >
                                    {t('open_saved_motion_posts', 'Open saved posts')}
                                </button>
                            </div>
                        ) : null}
                        </>
                        ) : null}

                        {showSavedPosts ? (
                        <div style={{ display: 'grid', gap: '10px' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>{t('saved_motion_posts', 'Saved motion posts')}</div>

                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                {(['all', 'drafts', 'published', 'archived']).map((tabKey) => (
                                    <button
                                        key={tabKey}
                                        type="button"
                                        onClick={() => setMotionListTab(tabKey)}
                                        className="my-community-btn my-community-btn--story"
                                        style={{
                                            minWidth: tabKey === 'published' ? 88 : 72,
                                            opacity: motionListTab === tabKey ? 1 : 0.65,
                                            fontWeight: motionListTab === tabKey ? 800 : 600,
                                        }}
                                    >
                                        {tabKey === 'all' ? t('all', 'All') : tabKey === 'drafts' ? t('drafts', 'Drafts') : tabKey === 'published' ? t('published', 'Published') : t('archived', 'Archived')}
                                    </button>
                                ))}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(140px, 200px)', gap: 10, alignItems: 'end' }}>
                                <div style={{ display: 'grid', gap: 6 }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>{t('search', 'Search')}</label>
                                    <input
                                        value={motionSearchQuery}
                                        onChange={(e) => setMotionSearchQuery(e.target.value)}
                                        placeholder={t('motion_search_placeholder', 'Title, subtitle, description, badge, date, or updated date…')}
                                        style={{ padding: '10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
                                    />
                                </div>
                                <div style={{ display: 'grid', gap: 6 }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>{t('sort', 'Sort')}</label>
                                    <select
                                        value={motionSort}
                                        onChange={(e) => setMotionSort(e.target.value)}
                                        style={{ padding: '10px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
                                    >
                                        <option value="recent">{t('sort_recently_updated', 'Recently updated')}</option>
                                        <option value="oldest">{t('sort_oldest', 'Oldest updated')}</option>
                                        <option value="title-az">{t('sort_title_az', 'Title A–Z')}</option>
                                    </select>
                                </div>
                            </div>

                            {motionSavedListEmpty === 'loading' ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('loading_saved_posts', 'Loading saved posts…')}</div>
                            ) : null}
                            {motionSavedListEmpty === 'no-posts' ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>{t('motion_no_posts_yet', 'You have not published any motion posts yet. Use Publish above to create your first one.')}</div>
                            ) : null}
                            {motionSavedListEmpty === 'no-drafts' ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>{t('motion_no_drafts', 'No drafts right now. Published posts are under Published; archived posts under Archived.')}</div>
                            ) : null}
                            {motionSavedListEmpty === 'no-published' ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>{t('motion_no_published', 'No published posts yet. Publish a valid draft from the Drafts or All tab when you are ready (internal only for now).')}</div>
                            ) : null}
                            {motionSavedListEmpty === 'no-archived' ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>{t('motion_no_archived', 'No archived posts yet. Archive a draft or published post from the All, Drafts, or Published list when you want to retire it.')}</div>
                            ) : null}
                            {motionSavedListEmpty === 'no-search' ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>{t('motion_no_search_results', 'No posts match your search. Try another keyword or clear the search box.')}</div>
                            ) : null}

                            {!motionSavedListEmpty
                                ? motionSortedList.map((row) => {
                                    const previewPayload = toPreviewPayload(row);
                                    const updatedDate = row?.updatedAt?.toDate ? row.updatedAt.toDate() : (row?.createdAt?.toDate ? row.createdAt.toDate() : null);
                                    const docSt = motionDocStatus(row);
                                    const rowBusy = motionPostBusyId === row.id;
                                    const statusPill = (() => {
                                        if (docSt === 'archived') {
                                            return (
                                                <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: 0.04, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, background: 'rgba(148,163,184,0.25)', color: 'var(--text-muted)', border: '1px solid rgba(148,163,184,0.45)' }}>
                                                    {t('archived', 'Archived')}
                                                </span>
                                            );
                                        }
                                        if (docSt === 'published') {
                                            return (
                                                <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: 0.04, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, background: 'rgba(56,189,248,0.2)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.45)' }}>
                                                    {t('published', 'Published')}
                                                </span>
                                            );
                                        }
                                        return (
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', color: '#86efac', border: '1px solid rgba(34,197,94,0.35)' }}>
                                                {t('draft', 'Draft')}
                                            </span>
                                        );
                                    })();
                                    return (
                                        <div key={row.id} style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 10, display: 'grid', gap: 8 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                                                <div style={{ display: 'grid', gap: 6 }}>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                                            {(row.type === 'event_post'
                                                                ? t('event', 'Event')
                                                                : row.type === 'normal_post'
                                                                  ? t('regular_post', 'Regular post')
                                                                  : t('special_offer', 'Special Offer'))}{' '}
                                                            — {row?.content?.title || t('untitled', 'Untitled')}
                                                        </span>
                                                        {statusPill}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        {updatedDate
                                                            ? t('updated_at', { date: updatedDate.toLocaleString(), defaultValue: 'Updated {{date}}' })
                                                            : t('no_update_date', 'No update date')}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                    <button type="button" onClick={() => handleEditDraft(row)} className="my-community-btn my-community-btn--post" disabled={rowBusy}>
                                                        {docSt === 'archived' ? t('view', 'View') : t('edit', 'Edit')}
                                                    </button>
                                                    {docSt === 'draft' ? (
                                                        <button type="button" onClick={() => handlePublishMotionPost(row)} className="my-community-btn my-community-btn--story" disabled={rowBusy}>
                                                            {t('publish', 'Publish')}
                                                        </button>
                                                    ) : null}
                                                    {docSt === 'published' ? (
                                                        <button type="button" onClick={() => handleUnpublishMotionPost(row)} className="my-community-btn my-community-btn--story" disabled={rowBusy}>
                                                            {t('unpublish', 'Unpublish')}
                                                        </button>
                                                    ) : null}
                                                    {docSt !== 'archived' ? (
                                                        <button type="button" onClick={() => handleArchiveDraft(row)} className="my-community-btn my-community-btn--chat" disabled={rowBusy}>
                                                            {t('archive', 'Archive')}
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div style={{ maxWidth: 220 }}>
                                                {renderMotionPost(previewPayload, {
                                                    previewAspect: motionPostPreviewAspectFromDoc(row),
                                                })}
                                            </div>
                                        </div>
                                    );
                                })
                                : null}
                        </div>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
};

export default MotionPostStudio;