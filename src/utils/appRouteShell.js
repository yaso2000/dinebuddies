/** Default home feed for back navigation and nav highlights. */
export const APP_HOME_PATH = '/posts-feed';

/**
 * Central route shell flags — header, bottom nav, chat layout, sidebars.
 * @param {string} pathname
 * @param {string} [search]
 * @param {{ isDesktopShell?: boolean }} [options]
 */
export function getAppRouteShell(pathname, search = '', { isDesktopShell = false } = {}) {
  const path = String(pathname || '');

  const isDirectChatRoute =
    path.startsWith('/chat/') ||
    (path.startsWith('/invitation/') && path.endsWith('/chat'));

  /** Business Inbox thread (user↔business support/offers) — its own chat screen. */
  const isBusinessThreadRoute = path.startsWith('/business-thread/');

  /** Compatibility Journey game — its own focused fullscreen screen. */
  const isCompatRoute = path.startsWith('/compat/');

  const isMessagesHub = path === '/messages' || path.startsWith('/messages/');
  const isMessagesIndex = isMessagesHub;

  const isCommunityRoute = path.startsWith('/community/');
  const isStageRoute = path.startsWith('/stage/');
  /** Consumer Stage rooms reuse community chat fullscreen chrome. */
  const isCommunityFullscreen = (isCommunityRoute || isStageRoute) && !isDesktopShell;

  /** "Who suits you?" + "Real or AI?" + "Guess my sign?" swipe decks — fullscreen. */
  const isSuitabilityDeckRoute = path === '/suitability' || path === '/realornai' || path === '/zodiac';

  /** TasteScope quiz — its own focused fullscreen screen (no app chrome). */
  const isTasteScopeRoute = path === '/tastescope';

  /**
   * Connect swipe deck (/search) — its own filter toolbar replaces the app top
   * header, but the bottom tab bar stays. The list view (/search/list) keeps
   * the normal header.
   */
  const isDiscoverySwipeRoute = path === '/search' || path === '/search/';

  /**
   * Browse screens whose own filter toolbars replace the app top header, while
   * the bottom tab bar stays visible: Invitations, Businesses (swipe + list),
   * and Members/Connect (swipe + list).
   */
  const isBrowseHeaderlessRoute =
    path === '/invitations' || path.startsWith('/invitations/') ||
    path === '/restaurants' || path.startsWith('/restaurants/') ||
    path === '/search' || path.startsWith('/search/');

  /**
   * "Camera or AI?" create screen — has its own header and opens a fullscreen
   * camera, so it must hide the bottom tab bar (otherwise the capture/record
   * button sits behind it).
   */
  const isRealOrAiCreateRoute =
    path === '/realornai/new' || path === '/realornai/mine' ||
    path === '/zodiac/new' || path === '/zodiac/mine';

  /** Active conversation thread — fullscreen on mobile, hide shell chrome. */
  const isConversationScreen = isDirectChatRoute || isCommunityRoute || isStageRoute || isBusinessThreadRoute || isCompatRoute;

  /** Left sidebar: conversation list while in a DM thread. */
  const showConversationSidebar = isDirectChatRoute;

  const searchParams = new URLSearchParams(search || '');
  const isNotificationsRoute =
    path === '/notifications' ||
    path.startsWith('/notifications/') ||
    (isMessagesHub && searchParams.get('panel') === 'notifications');

  return {
    isDirectChatRoute,
    isBusinessThreadRoute,
    isMessagesHub,
    isMessagesIndex,
    isCommunityRoute,
    isStageRoute,
    isCommunityFullscreen,
    isConversationScreen,
    showConversationSidebar,
    isNotificationsRoute,
    /** Hide mobile app header (conversation / deck / browse screens have their own bar). */
    hideMobileAppHeader: (isConversationScreen && !isCommunityFullscreen) || isSuitabilityDeckRoute || isRealOrAiCreateRoute || isBrowseHeaderlessRoute || isTasteScopeRoute,
    /** Hide bottom tab bar — chat rooms + suitability deck only; browse screens keep it. */
    hideBottomNav: isConversationScreen || isSuitabilityDeckRoute || isRealOrAiCreateRoute || isTasteScopeRoute,
    /** app-main--chat: fixed height / no outer scroll for threads + deck. */
    useChatMainLayout: isConversationScreen || isSuitabilityDeckRoute,
  };
}
