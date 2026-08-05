import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaBullhorn, FaTimes } from 'react-icons/fa';
import { AppText } from '../base';
import { getAppTextDirection, prepareBidiDisplayText } from '../../utils/bidiText';
import { extractQuotedFromMessage } from '../../utils/communityChatReply';
import { selectPinnedBarMessage } from '../../utils/communityHostSpotlightPins';

function messageTimeMs(message) {
    const ts = message?.createdAt;
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
    return 0;
}

function formatRelativeTime(createdAt, locale, t) {
    const ms = messageTimeMs({ createdAt });
    if (!ms) return '';
    const diffSec = Math.round((ms - Date.now()) / 1000);
    const abs = Math.abs(diffSec);
    try {
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
        if (abs < 60) return rtf.format(Math.round(diffSec / 60) || -1, 'minute');
        if (abs < 3600) return rtf.format(Math.round(diffSec / 3600), 'hour');
        if (abs < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), 'day');
    } catch {
        /* fallback below */
    }
    return new Date(ms).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function splitPinnedCopy(text) {
    const raw = String(text || '').trim();
    if (!raw) return { title: '', subtitle: '' };
    const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    if (lines.length <= 1) return { title: raw, subtitle: '' };
    return { title: lines[0], subtitle: lines.slice(1).join(' ') };
}

/** Pinned host announcement strip — only for messages with pinned=true (not banner bubble). */
export default function CommunityPinnedHostBar({
    messages = [],
    partnerId,
    pendingReplyTo = null,
    isHost = false,
    onUnpinHostMessage,
}) {
    const { t, i18n } = useTranslation();
    const contentDir = getAppTextDirection(i18n.language);

    const pinnedMessage = useMemo(
        () => selectPinnedBarMessage(messages, partnerId),
        [messages, partnerId]
    );

    const showPending = isHost && pendingReplyTo && !pinnedMessage;
    const quoted = pinnedMessage ? extractQuotedFromMessage(pinnedMessage) : null;

    if (!pinnedMessage && !showPending) return null;

    let title = '';
    let subtitle = '';
    let createdAt = null;

    if (showPending) {
        title = pendingReplyTo.text || '';
        subtitle = t('community_chat_reply_composing', 'Type your reply below…');
    } else if (pinnedMessage) {
        createdAt = pinnedMessage.createdAt;
        if (quoted) {
            title = String(pinnedMessage.text || '').trim();
            subtitle = String(quoted.text || '').trim();
        } else {
            const parts = splitPinnedCopy(pinnedMessage.text);
            title = parts.title;
            subtitle = parts.subtitle;
        }
    }

    const titleBidi = prepareBidiDisplayText(title, i18n.language);
    const subtitleBidi = prepareBidiDisplayText(subtitle, i18n.language);
    const timeLabel = formatRelativeTime(createdAt, i18n.language, t);

    const canUnpin = Boolean(isHost && pinnedMessage?.id && onUnpinHostMessage);

    const handleUnpin = () => {
        if (!canUnpin) return;
        void onUnpinHostMessage(pinnedMessage.id);
    };

    return (
        <div
            className={`community-pinned-host-bar${showPending ? ' community-pinned-host-bar--pending' : ''}`}
            dir={contentDir}
            role="status"
            aria-label={t('community_pinned_host_bar', 'Host announcement')}
        >
            <div className="community-pinned-host-bar__icon" aria-hidden>
                <FaBullhorn size={15} />
            </div>
            <div className="community-pinned-host-bar__body">
                {title ? (
                    <AppText
                        as="p"
                        dir={titleBidi.dir}
                        lang={titleBidi.lang}
                        format={false}
                        className="community-pinned-host-bar__title"
                    >
                        {titleBidi.text}
                    </AppText>
                ) : null}
                {subtitle ? (
                    <AppText
                        as="p"
                        dir={subtitleBidi.dir}
                        lang={subtitleBidi.lang}
                        format={false}
                        className="community-pinned-host-bar__subtitle"
                    >
                        {subtitleBidi.text}
                    </AppText>
                ) : null}
            </div>
            <div className="community-pinned-host-bar__meta">
                {timeLabel ? (
                    <AppText as="span" className="community-pinned-host-bar__time">
                        {timeLabel}
                    </AppText>
                ) : null}
                {canUnpin ? (
                    <button
                        type="button"
                        className="community-pinned-host-bar__unpin-btn"
                        aria-label={t('community_chat_unpin_bar', 'Unpin from bar')}
                        title={t('community_chat_unpin_bar', 'Unpin from bar')}
                        onClick={handleUnpin}
                    >
                        <FaTimes size={14} aria-hidden />
                    </button>
                ) : null}
            </div>
        </div>
    );
}
