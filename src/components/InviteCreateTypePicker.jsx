import React from 'react';
import { FaChevronRight, FaGlobe, FaGamepad, FaMicrophone, FaUserFriends, FaQuestion, FaTheaterMasks, FaUsers } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { AppText } from './base';
import { useInviteCreateNavigation } from '../hooks/useInviteCreateNavigation';
import { useDesktopShell } from '../hooks/useDesktopShell';
import './CreateInvitationSelector.css';

export function inviteCreateTypeSubtitle(t, venueName) {
  if (venueName) {
    return t('host_invitation_at_venue', {
      defaultValue: 'Hosting at {{name}} — choose invitation type.',
      name: venueName,
    });
  }
  return t('invite_create_subtitle', 'Choose the type of invitation you want to create.');
}

/**
 * Canonical invitation-type picker (public / social / private).
 * Stage is optional — show on mobile + sheet only; desktop keeps a separate Open Stage nav item.
 * @param {'selector' | 'sheet'} variant
 */
export default function InviteCreateTypePicker({
  variant = 'selector',
  navigationState = null,
  businessId = null,
  onAfterNavigate = null,
  className = '',
  includeStage = false,
  horizontal = false,
  // When true, offer only actual invitations (public + social) — used by the
  // "host an invitation" surfaces (list, swipe, venue). The "+" menu stays full.
  invitationsOnly = false,
}) {
  const { t } = useTranslation();
  const isDesktopShell = useDesktopShell();
  const { goCreate, publicGateChecking, activeHostedStage, activeGameId, activeSuitabilityPostId } = useInviteCreateNavigation({
    navigationState,
    businessId,
    onAfterNavigate,
  });

  const hasLiveStage = Boolean(activeHostedStage?.id);
  const hasActiveGame = Boolean(activeGameId);
  const hasActiveSuitabilityPost = Boolean(activeSuitabilityPostId);

  // Live games + the match show are available on every viewport, including the
  // desktop "create invitation" surface (they were previously mobile-only).
  // Suppressed on invitations-only host surfaces.
  const includeLiveGames = !invitationsOnly;

  const options = [
    // Normal group chat (invite-only, mutual friends) — not an invitation, not a
    // game; suppressed on invitations-only host surfaces.
    ...(!invitationsOnly
      ? [
          {
            kind: 'group_chat',
            className: 'social',
            sheetIconClass: 'business-create-option__icon--motion',
            icon: FaUsers,
            title: t('group_chat_new', 'New group chat'),
            desc: t('group_chat_create_desc', 'Start a private group with your friends.'),
          },
        ]
      : []),
    {
      kind: 'public',
      className: 'public',
      sheetIconClass: 'business-create-option__icon--public',
      icon: FaGlobe,
      title: publicGateChecking
        ? t('detecting_location', 'Detecting location…')
        : t('invite_create_public_title'),
      desc: t('invite_create_public_desc'),
      busy: publicGateChecking,
    },
    {
      kind: 'social',
      className: 'social',
      sheetIconClass: 'business-create-option__icon--motion',
      icon: FaUserFriends,
      title: t('invite_create_social_title'),
      desc: t('invite_create_social_desc'),
    },
    ...(includeLiveGames
      ? [
          {
            kind: 'group_game',
            className: 'game',
            sheetIconClass: 'business-create-option__icon--featured',
            icon: FaGamepad,
            title: hasActiveGame
              ? t('invite_enter_group_game_title', 'Enter your game')
              : t('invite_create_group_game_title', 'Group game'),
            desc: hasActiveGame
              ? t('invite_enter_group_game_desc', 'You already have a live game. Tap to enter.')
              : t('invite_create_group_game_desc', 'Play a live compatibility game with friends — open to everyone.'),
          },
        ]
      : []),
    // "Who suits you?" — a warm, story-rail poll open to everyone (mobile-first).
    ...(includeLiveGames
      ? [
          {
            kind: 'suitability',
            className: 'match',
            sheetIconClass: 'business-create-option__icon--match',
            icon: FaQuestion,
            title: hasActiveSuitabilityPost
              ? t('invite_enter_suitability_title', 'Open your card')
              : t('suitability_title', 'Who suits you?'),
            desc: hasActiveSuitabilityPost
              ? t('invite_enter_suitability_desc', 'Your card is live. Tap to see the results.')
              : t('invite_create_suitability_desc', 'Post your card and let the crowd pick which partner type suits you.'),
          },
        ]
      : []),
    // "Real or AI?" — a guessing game, open to everyone (mobile-first).
    ...(includeLiveGames
      ? [
          {
            kind: 'realornai',
            className: 'game',
            sheetIconClass: 'business-create-option__icon--featured',
            icon: FaTheaterMasks,
            title: t('roa_title', 'Real or AI?'),
            desc: t('invite_create_roa_desc', 'Post a real photo or an AI image — the crowd guesses which.'),
          },
          {
            kind: 'zodiac',
            className: 'game',
            sheetIconClass: 'business-create-option__icon--featured',
            icon: FaQuestion,
            title: t('zodiac_title', 'Guess my sign?'),
            desc: t('invite_create_zodiac_desc', 'Post your traits — the crowd guesses your zodiac sign.'),
          },
        ]
      : []),
    ...(includeStage && !invitationsOnly
      ? [
          {
            kind: 'stage',
            className: 'social',
            sheetIconClass: 'business-create-option__icon--stage',
            icon: FaMicrophone,
            title: hasLiveStage
              ? t('invite_enter_stage_title', 'Enter Stage')
              : t('invite_create_stage_title', 'Stage'),
            desc: hasLiveStage
              ? t(
                  'invite_enter_stage_desc',
                  'You already have a live Stage. Tap to enter — it stays open for 24 hours.'
                )
              : t(
                  'invite_create_stage_desc',
                  'Open a free Stage for 24 hours. Guests are optional.'
                ),
          },
        ]
      : []),
  ];

  // Group the options into their own sections so the "+" menu doesn't jumble
  // invitations with games/quizzes. Headings only show when >1 group is present.
  const GROUP_OF = {
    group_chat: 'chat',
    public: 'invitations', social: 'invitations', stage: 'invitations',
    group_game: 'games', suitability: 'games', realornai: 'games', zodiac: 'games',
  };
  const GROUPS = [
    { id: 'chat', label: t('invite_group_chat', 'محادثات') },
    { id: 'invitations', label: t('invite_group_invitations', 'دعوات') },
    { id: 'games', label: t('invite_group_games', 'ألعاب') },
  ];
  const itemsOf = (gid) => options.filter((o) => (GROUP_OF[o.kind] || 'invitations') === gid);
  const activeGroups = GROUPS.filter((g) => itemsOf(g.id).length > 0);
  const showHeadings = activeGroups.length > 1;
  const headingStyle = { fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary,#6b7280)', margin: '12px 4px 2px', width: '100%' };

  if (variant === 'sheet') {
    return (
      <div className={`business-create-sheet__options${horizontal ? ' business-create-sheet__options--horizontal' : ''}${className ? ` ${className}` : ''}`}>
        {activeGroups.map((g) => (
          <React.Fragment key={g.id}>
            {showHeadings ? <AppText as="div" style={headingStyle}>{g.label}</AppText> : null}
            {itemsOf(g.id).map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.kind}
                  type="button"
                  className="business-create-option"
                  disabled={Boolean(opt.busy)}
                  aria-busy={opt.busy || undefined}
                  onClick={() => goCreate(opt.kind)}
                >
                  <AppText as="span" className={`business-create-option__icon ${opt.sheetIconClass}`} aria-hidden>
                    <Icon />
                  </AppText>
                  <AppText as="span" className="business-create-option__text">
                    <AppText as="span" className="business-create-option__label">{opt.title}</AppText>
                    <AppText as="span" className="business-create-option__desc">{opt.desc}</AppText>
                  </AppText>
                  <FaChevronRight className="business-create-option__arrow" aria-hidden />
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className={`selector-options${className ? ` ${className}` : ''}`}>
      {activeGroups.map((g) => (
        <React.Fragment key={g.id}>
          {showHeadings ? <div style={{ ...headingStyle, gridColumn: '1 / -1' }}>{g.label}</div> : null}
          {itemsOf(g.id).map((opt) => {
            const Icon = opt.icon;
            return (
              <div
                key={opt.kind}
                className={`selector-card ${opt.className}`}
                onClick={() => goCreate(opt.kind)}
                role="button"
                tabIndex={0}
                aria-busy={opt.busy || undefined}
                style={opt.busy ? { opacity: 0.65, pointerEvents: 'none' } : undefined}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    goCreate(opt.kind);
                  }
                }}
              >
                <div className="icon-wrapper">
                  <Icon />
                </div>
                <div className="option-info">
                  <AppText as="h4">{opt.title}</AppText>
                  <AppText as="p">{opt.desc}</AppText>
                </div>
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}
