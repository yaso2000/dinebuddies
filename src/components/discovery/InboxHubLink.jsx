import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LuInbox } from 'react-icons/lu';
import { useInboxHubBadges } from '../../hooks/useInboxHubBadges';
import { AppText } from '../base';

/**
 * Link to discovery inbox — optional tab (`activity` | `invites` | `chats`) and label.
 */
export default function InboxHubLink({
    className = 'inbox-hub-link',
    tab = null,
    showLabel = false,
    label,
}) {
    const { t } = useTranslation();
    const { activityUnread, inviteCount, hubBadge } = useInboxHubBadges();

    const to = tab ? `/search/inbox?tab=${tab}` : '/search/inbox';
    const badge =
        tab === 'activity' ? activityUnread : tab === 'invites' ? inviteCount : hubBadge;
    const text = label || t('inbox_title', 'Inbox');

    const badgeClass = className.includes('notification-bell') ? 'badge' : 'inbox-hub-link__badge';

    return (
        <Link
            to={to}
            className={className}
            title={text}
            aria-label={
                badge > 0
                    ? `${text} (${badge > 9 ? '9+' : badge} ${t('unread', 'unread')})`
                    : text
            }
        >
            <LuInbox aria-hidden />
            {showLabel ? <AppText as="span">{text}</AppText> : null}
            {badge > 0 ? (
                <AppText as="span" className={badgeClass} aria-hidden>
                    {badge > 9 ? '9+' : badge}
                </AppText>
            ) : null}
        </Link>
    );
}
