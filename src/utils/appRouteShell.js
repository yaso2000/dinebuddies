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

  const isMessagesHub = path === '/messages' || path.startsWith('/messages/');
  const isMessagesIndex = isMessagesHub;

  const isCommunityRoute = path.startsWith('/community/');
  const isStageRoute = path.startsWith('/stage/');
  /** Consumer Stage rooms reuse community chat fullscreen chrome. */
  const isCommunityFullscreen = (isCommunityRoute || isStageRoute) && !isDesktopShell;

  /** Active conversation thread — fullscreen on mobile, hide shell chrome. */
  const isConversationScreen = isDirectChatRoute || isCommunityRoute || isStageRoute;

  /** Left sidebar: conversation list while in a DM thread. */
  const showConversationSidebar = isDirectChatRoute;

  const searchParams = new URLSearchParams(search || '');
  const isNotificationsRoute =
    path === '/notifications' ||
    path.startsWith('/notifications/') ||
    (isMessagesHub && searchParams.get('panel') === 'notifications');

  return {
    isDirectChatRoute,
    isMessagesHub,
    isMessagesIndex,
    isCommunityRoute,
    isStageRoute,
    isCommunityFullscreen,
    isConversationScreen,
    showConversationSidebar,
    isNotificationsRoute,
    /** Hide mobile app header (conversation has its own bar). */
    hideMobileAppHeader: isConversationScreen && !isCommunityFullscreen,
    /** Hide bottom tab bar — chat rooms only, not /messages hub. */
    hideBottomNav: isConversationScreen,
    /** app-main--chat: fixed height / no outer scroll for threads. */
    useChatMainLayout: isConversationScreen,
  };
}
