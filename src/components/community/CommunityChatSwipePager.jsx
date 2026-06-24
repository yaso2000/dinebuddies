import React, { useCallback, useEffect, useRef, useState } from 'react';
import CommunityParticipantsView from './CommunityParticipantsView';
import CommunityCenterStageView from './CommunityCenterStageView';
import CommunityFullChatView from './CommunityFullChatView';
import './CommunityChatSwipePager.css';

/** Default landing page — center (media stage). */
export const COMMUNITY_CHAT_DEFAULT_PAGE = 1;

/** Track layout (LTR): members | center (default) | guest chat */
const PAGES = [
  { id: 'participants', label: 'Members', background: '#0f2744' },
  { id: 'center-stage', label: 'Media stage', background: '#1a1a2e' },
  { id: 'full-chat', label: 'Guest chat', background: '#1a1a2e' },
];

function scrollToPage(container, index, behavior = 'auto') {
  if (!container) return;
  const width = container.clientWidth;
  container.scrollTo({ left: width * index, top: 0, behavior });
}

function renderPagePanel(page, room, pageIndex, activePageIndex) {
  if (!room) return null;

  const isMediaPage = page.id === 'center-stage' || page.id === 'full-chat';
  const bannerMediaActive = !isMediaPage || pageIndex === activePageIndex;

  if (page.id === 'participants') {
    return (
      <CommunityParticipantsView
        participants={room.participants}
        loading={room.participantsLoading}
        partnerId={room.partnerId}
      />
    );
  }

  if (page.id === 'center-stage') {
    return <CommunityCenterStageView room={room} bannerMediaActive={bannerMediaActive} />;
  }

  if (page.id === 'full-chat') {
    return <CommunityFullChatView room={room} bannerMediaActive={bannerMediaActive} />;
  }

  return null;
}

/**
 * Horizontal three-panel pager (LTR track):
 * swipe left → guest chat full screen · center (default) → media + chat · swipe right → members
 */
export default function CommunityChatSwipePager({
  room,
  defaultPage = COMMUNITY_CHAT_DEFAULT_PAGE,
}) {
  const pagerRef = useRef(null);
  const activeIndexRef = useRef(defaultPage);
  const [activePageIndex, setActivePageIndex] = useState(defaultPage);

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
              style={page.id === 'center-stage' || page.id === 'full-chat' ? undefined : { background: page.background }}
            >
              {renderPagePanel(page, room, pageIndex, activePageIndex)}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
