import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { FaArchive, FaCalendarAlt, FaMapMarkerAlt, FaUsers } from 'react-icons/fa';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import AppBackButton from '../components/AppBackButton';
import UserAvatar from '../components/UserAvatar';
import { AppText } from '../components/base';
import { formatArchiveDateRange } from '../utils/invitationExpiry';
import './InvitationArchiveDetails.css';

/** Where a given archive `kind` kept its messages subcollection while live. */
function messageCollectionsForKind(kind) {
  if (kind === 'public') return ['invitations'];
  // Private invitations moved to social_invitations as the canonical store;
  // older docs may still be under the legacy private_invitations collection.
  return ['social_invitations', 'private_invitations'];
}

export default function InvitationArchiveDetails() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { currentUser } = useAuth();
  const [archive, setArchive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    let cancelled = false;
    if (!id) return undefined;
    setLoading(true);
    getDoc(doc(db, 'invitation_archives', id))
      .then((snap) => {
        if (cancelled) return;
        setArchive(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      })
      .catch(() => {
        if (!cancelled) setArchive(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    if (!id || !archive || !currentUser?.uid) return undefined;

    void (async () => {
      for (const collectionName of messageCollectionsForKind(archive.kind)) {
        try {
          const q = query(
            collection(db, collectionName, id, 'messages'),
            orderBy('createdAt', 'asc')
          );
          const snap = await getDocs(q);
          if (cancelled) return;
          if (!snap.empty) {
            setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            return;
          }
        } catch {
          // Not a participant, or nothing archived under this collection — try the next one.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, archive, currentUser?.uid]);

  const dateRange = useMemo(
    () => (archive ? formatArchiveDateRange(archive, t) : ''),
    [archive, t]
  );

  if (loading) {
    return (
      <div className="invitation-archive-page">
        <header className="invitation-archive-page__header">
          <AppBackButton />
        </header>
        <AppText as="p" className="invitation-archive-page__loading">
          {t('loading', 'Loading…')}
        </AppText>
      </div>
    );
  }

  if (!archive) {
    return (
      <div className="invitation-archive-page">
        <header className="invitation-archive-page__header">
          <AppBackButton />
        </header>
        <div className="invitation-archive-page__empty">
          <FaArchive size={32} aria-hidden />
          <AppText as="h2">{t('invitation_archive_not_found', 'This invitation could not be found.')}</AppText>
        </div>
      </div>
    );
  }

  return (
    <div className="invitation-archive-page">
      <header className="invitation-archive-page__header">
        <AppBackButton />
        <AppText as="span" className="invitation-archive-page__badge">
          <FaArchive aria-hidden /> {t('invitation_archived_badge', 'Archived')}
        </AppText>
      </header>

      <div className="invitation-archive-page__thumb-wrap">
        {archive.thumbnailUrl ? (
          <img src={archive.thumbnailUrl} alt="" className="invitation-archive-page__thumb" />
        ) : (
          <div className="invitation-archive-page__thumb invitation-archive-page__thumb--fallback">
            <FaArchive size={40} aria-hidden />
          </div>
        )}
      </div>

      <div className="invitation-archive-page__body">
        <AppText as="h1" className="invitation-archive-page__title">
          {archive.title || t('invitation', 'Invitation')}
        </AppText>

        <div className="invitation-archive-page__meta">
          <AppText as="span" className="invitation-archive-page__meta-row">
            <FaCalendarAlt aria-hidden /> {dateRange}
          </AppText>
          {archive.location ? (
            <AppText as="span" className="invitation-archive-page__meta-row">
              <FaMapMarkerAlt aria-hidden /> {archive.location}
            </AppText>
          ) : null}
          {archive.hostName ? (
            <AppText as="span" className="invitation-archive-page__meta-row">
              <FaUsers aria-hidden />{' '}
              {t('invitation_archive_hosted_by', 'Hosted by {{name}}', { name: archive.hostName })}
            </AppText>
          ) : null}
        </div>

        <AppText as="p" className="invitation-archive-page__notice">
          {t(
            'invitation_archive_notice',
            'This event has ended. This is a read-only archived summary — the live invitation has been removed.'
          )}
        </AppText>

        {messages.length ? (
          <section className="invitation-archive-page__chat">
            <AppText as="h2" className="invitation-archive-page__chat-title">
              {t('invitation_archive_chat_title', 'Chat history')}
            </AppText>
            <ul className="invitation-archive-page__chat-list">
              {messages.map((m) => (
                <li key={m.id} className="invitation-archive-page__chat-item">
                  <UserAvatar
                    user={{ photo_url: m.senderAvatar, display_name: m.senderName }}
                    className="invitation-archive-page__chat-avatar"
                  />
                  <div className="invitation-archive-page__chat-bubble">
                    <AppText as="span" className="invitation-archive-page__chat-sender">
                      {m.senderName || t('member', 'Member')}
                    </AppText>
                    <AppText as="p" className="invitation-archive-page__chat-text">
                      {m.type && m.type !== 'text'
                        ? t('invitation_archive_attachment_removed', '📎 Attachment (removed)')
                        : m.text || ''}
                    </AppText>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
