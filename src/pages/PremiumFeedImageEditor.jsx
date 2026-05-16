import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { HexColorPicker } from 'react-colorful';
import { FaArrowLeft, FaBold, FaItalic, FaShare, FaFont, FaImage, FaPalette } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { canUsePremiumFeedImageEditor } from '../utils/premiumFeedEditorAccess';
import AppRouteLoading from '../components/AppRouteLoading';
import './PremiumFeedImageEditor.css';
import './PremiumFeedLockedPromoDeal.css';

const DEFAULT_BG =
    'https://images.unsplash.com/photo-1509316785289-025f5cd8461c?auto=format&fit=crop&w=1600&q=80';
/** Smaller Unsplash URL for template thumbnails (full URL can fail in strict WebViews). */
const DEFAULT_BG_THUMB = `${DEFAULT_BG.split('?')[0]}?auto=format&fit=crop&w=400&q=75&fm=jpg`;

const ASPECTS = {
    '1_1': { w: 1080, h: 1080, labelKey: 'feed_studio_aspect_11', labelDefault: '1 : 1 (Feed square)' },
    '4_5': { w: 1080, h: 1350, labelKey: 'feed_studio_aspect_45', labelDefault: '4 : 5 (Feed portrait)' },
};

const FONT_PRESETS = [
    { id: 'inter', label: 'Inter', family: '"Inter", system-ui, -apple-system, sans-serif' },
    { id: 'rounded', label: 'Rounded UI', family: 'system-ui, "Segoe UI", Roboto, sans-serif' },
    { id: 'impact', label: 'Impact', family: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif' },
    { id: 'serif', label: 'Editorial', family: 'Georgia, "Times New Roman", serif' },
    { id: 'mono', label: 'Mono', family: 'ui-monospace, "Cascadia Code", monospace' },
];

const STYLE_PRESETS = [
    { id: 'clean', labelKey: 'feed_studio_style_clean', labelDefault: 'Clean', shadow: '0 2px 14px rgba(0,0,0,0.35)' },
    { id: 'strong', labelKey: 'feed_studio_style_strong', labelDefault: 'Strong', shadow: '0 4px 28px rgba(0,0,0,0.75)' },
    { id: 'billboard', labelKey: 'feed_studio_style_billboard', labelDefault: 'Billboard', shadow: '0 2px 0 rgba(0,0,0,0.9), 0 8px 32px rgba(0,0,0,0.85)' },
];

const defaultField = () => ({
    text: '',
    fontSize: 36,
    fontWeight: 700,
    fontStyle: 'normal',
    color: '#ffffff',
    opacity: 1,
    textShadow: STYLE_PRESETS[0].shadow,
    fontId: 'inter',
});

/** Typography only (sizes locked in CSS for promo-deal template). */
function lockedFieldSurfaceStyle(field) {
    const fam = FONT_PRESETS.find((f) => f.id === field.fontId)?.family;
    return {
        fontFamily: fam,
        color: field.color,
        opacity: field.opacity,
        textShadow: field.textShadow && field.textShadow !== 'none' ? field.textShadow : undefined,
    };
}

/** Inline styles for the HTML preview (scaled from editor units). */
function fieldPreviewStyle(field, sizeDivisor) {
    const fam = FONT_PRESETS.find((f) => f.id === field.fontId)?.family;
    const px = Math.max(11, Math.round(field.fontSize / sizeDivisor));
    return {
        fontFamily: fam,
        fontSize: `${px}px`,
        fontWeight: field.fontWeight,
        fontStyle: field.fontStyle,
        color: field.color,
        opacity: field.opacity,
        textShadow: field.textShadow,
    };
}

function mergeThemeFields(partial) {
    return {
        title: { ...defaultField(), ...partial.title },
        subtitle: { ...defaultField(), ...partial.subtitle },
        message: { ...defaultField(), ...partial.message },
    };
}

function mergeLockedPromoFields(partial) {
    return {
        badge: {
            ...defaultField(),
            fontSize: 14,
            fontWeight: 700,
            textShadow: 'none',
            ...partial.badge,
        },
        title: { ...defaultField(), ...partial.title },
        subtitle: { ...defaultField(), ...partial.subtitle },
        message: { ...defaultField(), ...partial.message },
    };
}

/** Inline background for the HTML preview stage (mirrors canvas). */
function buildHtmlPreviewStageStyle({ canvasLayout, canvasGradient, canvasSolid, bgDisplay, stripDisplay, splitBottomColor }) {
    const style = {
        backgroundSize: 'cover',
        backgroundPosition: 'center',
    };
    if (canvasLayout === 'full') {
        if (canvasGradient) {
            style.background = canvasGradient;
        } else if (canvasSolid) {
            style.backgroundColor = canvasSolid;
        } else if (bgDisplay) {
            style.backgroundImage = `url(${bgDisplay})`;
        }
    } else {
        style.backgroundColor = splitBottomColor || '#ffffff';
        if (stripDisplay) {
            style.backgroundImage = `url(${stripDisplay})`;
            style.backgroundSize = '100% 40%';
            style.backgroundRepeat = 'no-repeat';
            style.backgroundPosition = 'top center';
        }
    }
    return style;
}

function buildUserGradient(angleDeg, colorA, colorB) {
    return `linear-gradient(${angleDeg}deg, ${colorA} 0%, ${colorB} 100%)`;
}

const URBAN_IMG =
    'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1600&q=80';
const PASTEL_GRAD =
    'linear-gradient(145deg, #fbc2eb 0%, #a8c0ff 42%, #c2e9fb 100%)';
/** Locked promo card: layout & font sizes fixed in CSS; only font family, colors, and outer background change in the studio. */
const LOCKED_PROMO_DEAL_ID = 'promo-deal';
const PROMO_DEAL_GRAD = 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)';
const PRODUCT_IMG =
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1600&q=80';

/** Ready-made layouts (mobile post builder gallery). */
const POST_TEMPLATES = [
    {
        id: 'desert-elegant',
        labelKey: 'feed_tpl_desert',
        labelDefault: '1. صحراء أنيقة',
        thumb: DEFAULT_BG_THUMB,
        apply: () => ({
            layout: 'full',
            fullImageUrl: DEFAULT_BG,
            gradient: null,
            solid: null,
            stripUrl: null,
            splitBottom: null,
            decor: null,
            tone: 'dark',
            stylePreset: 'clean',
            fields: mergeThemeFields({
                title: { text: 'عنوان رئيسي', fontSize: 44, fontWeight: 800, color: '#ffffff', textShadow: STYLE_PRESETS[0].shadow },
                subtitle: { text: 'عنوان فرعي', fontSize: 28, fontWeight: 600, color: '#f8fafc', textShadow: STYLE_PRESETS[0].shadow },
                message: { text: 'نص تفصيلي للمنشور.', fontSize: 22, fontWeight: 500, color: '#f1f5f9', textShadow: STYLE_PRESETS[0].shadow },
            }),
        }),
    },
    {
        id: 'urban-minimal',
        labelKey: 'feed_tpl_urban',
        labelDefault: '2. Urban Minimal',
        thumb: `${URBAN_IMG.split('?')[0]}?auto=format&w=400&q=60`,
        apply: () => ({
            layout: 'full',
            fullImageUrl: URBAN_IMG,
            gradient: null,
            solid: null,
            stripUrl: null,
            splitBottom: null,
            decor: null,
            tone: 'dark',
            stylePreset: 'strong',
            fields: mergeThemeFields({
                title: { text: 'عنوان رئيسي', fontSize: 44, fontWeight: 800, color: '#ffffff', textShadow: STYLE_PRESETS[1].shadow, fontId: 'rounded' },
                subtitle: { text: 'عنوان فرعي', fontSize: 28, fontWeight: 600, color: '#e2e8f0', textShadow: STYLE_PRESETS[1].shadow },
                message: { text: 'نص تفصيلي للمنشور.', fontSize: 22, fontWeight: 500, color: '#cbd5e1', textShadow: STYLE_PRESETS[1].shadow },
            }),
        }),
    },
    {
        id: 'abstract-pastel',
        labelKey: 'feed_tpl_pastel',
        labelDefault: '3. Abstract Pastel',
        thumbGradient: PASTEL_GRAD,
        apply: () => ({
            layout: 'full',
            fullImageUrl: '',
            gradient: PASTEL_GRAD,
            solid: null,
            stripUrl: null,
            splitBottom: null,
            decor: null,
            tone: 'light',
            stylePreset: 'clean',
            fields: mergeThemeFields({
                title: { text: 'عنوان رئيسي', fontSize: 44, fontWeight: 800, color: '#0f172a', textShadow: '0 1px 2px rgba(255,255,255,0.35)', fontId: 'rounded' },
                subtitle: { text: 'عنوان فرعي', fontSize: 28, fontWeight: 600, color: '#1e3a5f', textShadow: '0 1px 1px rgba(255,255,255,0.25)' },
                message: { text: 'نص تفصيلي للمنشور.', fontSize: 22, fontWeight: 500, color: '#334155', textShadow: 'none' },
            }),
        }),
    },
    {
        id: 'business-card',
        labelKey: 'feed_tpl_business_card',
        labelDefault: '4. بطاقة أعمال',
        thumbSolid: '#eef4fb',
        apply: () => ({
            layout: 'full',
            fullImageUrl: '',
            gradient: null,
            solid: '#eef4fb',
            stripUrl: null,
            splitBottom: null,
            decor: 'pastel-blob',
            tone: 'light',
            stylePreset: 'clean',
            fields: mergeThemeFields({
                title: { text: 'عنوان رئيسي', fontSize: 40, fontWeight: 800, color: '#0f172a', textShadow: 'none', fontId: 'serif' },
                subtitle: { text: 'Subtitle', fontSize: 24, fontWeight: 600, color: '#334155', textShadow: 'none' },
                message: { text: 'Message', fontSize: 20, fontWeight: 500, color: '#475569', textShadow: 'none' },
            }),
        }),
    },
    {
        id: 'desert-strip',
        labelKey: 'feed_tpl_desert_strip',
        labelDefault: '5. بطاقة صحراء',
        thumb: DEFAULT_BG_THUMB,
        apply: () => ({
            layout: 'split',
            fullImageUrl: '',
            gradient: null,
            solid: null,
            stripUrl: DEFAULT_BG,
            splitBottom: '#d4c4a8',
            decor: null,
            tone: 'light',
            stylePreset: 'clean',
            fields: mergeThemeFields({
                title: { text: 'عنوان رئيسي', fontSize: 36, fontWeight: 800, color: '#1c1917', textShadow: 'none' },
                subtitle: { text: 'Subtitle', fontSize: 22, fontWeight: 600, color: '#44403c', textShadow: 'none' },
                message: { text: 'الرسالة', fontSize: 18, fontWeight: 500, color: '#57534e', textShadow: 'none' },
            }),
        }),
    },
    {
        id: 'product-showcase',
        labelKey: 'feed_tpl_product',
        labelDefault: '6. عرض منتج',
        thumb: `${PRODUCT_IMG.split('?')[0]}?auto=format&w=400&q=60`,
        apply: () => ({
            layout: 'split',
            fullImageUrl: '',
            gradient: null,
            solid: null,
            stripUrl: PRODUCT_IMG,
            splitBottom: '#ffffff',
            decor: null,
            tone: 'light',
            stylePreset: 'clean',
            fields: mergeThemeFields({
                title: { text: 'عنوان رئيسي', fontSize: 36, fontWeight: 800, color: '#0f172a', textShadow: 'none', fontId: 'inter' },
                subtitle: { text: 'Subtitle', fontSize: 22, fontWeight: 600, color: '#334155', textShadow: 'none' },
                message: { text: 'الرسالة', fontSize: 18, fontWeight: 500, color: '#475569', textShadow: 'none' },
            }),
        }),
    },
    {
        id: 'event-gold',
        labelKey: 'feed_tpl_event',
        labelDefault: '7. فعالية فاخرة',
        thumbGradient: 'linear-gradient(165deg, #2a2218 0%, #0c0a08 100%)',
        apply: () => ({
            layout: 'full',
            fullImageUrl: '',
            gradient: 'linear-gradient(165deg, #2a2218 0%, #1a1410 45%, #0c0a08 100%)',
            solid: null,
            stripUrl: null,
            splitBottom: null,
            decor: 'gold-accent',
            tone: 'dark',
            stylePreset: 'billboard',
            fields: mergeThemeFields({
                title: { text: 'عنوان الحدث', fontSize: 46, fontWeight: 800, color: '#d4af37', textShadow: STYLE_PRESETS[2].shadow, fontId: 'serif' },
                subtitle: { text: 'Subtitle', fontSize: 26, fontWeight: 600, color: '#e8d5a3', textShadow: STYLE_PRESETS[2].shadow },
                message: { text: 'الرسالة', fontSize: 20, fontWeight: 500, color: '#f5e6c8', textShadow: STYLE_PRESETS[1].shadow },
            }),
        }),
    },
    {
        id: 'blank-neutral',
        labelKey: 'feed_tpl_blank',
        labelDefault: '8. فارغ',
        thumbSolid: '#e8edf3',
        apply: () => ({
            layout: 'full',
            fullImageUrl: '',
            gradient: null,
            solid: '#e8edf3',
            stripUrl: null,
            splitBottom: null,
            decor: null,
            tone: 'light',
            stylePreset: 'clean',
            fields: mergeThemeFields({
                title: { text: 'عنوان', fontSize: 40, fontWeight: 700, color: '#1e293b', textShadow: 'none' },
                subtitle: { text: 'عنوان فرعي', fontSize: 24, fontWeight: 600, color: '#475569', textShadow: 'none' },
                message: { text: 'نص المنشور…', fontSize: 20, fontWeight: 500, color: '#64748b', textShadow: 'none' },
            }),
        }),
    },
    {
        id: 'promo-deal-card',
        labelKey: 'feed_tpl_promo_deal',
        labelDefault: '9. عرض ترويجي (تنسيق ثابت)',
        thumbGradient: PROMO_DEAL_GRAD,
        locked: LOCKED_PROMO_DEAL_ID,
        apply: () => ({
            layout: 'full',
            fullImageUrl: '',
            gradient: PROMO_DEAL_GRAD,
            solid: null,
            stripUrl: null,
            splitBottom: null,
            decor: null,
            tone: 'dark',
            stylePreset: 'clean',
            fields: mergeLockedPromoFields({
                badge: {
                    text: 'عرض خاص لفترة محدودة',
                    color: '#ff416c',
                    fontId: 'rounded',
                    textShadow: 'none',
                },
                title: {
                    text: 'خصم 50%',
                    fontSize: 50,
                    fontWeight: 900,
                    color: '#ffffff',
                    textShadow: STYLE_PRESETS[0].shadow,
                },
                subtitle: {
                    text: 'على كافة المشروبات والوجبات',
                    fontSize: 20,
                    fontWeight: 300,
                    color: '#ffffff',
                    opacity: 0.9,
                    textShadow: 'none',
                },
                message: {
                    text:
                        'استمتع بسهرة لا تُنسى في "نايت كلوب الأساطير". هذا العرض حصري لأعضاء الخطة المدفوعة فقط. احجز طاولتك الآن!',
                    fontSize: 16,
                    fontWeight: 400,
                    color: '#ffffff',
                    textShadow: 'none',
                },
            }),
        }),
    },
];

function useBlobBackground(url) {
    const [blobUrl, setBlobUrl] = useState(null);

    useEffect(() => {
        if (!url) {
            setBlobUrl(null);
            return;
        }
        let cancelled = false;
        fetch(url)
            .then((r) => r.blob())
            .then((blob) => {
                if (!cancelled) setBlobUrl(URL.createObjectURL(blob));
            })
            .catch(() => {
                if (!cancelled) setBlobUrl(url);
            });
        return () => {
            cancelled = true;
        };
    }, [url]);

    useEffect(() => {
        return () => {
            if (blobUrl && blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
        };
    }, [blobUrl]);

    if (!url) return null;
    return blobUrl || url;
}

/** Floating toolbar on the active text block — color & font open popovers (no full-screen modal). */
function FieldToolbar({
    fieldKey,
    field,
    min,
    max,
    boldOn,
    boldOff,
    popover,
    setPopover,
    patchField,
    t,
    fontColorOnly = false,
}) {
    return (
        <div className="feed-studio-toolbar-shell">
            <div className="feed-studio-quickbar feed-studio-quickbar--on-canvas feed-studio-themable-bar" role="toolbar">
                {!fontColorOnly ? (
                    <>
                        <button
                            type="button"
                            className={`feed-studio-tb-icon${field.fontWeight >= 600 ? ' is-on' : ''}`}
                            onClick={() => patchField(fieldKey, { fontWeight: field.fontWeight >= 600 ? boldOff : boldOn })}
                            aria-pressed={field.fontWeight >= 600}
                        >
                            <FaBold />
                        </button>
                        <button
                            type="button"
                            className={`feed-studio-tb-icon${field.fontStyle === 'italic' ? ' is-on' : ''}`}
                            onClick={() =>
                                patchField(fieldKey, {
                                    fontStyle: field.fontStyle === 'italic' ? 'normal' : 'italic',
                                })
                            }
                            aria-pressed={field.fontStyle === 'italic'}
                        >
                            <FaItalic />
                        </button>
                        <label className="feed-studio-quickbar__size feed-studio-quickbar__size--lg">
                            <span className="sr-only">{t('feed_studio_font_size', 'Font size')}</span>
                            <input
                                type="number"
                                min={min}
                                max={max}
                                value={field.fontSize}
                                onChange={(e) =>
                                    patchField(fieldKey, { fontSize: Number(e.target.value) || min })
                                }
                            />
                            <span>px</span>
                        </label>
                    </>
                ) : null}
                <button
                    type="button"
                    className={`feed-studio-tb-font${popover === 'font' ? ' is-open' : ''}`}
                    onClick={() => setPopover((p) => (p === 'font' ? null : 'font'))}
                    aria-expanded={popover === 'font'}
                >
                    <FaFont aria-hidden />
                    <span className="feed-studio-tb-font__label">
                        {FONT_PRESETS.find((f) => f.id === field.fontId)?.label}
                    </span>
                </button>
                <button
                    type="button"
                    className={`feed-studio-tb-swatch${popover === 'color' ? ' is-open' : ''}`}
                    style={{ background: field.color }}
                    onClick={() => setPopover((p) => (p === 'color' ? null : 'color'))}
                    aria-expanded={popover === 'color'}
                    aria-label={t('feed_studio_color', 'Color')}
                    title={t('feed_studio_color', 'Color')}
                >
                    <FaPalette className="feed-studio-tb-swatch__icon" aria-hidden />
                </button>
            </div>
            {popover === 'color' && (
                <div
                    className="feed-studio-float-pop feed-studio-float-pop--color"
                    role="dialog"
                    aria-label={t('feed_studio_color', 'Color')}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <HexColorPicker color={field.color} onChange={(c) => patchField(fieldKey, { color: c })} />
                </div>
            )}
            {popover === 'font' && (
                <div
                    className="feed-studio-float-pop feed-studio-float-pop--font"
                    role="dialog"
                    aria-label={t('feed_studio_font_manager', 'Font family')}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="feed-studio-float-pop__heading">{t('feed_studio_font_manager', 'Font family')}</div>
                    <ul className="feed-studio-float-font-list">
                        {FONT_PRESETS.map((f) => (
                            <li key={f.id}>
                                <button
                                    type="button"
                                    className={field.fontId === f.id ? 'is-active' : ''}
                                    style={{ fontFamily: f.family }}
                                    onClick={() => {
                                        patchField(fieldKey, { fontId: f.id });
                                        setPopover(null);
                                    }}
                                >
                                    {f.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default function PremiumFeedImageEditor() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();

    const [access, setAccess] = useState(null);
    const [aspectKey, setAspectKey] = useState('1_1');
    const [bgSource, setBgSource] = useState(DEFAULT_BG);
    const [canvasLayout, setCanvasLayout] = useState('full');
    const [canvasGradient, setCanvasGradient] = useState(null);
    const [canvasSolid, setCanvasSolid] = useState(null);
    const [headerStripUrl, setHeaderStripUrl] = useState(null);
    const [splitBottomColor, setSplitBottomColor] = useState(null);
    const [decorClass, setDecorClass] = useState(null);
    /** Ghost field borders: dark canvas vs light canvas */
    const [canvasTone, setCanvasTone] = useState('dark');
    const [selectedTemplateId, setSelectedTemplateId] = useState('desert-elegant');
    /** User-uploaded background (blob: or https:). Applied to every template (full bleed or split strip). */
    const [userPhotoBgUrl, setUserPhotoBgUrl] = useState(null);
    /** When no photo: template colors vs custom solid vs custom gradient (full layouts; split coerces gradient → template). */
    const [colorFillKind, setColorFillKind] = useState('template');
    const [userSolidColor, setUserSolidColor] = useState('#eef4fb');
    const [userGradA, setUserGradA] = useState('#fbc2eb');
    const [userGradB, setUserGradB] = useState('#a8c0ff');
    const [userGradAngle, setUserGradAngle] = useState(145);
    const [fields, setFields] = useState(() =>
        mergeThemeFields({
            title: { text: 'عنوان رئيسي', fontSize: 44, fontWeight: 800, color: '#ffffff', textShadow: STYLE_PRESETS[0].shadow },
            subtitle: { text: 'عنوان فرعي', fontSize: 28, fontWeight: 600, color: '#f8fafc', textShadow: STYLE_PRESETS[0].shadow },
            message: { text: 'نص تفصيلي للمنشور.', fontSize: 22, fontWeight: 500, color: '#f1f5f9', textShadow: STYLE_PRESETS[0].shadow },
        })
    );
    const [activeField, setActiveField] = useState('title');
    const [stylePreset, setStylePreset] = useState('clean');
    /** 'color' | 'font' | null — popovers on the in-canvas toolbar for the active field */
    const [toolbarPopover, setToolbarPopover] = useState(null);
    const [previewAnimEpoch, setPreviewAnimEpoch] = useState(0);
    /** When set, canvas uses a fixed-layout template (sizes not editable). */
    const [lockedTemplateId, setLockedTemplateId] = useState(null);
    /** Usable width from `.feed-studio-page` (clientWidth). Never measure the column that contains the canvas — overflow inflates it. */
    const [layoutAvailW, setLayoutAvailW] = useState(0);
    const pageRef = useRef(null);
    const fileBgRef = useRef(null);

    const bgDisplay = useBlobBackground(
        canvasLayout === 'full' && !canvasGradient && !canvasSolid && bgSource ? bgSource : ''
    );
    const stripDisplay = useBlobBackground(canvasLayout === 'split' && headerStripUrl ? headerStripUrl : '');

    const userPhotoBgUrlRef = useRef(null);
    useEffect(() => {
        userPhotoBgUrlRef.current = userPhotoBgUrl;
    }, [userPhotoBgUrl]);

    useEffect(
        () => () => {
            const u = userPhotoBgUrlRef.current;
            if (u && u.startsWith('blob:')) URL.revokeObjectURL(u);
        },
        []
    );

    useEffect(() => {
        if (userPhotoBgUrl) return;
        if (colorFillKind !== 'solid') return;
        if (canvasLayout === 'split') setSplitBottomColor(userSolidColor);
        else setCanvasSolid(userSolidColor);
    }, [userSolidColor, colorFillKind, userPhotoBgUrl, canvasLayout]);

    useEffect(() => {
        if (userPhotoBgUrl) return;
        if (colorFillKind !== 'gradient') return;
        if (canvasLayout === 'split') return;
        setCanvasGradient(buildUserGradient(userGradAngle, userGradA, userGradB));
    }, [userGradA, userGradB, userGradAngle, colorFillKind, userPhotoBgUrl, canvasLayout]);

    const dims = ASPECTS[aspectKey];

    useEffect(() => {
        setPreviewAnimEpoch((n) => n + 1);
    }, [aspectKey, stylePreset]);

    useLayoutEffect(() => {
        if (access !== true) return undefined;
        const el = pageRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;

        const read = () => {
            const w = el.clientWidth;
            if (w > 0) setLayoutAvailW(Math.floor(w));
        };

        read();
        requestAnimationFrame(() => requestAnimationFrame(read));
        const ro = new ResizeObserver(read);
        ro.observe(el);
        const onWin = () => read();
        window.addEventListener('orientationchange', onWin);
        window.addEventListener('resize', onWin);
        return () => {
            ro.disconnect();
            window.removeEventListener('orientationchange', onWin);
            window.removeEventListener('resize', onWin);
        };
    }, [access]);

    useEffect(() => {
        if (!currentUser?.uid) {
            setAccess(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'users', currentUser.uid));
                const live = snap.exists() ? snap.data() : {};
                const merged = { ...(userProfile || {}), ...live };
                if (!cancelled) setAccess(canUsePremiumFeedImageEditor(merged));
            } catch {
                if (!cancelled) setAccess(canUsePremiumFeedImageEditor(userProfile));
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [currentUser?.uid, userProfile]);

    const patchActive = useCallback(
        (patch) => {
            setFields((prev) => ({
                ...prev,
                [activeField]: { ...prev[activeField], ...patch },
            }));
        },
        [activeField]
    );

    const active = fields[activeField] ?? fields.title;

    const isLockedPromo = lockedTemplateId === LOCKED_PROMO_DEAL_ID;

    const patchField = useCallback((key, patch) => {
        setFields((prev) => ({
            ...prev,
            [key]: { ...prev[key], ...patch },
        }));
    }, []);

    /** Locked promo: only font family, color, opacity, text — not size/weight/style. */
    const patchLockedTypography = useCallback((key, patch) => {
        if (!patch || typeof patch !== 'object') return;
        const allowed = {};
        if ('color' in patch) allowed.color = patch.color;
        if ('fontId' in patch) allowed.fontId = patch.fontId;
        if ('opacity' in patch) allowed.opacity = patch.opacity;
        if ('text' in patch) allowed.text = patch.text;
        if ('textShadow' in patch) allowed.textShadow = patch.textShadow;
        patchField(key, allowed);
    }, [patchField]);

    const applyTemplate = useCallback(
        (tpl, opts = {}) => {
            const p = tpl.apply();
            setLockedTemplateId(tpl.locked ?? null);
            setActiveField((af) => (af === 'badge' && !tpl.locked ? 'title' : af));
            const photo = 'userPhotoOverride' in opts ? opts.userPhotoOverride : userPhotoBgUrl;
            let fillKind = opts.fillKind ?? colorFillKind;
            if (p.layout === 'split' && fillKind === 'gradient') {
                fillKind = 'template';
                setColorFillKind('template');
            }

            setCanvasLayout(p.layout);
            setDecorClass(p.decor ?? null);
            setCanvasTone(p.tone ?? 'dark');
            setFields(p.fields);
            setStylePreset(p.stylePreset);
            setSelectedTemplateId(tpl.id);
            setToolbarPopover(null);
            setPreviewAnimEpoch((n) => n + 1);

            if (photo) {
                setCanvasGradient(null);
                setCanvasSolid(null);
                if (p.layout === 'split') {
                    setBgSource('');
                    setHeaderStripUrl(photo);
                    setSplitBottomColor(p.splitBottom ?? null);
                } else {
                    setBgSource(photo);
                    setHeaderStripUrl(null);
                    setSplitBottomColor(null);
                }
                return;
            }

            if (fillKind === 'solid') {
                setCanvasGradient(null);
                if (p.layout === 'split') {
                    setCanvasSolid(null);
                    setBgSource('');
                    setHeaderStripUrl(p.stripUrl ?? null);
                    setSplitBottomColor(userSolidColor);
                } else {
                    setCanvasSolid(userSolidColor);
                    setBgSource('');
                    setHeaderStripUrl(null);
                    setSplitBottomColor(null);
                }
                return;
            }

            if (fillKind === 'gradient') {
                setCanvasSolid(null);
                setCanvasGradient(buildUserGradient(userGradAngle, userGradA, userGradB));
                setBgSource('');
                setHeaderStripUrl(null);
                setSplitBottomColor(null);
                return;
            }

            setCanvasGradient(p.gradient);
            setCanvasSolid(p.solid);
            setBgSource(p.fullImageUrl ?? '');
            setHeaderStripUrl(p.stripUrl ?? null);
            setSplitBottomColor(p.splitBottom ?? null);
        },
        [userPhotoBgUrl, colorFillKind, userSolidColor, userGradA, userGradB, userGradAngle]
    );

    useEffect(() => {
        setToolbarPopover(null);
    }, [activeField]);

    useEffect(() => {
        if (!toolbarPopover) return;
        const onDocDown = (e) => {
            if (e.target.closest('.feed-studio-toolbar-shell')) return;
            setToolbarPopover(null);
        };
        document.addEventListener('pointerdown', onDocDown);
        return () => document.removeEventListener('pointerdown', onDocDown);
    }, [toolbarPopover]);

    /** Mobile: hide bottom tab bar while typing so it does not stack above the soft keyboard (Android/iOS). */
    useEffect(() => {
        if (access !== true) return undefined;
        const root = pageRef.current;
        if (!root) return undefined;

        const isTextLikeFocused = (el) => {
            if (!el || el === document.body) return false;
            if (el.isContentEditable) return true;
            const tag = el.tagName;
            if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
            if (tag !== 'INPUT') return false;
            const type = String(el.type || '').toLowerCase();
            if (
                type === 'button' ||
                type === 'submit' ||
                type === 'checkbox' ||
                type === 'radio' ||
                type === 'file' ||
                type === 'hidden' ||
                type === 'reset' ||
                type === 'image'
            ) {
                return false;
            }
            return true;
        };

        const syncKeyboardChrome = () => {
            const vv = typeof window !== 'undefined' ? window.visualViewport : null;
            const innerH = typeof window !== 'undefined' ? window.innerHeight : 0;
            const vvSmall = vv && innerH > 0 && vv.height < innerH * 0.72;
            const active = document.activeElement;
            const inStudio = active && root.contains(active) && isTextLikeFocused(active);
            document.body.classList.toggle('feed-studio-keyboard-open', Boolean(vvSmall || inStudio));
        };

        const onVV = () => syncKeyboardChrome();
        const onFocusIn = (e) => {
            if (root.contains(e.target)) syncKeyboardChrome();
        };
        const onFocusOut = () => {
            window.setTimeout(syncKeyboardChrome, 140);
        };

        const vv = typeof window !== 'undefined' ? window.visualViewport : null;
        if (vv) {
            vv.addEventListener('resize', onVV);
            vv.addEventListener('scroll', onVV);
        }
        document.addEventListener('focusin', onFocusIn, true);
        document.addEventListener('focusout', onFocusOut, true);
        syncKeyboardChrome();
        requestAnimationFrame(syncKeyboardChrome);

        return () => {
            if (vv) {
                vv.removeEventListener('resize', onVV);
                vv.removeEventListener('scroll', onVV);
            }
            document.removeEventListener('focusin', onFocusIn, true);
            document.removeEventListener('focusout', onFocusOut, true);
            document.body.classList.remove('feed-studio-keyboard-open');
        };
    }, [access]);

    const applyStylePreset = useCallback(
        (id) => {
            if (lockedTemplateId === LOCKED_PROMO_DEAL_ID) return;
            setStylePreset(id);
            const p = STYLE_PRESETS.find((s) => s.id === id);
            if (p) patchActive({ textShadow: p.shadow });
        },
        [patchActive, lockedTemplateId]
    );

    const handleContinueToComposer = () => {
        const bgForState =
            typeof bgSource === 'string' && !bgSource.startsWith('blob:') ? bgSource : null;
        const stripForState =
            typeof headerStripUrl === 'string' && !headerStripUrl.startsWith('blob:') ? headerStripUrl : null;
        const captionParts = isLockedPromo
            ? [fields.badge?.text, fields.title.text, fields.subtitle.text, fields.message.text]
            : [fields.title.text, fields.subtitle.text, fields.message.text];
        navigate('/create-post', {
            state: {
                premiumFeedCaptionHint: captionParts.filter(Boolean).join('\n\n'),
                feedStudioLayout: {
                    aspectKey,
                    templateId: selectedTemplateId,
                    lockedTemplateId: isLockedPromo ? LOCKED_PROMO_DEAL_ID : null,
                    canvasLayout,
                    canvasGradient,
                    canvasSolid,
                    headerStripUrl: stripForState,
                    splitBottomColor,
                    decorClass,
                    canvasTone,
                    bgSource: bgForState,
                    colorFillKind,
                    userSolidColor,
                    userGradA,
                    userGradB,
                    userGradAngle,
                    blocks: {
                        ...(isLockedPromo && fields.badge ? { badge: fields.badge } : {}),
                        title: fields.title,
                        subtitle: fields.subtitle,
                        message: fields.message,
                    },
                },
            },
        });
    };

    const onPickBackground = (e) => {
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;
        const next = URL.createObjectURL(file);
        if (userPhotoBgUrl && userPhotoBgUrl.startsWith('blob:')) {
            URL.revokeObjectURL(userPhotoBgUrl);
        }
        setUserPhotoBgUrl(next);
        setColorFillKind('template');
        const tpl = POST_TEMPLATES.find((t) => t.id === selectedTemplateId) || POST_TEMPLATES[0];
        applyTemplate(tpl, { userPhotoOverride: next });
        e.target.value = '';
    };

    const clearUserPhoto = () => {
        if (userPhotoBgUrl && userPhotoBgUrl.startsWith('blob:')) {
            URL.revokeObjectURL(userPhotoBgUrl);
        }
        setUserPhotoBgUrl(null);
        const tpl = POST_TEMPLATES.find((t) => t.id === selectedTemplateId) || POST_TEMPLATES[0];
        applyTemplate(tpl, { userPhotoOverride: null });
    };

    const setFillMode = (mode) => {
        setColorFillKind(mode);
        const tpl = POST_TEMPLATES.find((t) => t.id === selectedTemplateId) || POST_TEMPLATES[0];
        applyTemplate(tpl, { fillKind: mode });
    };

    const docEl = typeof document !== 'undefined' ? document.documentElement : null;
    const fallbackW = docEl ? Math.max(120, Math.floor(docEl.clientWidth - 16)) : 360;
    const effectiveW = layoutAvailW > 0 ? layoutAvailW : fallbackW;
    const horizontalPad = 16;
    const inner = Math.max(80, effectiveW - horizontalPad);
    const maxStagePx = Math.min(inner, 400);
    const viewportScale = maxStagePx / dims.w;
    const scaledCanvasW = Math.min(Math.floor(dims.w * viewportScale * 1000) / 1000, effectiveW - 8);
    const scaleUsed = scaledCanvasW / dims.w;
    const scaledCanvasH = Math.floor(dims.h * scaleUsed * 1000) / 1000;
    const lockDesignScale = isLockedPromo ? Math.min(dims.w, dims.h) / 500 : 1;
    /** HTML preview: scale must be unitless (CSS `scale(calc(cqw/…))` breaks LightningCSS / Vite build). */
    const htmlPreviewFrameShort = Math.min(440, Math.max(160, effectiveW - 40));
    const htmlLockedPreviewScale = isLockedPromo
        ? Math.min(1, (htmlPreviewFrameShort / 500) * 0.94)
        : 1;

    if (access === null) {
        return (
            <div className="feed-studio-page feed-studio-page--loading">
                <AppRouteLoading variant="route" fullViewport />
            </div>
        );
    }

    if (!access) {
        return (
            <div className="feed-studio-page feed-studio-page--denied">
                <button type="button" className="feed-studio-back" onClick={() => navigate(-1)}>
                    <FaArrowLeft aria-hidden />
                    <span>{t('back', 'Back')}</span>
                </button>
                <div className="feed-studio-denied-card">
                    <h1>{t('feed_studio_paywall_title', 'Premium feed studio')}</h1>
                    <p>
                        {t(
                            'feed_studio_paywall_body',
                            'This professional layout tool is available for business accounts on a paid plan (active subscription in Firebase).'
                        )}
                    </p>
                    <button type="button" className="feed-studio-primary" onClick={() => navigate('/settings/subscription')}>
                        {t('feed_studio_paywall_cta', 'View plans')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="feed-studio-page" ref={pageRef}>
            <header className="feed-studio-header">
                <button type="button" className="feed-studio-back" onClick={() => navigate(-1)}>
                    <FaArrowLeft aria-hidden />
                    <span>{t('back', 'Back')}</span>
                </button>
                <div className="feed-studio-header__mid">
                    <h1 className="feed-studio-title">{t('feed_studio_title', 'تنسيق منشور التغذية')}</h1>
                    <p className="feed-studio-sub">
                        {t('feed_studio_sub_html', 'تحرير النصوص ومعاينة HTML مع حركة بسيطة — دون تصدير صورة')}
                    </p>
                </div>
                <div className="feed-studio-header__actions">
                    <button type="button" className="feed-studio-btn feed-studio-btn--primary" onClick={handleContinueToComposer}>
                        <FaShare aria-hidden />
                        {t('feed_studio_continue_composer', 'متابعة للنشر')}
                    </button>
                </div>
            </header>

            <div className="feed-studio-body">
                <section className="feed-studio-canvas-column">
                    <div className="feed-studio-template-strip" role="region" aria-label={t('feed_studio_templates', 'اختر قالباً')}>
                        <div className="feed-studio-template-strip__label">{t('feed_studio_templates', 'اختر قالباً')}</div>
                        <div className="feed-studio-template-strip__scroll" role="listbox" aria-orientation="horizontal">
                            {POST_TEMPLATES.map((tpl) => (
                                <button
                                    key={tpl.id}
                                    type="button"
                                    role="option"
                                    aria-selected={selectedTemplateId === tpl.id}
                                    className={`feed-studio-template-card${selectedTemplateId === tpl.id ? ' is-selected' : ''}`}
                                    onClick={() => applyTemplate(tpl)}
                                >
                                    <span className="feed-studio-template-card__thumb">
                                        {tpl.thumb ? (
                                            <img
                                                src={tpl.thumb}
                                                alt=""
                                                loading="lazy"
                                                decoding="async"
                                                referrerPolicy="no-referrer"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        ) : null}
                                        {!tpl.thumb && tpl.thumbGradient ? (
                                            <span className="feed-studio-template-card__fill" style={{ background: tpl.thumbGradient }} />
                                        ) : null}
                                        {!tpl.thumb && !tpl.thumbGradient && tpl.thumbSolid ? (
                                            <span className="feed-studio-template-card__fill" style={{ background: tpl.thumbSolid }} />
                                        ) : null}
                                    </span>
                                    <span className="feed-studio-template-card__caption">{t(tpl.labelKey, tpl.labelDefault)}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="feed-studio-aspect-toggle" role="group" aria-label={t('feed_studio_aspect_group', 'Aspect ratio')}>
                        {Object.entries(ASPECTS).map(([key, meta]) => (
                            <button
                                key={key}
                                type="button"
                                className={aspectKey === key ? 'is-active' : ''}
                                onClick={() => setAspectKey(key)}
                            >
                                {t(meta.labelKey, meta.labelDefault)}
                            </button>
                        ))}
                    </div>

                    <div
                        className="feed-studio-viewport"
                        style={{
                            width: scaledCanvasW,
                            height: scaledCanvasH,
                            maxWidth: '100%',
                        }}
                    >
                        <div className="feed-studio-viewport__inner">
                            <div
                                className={`feed-studio-canvas feed-studio-canvas--tone-${canvasTone} feed-studio-canvas--layout-${canvasLayout}${
                                    isLockedPromo ? ' feed-studio-canvas--locked-promo' : ''
                                }`}
                                style={{
                                    width: dims.w,
                                    height: dims.h,
                                    transform: `scale(${scaleUsed})`,
                                }}
                            >
                            {isLockedPromo ? (
                                <>
                                    {canvasLayout === 'full' && canvasGradient ? (
                                        <div className="feed-studio-canvas__fill" style={{ background: canvasGradient }} aria-hidden />
                                    ) : null}
                                    {canvasLayout === 'full' && !canvasGradient && canvasSolid ? (
                                        <div className="feed-studio-canvas__fill" style={{ backgroundColor: canvasSolid }} aria-hidden />
                                    ) : null}
                                    {canvasLayout === 'full' && !canvasGradient && !canvasSolid && bgDisplay ? (
                                        <img
                                            className="feed-studio-canvas__bg"
                                            src={bgDisplay}
                                            alt=""
                                            crossOrigin={bgDisplay.startsWith('blob:') ? undefined : 'anonymous'}
                                        />
                                    ) : null}
                                    <div className="feed-lock-promo-stage">
                                        <div
                                            className="feed-lock-promo-scaler"
                                            style={{
                                                transform: `translate(-50%, -50%) scale(${lockDesignScale})`,
                                            }}
                                        >
                                            <div className="feed-lock-promo-post">
                                                <div className="feed-lock-promo-circle feed-lock-promo-circle--1" aria-hidden />
                                                <div className="feed-lock-promo-circle feed-lock-promo-circle--2" aria-hidden />

                                                <div className="feed-studio-field-wrap">
                                                    <textarea
                                                        className={`feed-lock-promo-badge feed-lock-promo-editable${
                                                            activeField === 'badge' ? ' is-active' : ''
                                                        }`}
                                                        rows={2}
                                                        value={fields.badge?.text ?? ''}
                                                        onChange={(e) =>
                                                            setFields((p) => ({
                                                                ...p,
                                                                badge: { ...p.badge, text: e.target.value },
                                                            }))
                                                        }
                                                        onFocus={() => setActiveField('badge')}
                                                        style={lockedFieldSurfaceStyle(fields.badge)}
                                                        aria-label={t('feed_studio_field_badge', 'شارة')}
                                                    />
                                                    {activeField === 'badge' && fields.badge ? (
                                                        <FieldToolbar
                                                            fieldKey="badge"
                                                            field={fields.badge}
                                                            min={14}
                                                            max={14}
                                                            boldOn={700}
                                                            boldOff={700}
                                                            popover={toolbarPopover}
                                                            setPopover={setToolbarPopover}
                                                            patchField={patchLockedTypography}
                                                            t={t}
                                                            fontColorOnly
                                                        />
                                                    ) : null}
                                                </div>

                                                <div className="feed-studio-field-wrap">
                                                    <textarea
                                                        className={`feed-lock-promo-title feed-lock-promo-editable${
                                                            activeField === 'title' ? ' is-active' : ''
                                                        }`}
                                                        rows={2}
                                                        value={fields.title.text}
                                                        onChange={(e) =>
                                                            setFields((p) => ({ ...p, title: { ...p.title, text: e.target.value } }))
                                                        }
                                                        onFocus={() => setActiveField('title')}
                                                        style={lockedFieldSurfaceStyle(fields.title)}
                                                        aria-label={t('feed_studio_field_title', 'Title')}
                                                    />
                                                    {activeField === 'title' ? (
                                                        <FieldToolbar
                                                            fieldKey="title"
                                                            field={fields.title}
                                                            min={50}
                                                            max={50}
                                                            boldOn={900}
                                                            boldOff={900}
                                                            popover={toolbarPopover}
                                                            setPopover={setToolbarPopover}
                                                            patchField={patchLockedTypography}
                                                            t={t}
                                                            fontColorOnly
                                                        />
                                                    ) : null}
                                                </div>

                                                <div className="feed-studio-field-wrap">
                                                    <textarea
                                                        className={`feed-lock-promo-subtitle feed-lock-promo-editable${
                                                            activeField === 'subtitle' ? ' is-active' : ''
                                                        }`}
                                                        rows={2}
                                                        value={fields.subtitle.text}
                                                        onChange={(e) =>
                                                            setFields((p) => ({
                                                                ...p,
                                                                subtitle: { ...p.subtitle, text: e.target.value },
                                                            }))
                                                        }
                                                        onFocus={() => setActiveField('subtitle')}
                                                        style={lockedFieldSurfaceStyle(fields.subtitle)}
                                                        aria-label={t('feed_studio_field_subtitle', 'Subtitle')}
                                                    />
                                                    {activeField === 'subtitle' ? (
                                                        <FieldToolbar
                                                            fieldKey="subtitle"
                                                            field={fields.subtitle}
                                                            min={20}
                                                            max={20}
                                                            boldOn={300}
                                                            boldOff={300}
                                                            popover={toolbarPopover}
                                                            setPopover={setToolbarPopover}
                                                            patchField={patchLockedTypography}
                                                            t={t}
                                                            fontColorOnly
                                                        />
                                                    ) : null}
                                                </div>

                                                <div className="feed-studio-field-wrap feed-studio-field-wrap--grow">
                                                    <div className="feed-lock-promo-messagebox">
                                                        <textarea
                                                            className={`feed-lock-promo-message feed-lock-promo-editable${
                                                                activeField === 'message' ? ' is-active' : ''
                                                            }`}
                                                            rows={5}
                                                            value={fields.message.text}
                                                            onChange={(e) =>
                                                                setFields((p) => ({
                                                                    ...p,
                                                                    message: { ...p.message, text: e.target.value },
                                                                }))
                                                            }
                                                            onFocus={() => setActiveField('message')}
                                                            style={lockedFieldSurfaceStyle(fields.message)}
                                                            aria-label={t('feed_studio_field_message', 'Message')}
                                                        />
                                                    </div>
                                                    {activeField === 'message' ? (
                                                        <FieldToolbar
                                                            fieldKey="message"
                                                            field={fields.message}
                                                            min={16}
                                                            max={16}
                                                            boldOn={400}
                                                            boldOff={400}
                                                            popover={toolbarPopover}
                                                            setPopover={setToolbarPopover}
                                                            patchField={patchLockedTypography}
                                                            t={t}
                                                            fontColorOnly
                                                        />
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                            {canvasLayout === 'full' ? (
                                <>
                                    {canvasGradient ? (
                                        <div className="feed-studio-canvas__fill" style={{ background: canvasGradient }} aria-hidden />
                                    ) : null}
                                    {canvasSolid && !canvasGradient ? (
                                        <div className="feed-studio-canvas__fill" style={{ backgroundColor: canvasSolid }} aria-hidden />
                                    ) : null}
                                    {!canvasGradient && !canvasSolid && bgDisplay ? (
                                        <img
                                            className="feed-studio-canvas__bg"
                                            src={bgDisplay}
                                            alt=""
                                            crossOrigin={bgDisplay.startsWith('blob:') ? undefined : 'anonymous'}
                                        />
                                    ) : null}
                                </>
                            ) : (
                                <>
                                    <div className="feed-studio-canvas__strip-zone" aria-hidden>
                                        {stripDisplay ? (
                                            <img
                                                className="feed-studio-canvas__strip-img"
                                                src={stripDisplay}
                                                alt=""
                                                crossOrigin={stripDisplay.startsWith('blob:') ? undefined : 'anonymous'}
                                            />
                                        ) : null}
                                    </div>
                                    <div
                                        className="feed-studio-canvas__split-fill"
                                        style={{ backgroundColor: splitBottomColor || '#ffffff' }}
                                        aria-hidden
                                    />
                                </>
                            )}

                            {decorClass === 'pastel-blob' ? (
                                <div className="feed-studio-canvas__decor feed-studio-canvas__decor--pastel-blob" aria-hidden />
                            ) : null}
                            {decorClass === 'gold-accent' ? (
                                <div className="feed-studio-canvas__decor feed-studio-canvas__decor--gold-accent" aria-hidden />
                            ) : null}

                            <div
                                className={`feed-studio-canvas__vignette${canvasTone === 'light' ? ' feed-studio-canvas__vignette--light' : ''}`}
                                aria-hidden
                            />

                            <div className="feed-studio-canvas__stack">
                                <div className="feed-studio-field-wrap">
                                    <textarea
                                        className={`feed-studio-field feed-studio-field--title feed-studio-field--${canvasTone}${
                                            activeField === 'title' ? ' is-active' : ''
                                        }`}
                                        rows={2}
                                        value={fields.title.text}
                                        onChange={(e) =>
                                            setFields((p) => ({ ...p, title: { ...p.title, text: e.target.value } }))
                                        }
                                        onFocus={() => setActiveField('title')}
                                        style={{
                                            fontFamily: FONT_PRESETS.find((f) => f.id === fields.title.fontId)?.family,
                                            fontSize: fields.title.fontSize,
                                            fontWeight: fields.title.fontWeight,
                                            fontStyle: fields.title.fontStyle,
                                            color: fields.title.color,
                                            opacity: fields.title.opacity,
                                            textShadow: fields.title.textShadow,
                                        }}
                                        aria-label={t('feed_studio_field_title', 'Title')}
                                    />
                                    {activeField === 'title' && (
                                        <FieldToolbar
                                            fieldKey="title"
                                            field={fields.title}
                                            min={18}
                                            max={96}
                                            boldOn={800}
                                            boldOff={400}
                                            popover={toolbarPopover}
                                            setPopover={setToolbarPopover}
                                            patchField={patchField}
                                            t={t}
                                        />
                                    )}
                                </div>

                                <div className="feed-studio-field-wrap">
                                    <textarea
                                        className={`feed-studio-field feed-studio-field--subtitle feed-studio-field--${canvasTone}${
                                            activeField === 'subtitle' ? ' is-active' : ''
                                        }`}
                                        rows={2}
                                        value={fields.subtitle.text}
                                        onChange={(e) =>
                                            setFields((p) => ({ ...p, subtitle: { ...p.subtitle, text: e.target.value } }))
                                        }
                                        onFocus={() => setActiveField('subtitle')}
                                        style={{
                                            fontFamily: FONT_PRESETS.find((f) => f.id === fields.subtitle.fontId)?.family,
                                            fontSize: fields.subtitle.fontSize,
                                            fontWeight: fields.subtitle.fontWeight,
                                            fontStyle: fields.subtitle.fontStyle,
                                            color: fields.subtitle.color,
                                            opacity: fields.subtitle.opacity,
                                            textShadow: fields.subtitle.textShadow,
                                        }}
                                        aria-label={t('feed_studio_field_subtitle', 'Subtitle')}
                                    />
                                    {activeField === 'subtitle' && (
                                        <FieldToolbar
                                            fieldKey="subtitle"
                                            field={fields.subtitle}
                                            min={14}
                                            max={72}
                                            boldOn={700}
                                            boldOff={400}
                                            popover={toolbarPopover}
                                            setPopover={setToolbarPopover}
                                            patchField={patchField}
                                            t={t}
                                        />
                                    )}
                                </div>

                                <div className="feed-studio-field-wrap feed-studio-field-wrap--grow">
                                    <textarea
                                        className={`feed-studio-field feed-studio-field--message feed-studio-field--${canvasTone}${
                                            activeField === 'message' ? ' is-active' : ''
                                        }`}
                                        rows={6}
                                        value={fields.message.text}
                                        onChange={(e) =>
                                            setFields((p) => ({ ...p, message: { ...p.message, text: e.target.value } }))
                                        }
                                        onFocus={() => setActiveField('message')}
                                        style={{
                                            fontFamily: FONT_PRESETS.find((f) => f.id === fields.message.fontId)?.family,
                                            fontSize: fields.message.fontSize,
                                            fontWeight: fields.message.fontWeight,
                                            fontStyle: fields.message.fontStyle,
                                            color: fields.message.color,
                                            opacity: fields.message.opacity,
                                            textShadow: fields.message.textShadow,
                                        }}
                                        aria-label={t('feed_studio_field_message', 'Message')}
                                    />
                                    {activeField === 'message' && (
                                        <FieldToolbar
                                            fieldKey="message"
                                            field={fields.message}
                                            min={14}
                                            max={56}
                                            boldOn={700}
                                            boldOff={400}
                                            popover={toolbarPopover}
                                            setPopover={setToolbarPopover}
                                            patchField={patchField}
                                            t={t}
                                        />
                                    )}
                                </div>
                            </div>
                                </>
                            )}
                            </div>
                        </div>
                    </div>

                    <div className="feed-studio-bg-row">
                        <input ref={fileBgRef} type="file" accept="image/*" className="sr-only" onChange={onPickBackground} />
                        <button type="button" className="feed-studio-btn feed-studio-btn--ghost" onClick={() => fileBgRef.current?.click()}>
                            <FaImage aria-hidden />
                            {t('feed_studio_change_bg', 'Change background')}
                        </button>
                        {userPhotoBgUrl ? (
                            <button type="button" className="feed-studio-btn feed-studio-btn--ghost" onClick={clearUserPhoto}>
                                {t('feed_studio_clear_my_photo', 'إزالة صورتي')}
                            </button>
                        ) : null}
                        <button
                            type="button"
                            className="feed-studio-btn feed-studio-btn--ghost"
                            onClick={() => {
                                if (userPhotoBgUrl && userPhotoBgUrl.startsWith('blob:')) {
                                    URL.revokeObjectURL(userPhotoBgUrl);
                                }
                                setUserPhotoBgUrl(null);
                                setColorFillKind('template');
                                applyTemplate(POST_TEMPLATES[0], { userPhotoOverride: null });
                            }}
                        >
                            {t('feed_studio_reset_bg', 'Reset sample')}
                        </button>
                    </div>

                    <section className="feed-studio-html-preview" aria-label={t('feed_studio_html_preview', 'معاينة HTML')}>
                        <h3 className="feed-studio-html-preview__label">{t('feed_studio_html_preview', 'معاينة HTML')}</h3>
                        <div className={`feed-studio-html-preview__frame feed-studio-html-preview__frame--${aspectKey}`}>
                            <div
                                key={previewAnimEpoch}
                                className={`feed-studio-html-preview__stage feed-studio-html-preview__stage--tone-${canvasTone} feed-studio-html-preview__stage--layout-${canvasLayout}${
                                    isLockedPromo ? ' feed-studio-html-preview__stage--locked-promo' : ''
                                }`}
                                style={buildHtmlPreviewStageStyle({
                                    canvasLayout,
                                    canvasGradient,
                                    canvasSolid,
                                    bgDisplay,
                                    stripDisplay,
                                    splitBottomColor,
                                })}
                            >
                                {isLockedPromo && fields.badge ? (
                                    <div className="feed-lock-promo-html-root">
                                        <div
                                            className="feed-lock-promo-scaler"
                                            style={{
                                                transform: `translate(-50%, -50%) scale(${htmlLockedPreviewScale})`,
                                            }}
                                        >
                                            <div className="feed-lock-promo-post">
                                                <div className="feed-lock-promo-circle feed-lock-promo-circle--1" aria-hidden />
                                                <div className="feed-lock-promo-circle feed-lock-promo-circle--2" aria-hidden />
                                                <div className="feed-lock-promo-badge" style={lockedFieldSurfaceStyle(fields.badge)}>
                                                    {fields.badge.text}
                                                </div>
                                                <p className="feed-lock-promo-title" style={lockedFieldSurfaceStyle(fields.title)}>
                                                    {fields.title.text}
                                                </p>
                                                <p className="feed-lock-promo-subtitle" style={lockedFieldSurfaceStyle(fields.subtitle)}>
                                                    {fields.subtitle.text}
                                                </p>
                                                <div className="feed-lock-promo-messagebox">
                                                    <p className="feed-lock-promo-message" style={lockedFieldSurfaceStyle(fields.message)}>
                                                        {fields.message.text}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                {decorClass === 'pastel-blob' ? (
                                    <div className="feed-studio-html-preview__decor feed-studio-html-preview__decor--pastel-blob" aria-hidden />
                                ) : null}
                                {decorClass === 'gold-accent' ? (
                                    <div className="feed-studio-html-preview__decor feed-studio-html-preview__decor--gold-accent" aria-hidden />
                                ) : null}
                                <div
                                    className={`feed-studio-html-preview__scrim${canvasTone === 'light' ? ' feed-studio-html-preview__scrim--light' : ''}`}
                                    aria-hidden
                                />
                                <p className="feed-studio-html-line feed-studio-html-line--title" style={fieldPreviewStyle(fields.title, 2)}>
                                    {fields.title.text}
                                </p>
                                <p
                                    className="feed-studio-html-line feed-studio-html-line--subtitle"
                                    style={fieldPreviewStyle(fields.subtitle, 2.25)}
                                >
                                    {fields.subtitle.text}
                                </p>
                                <p
                                    className="feed-studio-html-line feed-studio-html-line--message"
                                    style={fieldPreviewStyle(fields.message, 2.45)}
                                >
                                    {fields.message.text}
                                </p>
                                    </>
                                )}
                            </div>
                        </div>
                    </section>
                </section>

                <aside className="feed-studio-props">
                    <h2 className="feed-studio-props__title">{t('feed_studio_props_title', 'Text properties')}</h2>
                    <p className="feed-studio-props__hint">
                        {t('feed_studio_props_active', 'Editing')}:{' '}
                        <strong>
                            {activeField === 'badge'
                                ? t('feed_studio_field_badge', 'شارة')
                                : t(`feed_studio_field_${activeField}`, activeField)}
                        </strong>
                    </p>
                    {isLockedPromo ? (
                        <p className="feed-studio-props__hint">
                            {t(
                                'feed_studio_locked_promo_hint',
                                'هذا القالب ثابت الشكل: يمكن تغيير الخط وألوان النص والخلفية فقط، دون تغيير المقاسات أو التنسيق.'
                            )}
                        </p>
                    ) : null}

                    <div className="feed-studio-props__block">
                        <span className="feed-studio-label">{t('feed_studio_fill_mode', 'تعبئة الخلفية')}</span>
                        <div className="feed-studio-style-row">
                            <button
                                type="button"
                                className={colorFillKind === 'template' ? 'is-active' : ''}
                                onClick={() => setFillMode('template')}
                                disabled={Boolean(userPhotoBgUrl)}
                            >
                                {t('feed_studio_fill_template', 'حسب القالب')}
                            </button>
                            <button
                                type="button"
                                className={colorFillKind === 'solid' ? 'is-active' : ''}
                                onClick={() => setFillMode('solid')}
                                disabled={Boolean(userPhotoBgUrl)}
                            >
                                {t('feed_studio_fill_solid', 'لون مسطح')}
                            </button>
                            <button
                                type="button"
                                className={colorFillKind === 'gradient' ? 'is-active' : ''}
                                onClick={() => setFillMode('gradient')}
                                disabled={Boolean(userPhotoBgUrl)}
                            >
                                {t('feed_studio_fill_gradient', 'تدرج')}
                            </button>
                        </div>
                        {userPhotoBgUrl ? (
                            <p className="feed-studio-props__hint">
                                {t(
                                    'feed_studio_photo_overrides_fill',
                                    'الصورة المرفوعة تظهر في كل القالب (خلفية كاملة أو الشريط العلوي). أزل الصورة لتعديل اللون أو التدرج.'
                                )}
                            </p>
                        ) : null}
                        {!userPhotoBgUrl && colorFillKind === 'solid' ? (
                            <div className="feed-studio-fill-picker">
                                <HexColorPicker color={userSolidColor} onChange={setUserSolidColor} />
                            </div>
                        ) : null}
                        {!userPhotoBgUrl && colorFillKind === 'gradient' ? (
                            <div className="feed-studio-fill-gradient">
                                <span className="feed-studio-label">{t('feed_studio_grad_color_a', 'لون البداية')}</span>
                                <div className="feed-studio-fill-picker feed-studio-fill-picker--sm">
                                    <HexColorPicker color={userGradA} onChange={setUserGradA} />
                                </div>
                                <span className="feed-studio-label">{t('feed_studio_grad_color_b', 'لون النهاية')}</span>
                                <div className="feed-studio-fill-picker feed-studio-fill-picker--sm">
                                    <HexColorPicker color={userGradB} onChange={setUserGradB} />
                                </div>
                                <span className="feed-studio-label">
                                    {t('feed_studio_grad_angle', 'زاوية التدرج')}: {userGradAngle}°
                                </span>
                                <input
                                    type="range"
                                    min={0}
                                    max={360}
                                    value={userGradAngle}
                                    onChange={(e) => setUserGradAngle(Number(e.target.value))}
                                    className="feed-studio-range"
                                />
                            </div>
                        ) : null}
                    </div>

                    {!isLockedPromo ? (
                    <div className="feed-studio-props__block">
                        <span className="feed-studio-label">{t('feed_studio_style', 'Style')}</span>
                        <div className="feed-studio-style-row">
                            {STYLE_PRESETS.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    className={stylePreset === s.id ? 'is-active' : ''}
                                    onClick={() => applyStylePreset(s.id)}
                                >
                                    {t(s.labelKey, s.labelDefault)}
                                </button>
                            ))}
                        </div>
                    </div>
                    ) : null}

                    <div className="feed-studio-props__block">
                        <span className="feed-studio-label">
                            {t('feed_studio_opacity', 'Text opacity')}: {Math.round(active.opacity * 100)}%
                        </span>
                        <input
                            type="range"
                            min={0.2}
                            max={1}
                            step={0.05}
                            value={active.opacity}
                            onChange={(e) => patchActive({ opacity: Number(e.target.value) })}
                            className="feed-studio-range"
                        />
                    </div>
                </aside>
            </div>

        </div>
    );
}
