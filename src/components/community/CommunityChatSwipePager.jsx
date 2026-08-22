import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaUsers } from 'react-icons/fa';
import CommunityCenterStageView from './CommunityCenterStageView';
import CommunityFullChatView from './CommunityFullChatView';
import CommunityMembersModal from './CommunityMembersModal';
import './CommunityChatSwipePager.css';

/** Default landing page — center (media stage). */
export const COMMUNITY_CHAT_DEFAULT_PAGE = 0;

/** Track layout (LTR): center (default) | guest chat — members open as a floating modal instead */
const PAGES = [
  { id: 'center-stage', label: 'Media stage' },
  { id: 'full-chat', label: 'Guest chat' },
];

function scrollToPage(container, index, behavior = 'auto') {
  if (!container) return;
  const width = container.clientWidth;
  container.scrollTo({ left: width * index, top: 0, behavior });
}

function renderPagePanel(page, room, pageIndex, activePageIndex, onOpenMembers) {
  if (!room) return null;

  const bannerMediaActive = pageIndex === activePageIndex;

  if (page.id === 'center-stage') {
    return (
      <CommunityCenterStageView
        room={room}
        bannerMediaActive={bannerMediaActive}
        onOpenMembers={onOpenMembers}
      />
    );
  }

  if (page.id === 'full-chat') {
    return (
      <CommunityFullChatView
        room={room}
        bannerMediaActive={bannerMediaActive}
        onOpenMembers={onOpenMembers}
      />
    );
  }

  return null;
}

/**
 * Horizontal two-panel pager (LTR track): center (default) media stage · guest chat full screen.
 * Members open as a floating modal (see CommunityMembersModal) rather than a swipe page.
 */
export default function CommunityChatSwipePager({
  room,
  defaultPage = COMMUNITY_CHAT_DEFAULT_PAGE,
  onGiftParticipant,
}) {
  const { t } = useTranslation();
  const pagerRef = useRef(null);
  const activeIndexRef = useRef(defaultPage);
  const [activePageIndex, setActivePageIndex] = useState(defaultPage);
  const [membersOpen, setMembersOpen] = useState(false);
  // Members icon is pinned to the banner's own top corner (see CommunityTopMediaPanel), shown for
  // both host and guest. Fall back to this floating button only when there's no banner to pin it
  // to at all (banner hidden).
  const showFloatingMembersBtn = room?.bannerVisible === false;

  const syncActiveIndex = useCallback(() => {
    const el = pagerRef.current;
    if (!el || el.clientWidth <= 0) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    const clamped = Math.max(0, Math.min(PAGES.length - 1, next));
    activeIndexRef.current = clamped;
    setActivePageIndex(clamped);
  }, []);

  useEffect(() => {
    const el = pagerRef.current;
    if (!el) return undefined;

    scrollToPage(el, defaultPage, 'auto');

    const onResize = () => scrollToPage(el, activeIndexRef.current, 'auto');
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    return () => ro.disconnect();
  }, [defaultPage]);

  return (
    <div className="community-chat-swipe">
      <div
        ref={pagerRef}
        className="community-chat-swipe__viewport"
        dir="ltr"
        role="tablist"
        aria-label="Community chat views"
        onScroll={syncActiveIndex}
      >
        <div className="community-chat-swipe__track">
          {PAGES.map((page, pageIndex) => (
            <section
              key={page.id}
              className={`community-chat-swipe__page community-chat-swipe__page--panel community-chat-swipe__page--${page.id}`}
              role="tabpanel"
              aria-label={page.label}
            >
              {renderPagePanel(page, room, pageIndex, activePageIndex, () => setMembersOpen(true))}
            </section>
          ))}
        </div>
      </div>

      {showFloatingMembersBtn ? (
        <button
          type="button"
          className="community-chat-swipe__members-btn"
          onClick={() => setMembersOpen(true)}
          title={t('community_participants_title', 'Online Participants')}
          aria-label={t('community_participants_title', 'Online Participants')}
        >
          <FaUsers aria-hidden />
        </button>
      ) : null}

      <CommunityMembersModal
        open={membersOpen}
        room={room}
        onGift={onGiftParticipant}
        onClose={() => setMembersOpen(false)}
      />
    </div>
  );
}
