export const CHAT_THEME_STORAGE_KEY = 'dinebuddies.chatTheme';
export const DEFAULT_CHAT_THEME_ID = 'default';

export const CHAT_THEME_IDS = [
  'default',
  'midnight',
  'ocean',
  'forest',
  'sunset',
  'lavender',
  'rose-gold',
  'aurora',
  'ember',
  'mono',
];

export const CHAT_THEMES = {
  default: {
    id: 'default',
    labelKey: 'chat_theme_default',
    labelDefault: 'Default',
    labelAr: 'الافتراضي',
    swatch: 'linear-gradient(135deg, #ff4f97 0%, #ff7c58 58%, #ffb14e 100%)',
    tokens: {
      'chat-ref-shell-bg':
        'radial-gradient(circle at top left, rgba(255, 79, 150, 0.18), transparent 24%), radial-gradient(circle at top right, rgba(255, 141, 69, 0.16), transparent 28%), linear-gradient(180deg, #0a1120 0%, #0d1728 52%, #101c31 100%)',
      'chat-ref-card': 'rgba(255, 255, 255, 0.95)',
      'chat-ref-card-strong': 'rgba(255, 255, 255, 0.985)',
      'chat-ref-card-border': 'rgba(255, 255, 255, 0.62)',
      'chat-ref-title': '#172033',
      'chat-ref-text': '#253041',
      'chat-ref-muted': '#6b7280',
      'chat-ref-muted-soft': 'rgba(107, 114, 128, 0.78)',
      'chat-ref-outgoing-bg': 'linear-gradient(135deg, #ff4f97 0%, #ff7c58 58%, #ffb14e 100%)',
      'chat-ref-outgoing-shadow': '0 14px 26px rgba(255, 95, 125, 0.3)',
      'chat-ref-card-shadow': '0 12px 28px rgba(15, 23, 42, 0.18)',
      'chat-ref-overlay': 'rgba(7, 12, 23, 0.74)',
    },
  },
  midnight: {
    id: 'midnight',
    labelKey: 'chat_theme_midnight',
    labelDefault: 'Midnight',
    labelAr: 'منتصف الليل',
    swatch: 'linear-gradient(135deg, #1d4ed8 0%, #4338ca 50%, #0f172a 100%)',
    tokens: {
      'chat-ref-shell-bg':
        'radial-gradient(circle at top left, rgba(96, 165, 250, 0.2), transparent 22%), radial-gradient(circle at bottom right, rgba(99, 102, 241, 0.2), transparent 24%), linear-gradient(180deg, #050816 0%, #0a1022 48%, #101935 100%)',
      'chat-ref-card': 'rgba(234, 242, 255, 0.94)',
      'chat-ref-card-strong': 'rgba(245, 248, 255, 0.985)',
      'chat-ref-card-border': 'rgba(191, 219, 254, 0.7)',
      'chat-ref-title': '#10203d',
      'chat-ref-text': '#1d3557',
      'chat-ref-muted': '#5f7394',
      'chat-ref-muted-soft': 'rgba(95, 115, 148, 0.84)',
      'chat-ref-outgoing-bg': 'linear-gradient(135deg, #2563eb 0%, #4338ca 56%, #312e81 100%)',
      'chat-ref-outgoing-shadow': '0 16px 30px rgba(37, 99, 235, 0.32)',
      'chat-ref-card-shadow': '0 12px 28px rgba(9, 18, 38, 0.24)',
      'chat-ref-overlay': 'rgba(6, 12, 28, 0.76)',
    },
  },
  ocean: {
    id: 'ocean',
    labelKey: 'chat_theme_ocean',
    labelDefault: 'Ocean',
    labelAr: 'المحيط',
    swatch: 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)',
    tokens: {
      'chat-ref-shell-bg':
        'radial-gradient(circle at top left, rgba(34, 211, 238, 0.18), transparent 24%), radial-gradient(circle at top right, rgba(59, 130, 246, 0.16), transparent 28%), linear-gradient(180deg, #04111a 0%, #082032 52%, #0a2d45 100%)',
      'chat-ref-card': 'rgba(241, 251, 255, 0.95)',
      'chat-ref-card-strong': 'rgba(248, 253, 255, 0.985)',
      'chat-ref-card-border': 'rgba(186, 230, 253, 0.74)',
      'chat-ref-title': '#0e2a3f',
      'chat-ref-text': '#17435f',
      'chat-ref-muted': '#5c7f96',
      'chat-ref-muted-soft': 'rgba(92, 127, 150, 0.8)',
      'chat-ref-outgoing-bg': 'linear-gradient(135deg, #06b6d4 0%, #0891b2 34%, #2563eb 100%)',
      'chat-ref-outgoing-shadow': '0 16px 30px rgba(8, 145, 178, 0.28)',
      'chat-ref-card-shadow': '0 12px 28px rgba(7, 39, 61, 0.18)',
      'chat-ref-overlay': 'rgba(5, 21, 32, 0.72)',
    },
  },
  forest: {
    id: 'forest',
    labelKey: 'chat_theme_forest',
    labelDefault: 'Forest',
    labelAr: 'الغابة',
    swatch: 'linear-gradient(135deg, #22c55e 0%, #0f766e 100%)',
    tokens: {
      'chat-ref-shell-bg':
        'radial-gradient(circle at top left, rgba(74, 222, 128, 0.18), transparent 22%), radial-gradient(circle at top right, rgba(20, 184, 166, 0.14), transparent 30%), linear-gradient(180deg, #07160d 0%, #0d2619 48%, #143825 100%)',
      'chat-ref-card': 'rgba(244, 252, 247, 0.95)',
      'chat-ref-card-strong': 'rgba(251, 255, 252, 0.985)',
      'chat-ref-card-border': 'rgba(187, 247, 208, 0.72)',
      'chat-ref-title': '#163124',
      'chat-ref-text': '#254536',
      'chat-ref-muted': '#5f7f70',
      'chat-ref-muted-soft': 'rgba(95, 127, 112, 0.82)',
      'chat-ref-outgoing-bg': 'linear-gradient(135deg, #22c55e 0%, #16a34a 38%, #0f766e 100%)',
      'chat-ref-outgoing-shadow': '0 16px 30px rgba(22, 163, 74, 0.28)',
      'chat-ref-card-shadow': '0 12px 28px rgba(12, 34, 23, 0.18)',
      'chat-ref-overlay': 'rgba(8, 23, 15, 0.72)',
    },
  },
  sunset: {
    id: 'sunset',
    labelKey: 'chat_theme_sunset',
    labelDefault: 'Sunset',
    labelAr: 'الغروب',
    swatch: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
    tokens: {
      'chat-ref-shell-bg':
        'radial-gradient(circle at top left, rgba(251, 146, 60, 0.18), transparent 22%), radial-gradient(circle at top right, rgba(244, 114, 182, 0.18), transparent 26%), linear-gradient(180deg, #1b0b14 0%, #28111e 48%, #3b1621 100%)',
      'chat-ref-card': 'rgba(255, 247, 242, 0.95)',
      'chat-ref-card-strong': 'rgba(255, 252, 249, 0.988)',
      'chat-ref-card-border': 'rgba(254, 215, 170, 0.7)',
      'chat-ref-title': '#4a2118',
      'chat-ref-text': '#5f2f22',
      'chat-ref-muted': '#8d6557',
      'chat-ref-muted-soft': 'rgba(141, 101, 87, 0.82)',
      'chat-ref-outgoing-bg': 'linear-gradient(135deg, #f97316 0%, #fb7185 52%, #ec4899 100%)',
      'chat-ref-outgoing-shadow': '0 16px 30px rgba(236, 72, 153, 0.26)',
      'chat-ref-card-shadow': '0 12px 28px rgba(59, 22, 33, 0.18)',
      'chat-ref-overlay': 'rgba(28, 11, 19, 0.72)',
    },
  },
  lavender: {
    id: 'lavender',
    labelKey: 'chat_theme_lavender',
    labelDefault: 'Lavender',
    labelAr: 'لافندر',
    swatch: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
    tokens: {
      'chat-ref-shell-bg':
        'radial-gradient(circle at top left, rgba(196, 181, 253, 0.18), transparent 24%), radial-gradient(circle at top right, rgba(244, 114, 182, 0.14), transparent 28%), linear-gradient(180deg, #120b20 0%, #1a1230 52%, #24183f 100%)',
      'chat-ref-card': 'rgba(250, 246, 255, 0.95)',
      'chat-ref-card-strong': 'rgba(254, 251, 255, 0.988)',
      'chat-ref-card-border': 'rgba(221, 214, 254, 0.72)',
      'chat-ref-title': '#30204a',
      'chat-ref-text': '#433164',
      'chat-ref-muted': '#7b6a9c',
      'chat-ref-muted-soft': 'rgba(123, 106, 156, 0.82)',
      'chat-ref-outgoing-bg': 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 42%, #ec4899 100%)',
      'chat-ref-outgoing-shadow': '0 16px 30px rgba(139, 92, 246, 0.28)',
      'chat-ref-card-shadow': '0 12px 28px rgba(28, 18, 52, 0.18)',
      'chat-ref-overlay': 'rgba(18, 11, 32, 0.72)',
    },
  },
  'rose-gold': {
    id: 'rose-gold',
    labelKey: 'chat_theme_rose_gold',
    labelDefault: 'Rose Gold',
    labelAr: 'روز غولد',
    swatch: 'linear-gradient(135deg, #fb7185 0%, #f59e0b 100%)',
    tokens: {
      'chat-ref-shell-bg':
        'radial-gradient(circle at top left, rgba(251, 113, 133, 0.16), transparent 22%), radial-gradient(circle at top right, rgba(251, 191, 36, 0.15), transparent 30%), linear-gradient(180deg, #1a1213 0%, #2a1b1c 48%, #352321 100%)',
      'chat-ref-card': 'rgba(255, 250, 247, 0.95)',
      'chat-ref-card-strong': 'rgba(255, 253, 251, 0.988)',
      'chat-ref-card-border': 'rgba(253, 186, 116, 0.7)',
      'chat-ref-title': '#4c2c2f',
      'chat-ref-text': '#664146',
      'chat-ref-muted': '#8d6c67',
      'chat-ref-muted-soft': 'rgba(141, 108, 103, 0.82)',
      'chat-ref-outgoing-bg': 'linear-gradient(135deg, #fb7185 0%, #f97316 48%, #fbbf24 100%)',
      'chat-ref-outgoing-shadow': '0 16px 30px rgba(249, 115, 22, 0.24)',
      'chat-ref-card-shadow': '0 12px 28px rgba(53, 35, 33, 0.16)',
      'chat-ref-overlay': 'rgba(26, 18, 19, 0.72)',
    },
  },
  aurora: {
    id: 'aurora',
    labelKey: 'chat_theme_aurora',
    labelDefault: 'Aurora',
    labelAr: 'أورورا',
    swatch: 'linear-gradient(135deg, #10b981 0%, #3b82f6 50%, #8b5cf6 100%)',
    tokens: {
      'chat-ref-shell-bg':
        'radial-gradient(circle at top left, rgba(16, 185, 129, 0.16), transparent 22%), radial-gradient(circle at top center, rgba(59, 130, 246, 0.16), transparent 24%), radial-gradient(circle at top right, rgba(139, 92, 246, 0.14), transparent 28%), linear-gradient(180deg, #07121b 0%, #0b1b2a 48%, #14243a 100%)',
      'chat-ref-card': 'rgba(244, 252, 255, 0.95)',
      'chat-ref-card-strong': 'rgba(250, 254, 255, 0.988)',
      'chat-ref-card-border': 'rgba(191, 219, 254, 0.66)',
      'chat-ref-title': '#173146',
      'chat-ref-text': '#234b65',
      'chat-ref-muted': '#61809b',
      'chat-ref-muted-soft': 'rgba(97, 128, 155, 0.82)',
      'chat-ref-outgoing-bg': 'linear-gradient(135deg, #10b981 0%, #3b82f6 52%, #8b5cf6 100%)',
      'chat-ref-outgoing-shadow': '0 16px 30px rgba(59, 130, 246, 0.28)',
      'chat-ref-card-shadow': '0 12px 28px rgba(12, 32, 48, 0.18)',
      'chat-ref-overlay': 'rgba(7, 18, 27, 0.72)',
    },
  },
  ember: {
    id: 'ember',
    labelKey: 'chat_theme_ember',
    labelDefault: 'Ember',
    labelAr: 'جمرة',
    swatch: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)',
    tokens: {
      'chat-ref-shell-bg':
        'radial-gradient(circle at top left, rgba(248, 113, 113, 0.17), transparent 22%), radial-gradient(circle at bottom right, rgba(245, 158, 11, 0.14), transparent 24%), linear-gradient(180deg, #170b0b 0%, #240f0f 48%, #341713 100%)',
      'chat-ref-card': 'rgba(255, 247, 243, 0.95)',
      'chat-ref-card-strong': 'rgba(255, 251, 248, 0.988)',
      'chat-ref-card-border': 'rgba(254, 202, 202, 0.7)',
      'chat-ref-title': '#4c2118',
      'chat-ref-text': '#653023',
      'chat-ref-muted': '#8f6a5f',
      'chat-ref-muted-soft': 'rgba(143, 106, 95, 0.82)',
      'chat-ref-outgoing-bg': 'linear-gradient(135deg, #ef4444 0%, #f97316 48%, #f59e0b 100%)',
      'chat-ref-outgoing-shadow': '0 16px 30px rgba(239, 68, 68, 0.24)',
      'chat-ref-card-shadow': '0 12px 28px rgba(48, 19, 17, 0.18)',
      'chat-ref-overlay': 'rgba(23, 11, 11, 0.72)',
    },
  },
  mono: {
    id: 'mono',
    labelKey: 'chat_theme_mono',
    labelDefault: 'Mono',
    labelAr: 'أحادي',
    swatch: 'linear-gradient(135deg, #64748b 0%, #0f172a 100%)',
    tokens: {
      'chat-ref-shell-bg':
        'radial-gradient(circle at top left, rgba(148, 163, 184, 0.12), transparent 24%), radial-gradient(circle at top right, rgba(71, 85, 105, 0.14), transparent 30%), linear-gradient(180deg, #05070b 0%, #0e141d 48%, #161f2b 100%)',
      'chat-ref-card': 'rgba(248, 250, 252, 0.95)',
      'chat-ref-card-strong': 'rgba(255, 255, 255, 0.988)',
      'chat-ref-card-border': 'rgba(203, 213, 225, 0.72)',
      'chat-ref-title': '#111827',
      'chat-ref-text': '#334155',
      'chat-ref-muted': '#64748b',
      'chat-ref-muted-soft': 'rgba(100, 116, 139, 0.82)',
      'chat-ref-outgoing-bg': 'linear-gradient(135deg, #475569 0%, #334155 48%, #0f172a 100%)',
      'chat-ref-outgoing-shadow': '0 16px 30px rgba(15, 23, 42, 0.28)',
      'chat-ref-card-shadow': '0 12px 28px rgba(15, 23, 42, 0.16)',
      'chat-ref-overlay': 'rgba(7, 12, 23, 0.76)',
    },
  },
};

export function normalizeChatThemeId(value) {
  const id = String(value || '').trim().toLowerCase();
  return CHAT_THEME_IDS.includes(id) ? id : DEFAULT_CHAT_THEME_ID;
}

export function buildChatThemeInlineStyle(themeId) {
  const resolvedId = normalizeChatThemeId(themeId);
  const theme = CHAT_THEMES[resolvedId] || CHAT_THEMES[DEFAULT_CHAT_THEME_ID];
  const style = {};

  Object.entries(theme.tokens || {}).forEach(([key, value]) => {
    style[`--${key}`] = value;
  });

  return style;
}
