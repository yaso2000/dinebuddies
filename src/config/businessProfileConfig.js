/**
 * Single source of truth for the business profile across ALL business types.
 * One shared profile drives Restaurant / Cafe / Bar / Night Club / Hotel — there
 * are no per-type screens. Adding a sixth type = adding one entry here.
 *
 * The public profile has exactly three tabs (menu, services, events); an empty
 * tab is never shown. `defaultTab` decides which opens first (falling back to the
 * first non-empty tab when it is empty). See the business-profile redesign spec.
 */

/** The three tabs, in display order. */
export const BUSINESS_TABS = ['menu', 'services', 'events'];

/** Arabic tab labels (kept here so a new type never needs a new screen). */
export const BUSINESS_TAB_LABELS_AR = {
  menu: 'المنيو',
  services: 'الخدمات',
  events: 'المناسبات',
};

/** English tab labels. */
export const BUSINESS_TAB_LABELS_EN = {
  menu: 'Menu',
  services: 'Services',
  events: 'Events',
};

/**
 * Per-type configuration. `defaultTab` is the tab opened first; `menuLabel` lets a
 * type rename its "menu" tab (e.g. a Bar's drink list) without a new screen.
 * `requiredItemFields` documents what the item form enforces per item kind.
 * @type {Record<string, { defaultTab: 'menu'|'services'|'events', menuLabelAr?: string, menuLabelEn?: string }>}
 */
export const BUSINESS_TYPES = {
  Restaurant: { defaultTab: 'menu' },
  Cafe: { defaultTab: 'menu' },
  Bar: { defaultTab: 'menu', menuLabelAr: 'المشروبات', menuLabelEn: 'Drinks' },
  'Night Club': { defaultTab: 'events' },
  Hotel: { defaultTab: 'services' },
};

/** The five supported types, in the tie-break priority used by Google import. */
export const BUSINESS_TYPE_PRIORITY = ['Night Club', 'Bar', 'Hotel', 'Cafe', 'Restaurant'];

export const DEFAULT_BUSINESS_TYPE = 'Restaurant';

/** Menu/services items share one shape; `kind` distinguishes them. */
export const ITEM_KINDS = ['dish', 'service'];
export const DEFAULT_ITEM_KIND = 'dish';

/** Normalize any stored/free value to one of the five known types. */
export function normalizeBusinessType(value) {
  const v = String(value || '').trim();
  if (BUSINESS_TYPES[v]) return v;
  // Case-insensitive / spacing tolerance (e.g. "night club", "nightclub").
  const lower = v.toLowerCase().replace(/[\s_-]+/g, '');
  const found = Object.keys(BUSINESS_TYPES).find(
    (k) => k.toLowerCase().replace(/[\s_-]+/g, '') === lower
  );
  return found || DEFAULT_BUSINESS_TYPE;
}

/** @returns {{ defaultTab: string, menuLabelAr?: string, menuLabelEn?: string }} */
export function getBusinessTypeConfig(type) {
  return BUSINESS_TYPES[normalizeBusinessType(type)] || BUSINESS_TYPES[DEFAULT_BUSINESS_TYPE];
}

/** Localized label for a tab; the `menu` tab can be renamed per type. */
export function tabLabel(tab, type, isArabic) {
  const cfg = getBusinessTypeConfig(type);
  if (tab === 'menu') {
    if (isArabic && cfg.menuLabelAr) return cfg.menuLabelAr;
    if (!isArabic && cfg.menuLabelEn) return cfg.menuLabelEn;
  }
  return (isArabic ? BUSINESS_TAB_LABELS_AR : BUSINESS_TAB_LABELS_EN)[tab] || tab;
}

/**
 * Resolve which tab to open first: the type's default when it has content, else
 * the first non-empty tab in display order, else null (no tabs at all).
 * @param {string} type
 * @param {{ menu?: boolean, services?: boolean, events?: boolean }} nonEmpty  which tabs have content
 * @returns {'menu'|'services'|'events'|null}
 */
export function resolveInitialTab(type, nonEmpty = {}) {
  const has = (t) => Boolean(nonEmpty[t]);
  const preferred = getBusinessTypeConfig(type).defaultTab;
  if (has(preferred)) return preferred;
  return BUSINESS_TABS.find(has) || null;
}

/** The tabs (in order) that currently have content — what the tab bar renders. */
export function visibleTabs(nonEmpty = {}) {
  return BUSINESS_TABS.filter((t) => Boolean(nonEmpty[t]));
}

// ── Owner-curated sections ──────────────────────────────────────────────────
// The owner chooses which sections appear (via + / ×). Removing a section only
// hides it — its content is never deleted, so re-adding restores everything.

/** The three list tabs. */
export const TAB_SECTIONS = BUSINESS_TABS; // ['menu','services','events']

/** Every section is a side-by-side tab, in this display order. */
export const PROFILE_SECTIONS = ['about', 'menu', 'services', 'events', 'hours', 'contact', 'delivery'];

export const SECTION_LABELS_AR = {
  about: 'النبذة', hours: 'الدوام', contact: 'التواصل', delivery: 'التوصيل',
  menu: 'المنيو', services: 'الخدمات', events: 'المناسبات',
};
export const SECTION_LABELS_EN = {
  about: 'About', hours: 'Hours', contact: 'Contact', delivery: 'Delivery',
  menu: 'Menu', services: 'Services', events: 'Events',
};

export function sectionLabel(id, type, isArabic) {
  if (TAB_SECTIONS.includes(id)) return tabLabel(id, type, isArabic);
  return (isArabic ? SECTION_LABELS_AR : SECTION_LABELS_EN)[id] || id;
}

/** Default enabled sections for a type when the owner hasn't curated yet. */
export function defaultSectionsForType(type) {
  const t = normalizeBusinessType(type);
  const base = ['about', 'hours', 'contact'];
  if (t === 'Night Club') return [...base, 'events'];
  if (t === 'Hotel') return [...base, 'services'];
  return [...base, 'delivery', 'menu']; // Restaurant / Cafe / Bar
}

/**
 * The owner's enabled sections, in order. Falls back to the type default when
 * `businessInfo.sections` was never set (existing/imported businesses).
 */
export function resolveEnabledSections(businessInfo = {}) {
  const arr = businessInfo?.sections;
  if (Array.isArray(arr)) {
    const clean = arr.filter((s) => PROFILE_SECTIONS.includes(s));
    if (clean.length) return clean;
  }
  return defaultSectionsForType(businessInfo?.businessType);
}
