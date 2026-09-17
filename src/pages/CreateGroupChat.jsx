import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaArrowLeft, FaCheck, FaSearch, FaUsers } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { getMutualFollowers } from '../utils/followHelpers';
import { filterSameAgeClass } from '../utils/minorSafety';
import { getSafeAvatar } from '../utils/avatarUtils';
import { goToLogin } from '../utils/goToLogin';
import { AppText, AppTextInput } from '../components/base';

const MIN_MEMBERS = 2; // + creator = 3 total (a normal group)
const MAX_MEMBERS = 50;

/**
 * Create a normal (WhatsApp-style) group chat — invite-only. Members are the
 * creator's mutual friends of the SAME age class (16+ safety, enforced again
 * server-side by createGroupConversation).
 */
export default function CreateGroupChat() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, userProfile, isGuest, isBusiness } = useAuth();
  const { createGroupConversation } = useChat();

  const uid = currentUser?.uid || currentUser?.id;
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [mutuals, setMutuals] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isGuest) goToLogin({ returnPath: '/create-group-chat' });
  }, [isGuest]);

  useEffect(() => {
    if (isBusiness || !uid) { setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    const followingIds = Array.isArray(userProfile?.following) ? userProfile.following : [];
    getMutualFollowers(uid, followingIds)
      .then((rows) => {
        if (cancelled) return;
        // 16+ safety: only same-age-class friends may join.
        const sameClass = filterSameAgeClass(userProfile, rows || []);
        setMutuals(
          sameClass.map((u) => ({
            id: u.id,
            name: u.display_name || u.displayName || u.name || t('user', 'User'),
            avatar: getSafeAvatar(u),
          }))
        );
      })
      .catch(() => { if (!cancelled) setMutuals([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid, userProfile, isBusiness, t]);

  const toggle = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_MEMBERS) next.add(id);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? mutuals.filter((m) => m.name.toLowerCase().includes(q)) : mutuals;
  }, [mutuals, search]);

  const canCreate = !submitting && name.trim().length > 0 && selectedIds.size >= MIN_MEMBERS;

  const handleCreate = async () => {
    if (!canCreate) return;
    setSubmitting(true);
    try {
      const conversationId = await createGroupConversation({
        memberIds: [...selectedIds],
        name: name.trim(),
      });
      if (conversationId) navigate(`/group/${conversationId}`, { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  if (isBusiness) return <Navigate to="/business-dashboard" replace />;

  return (
    <div className="page-container" style={{ maxWidth: 560, margin: '0 auto', padding: '0 0 96px', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 5 }}>
        <button type="button" onClick={() => navigate(-1)} aria-label={t('back', 'Back')}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.1rem', cursor: 'pointer' }}>
          <FaArrowLeft />
        </button>
        <AppText as="h2" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FaUsers /> {t('group_chat_new', 'New group chat')}
        </AppText>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* Group name */}
        <AppText as="label" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
          {t('group_name', 'Group name')}
        </AppText>
        <AppTextInput
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 60))}
          placeholder={t('group_name_placeholder', 'e.g. Weekend crew')}
          style={{ width: '100%', height: 46, borderRadius: 12, border: '1.5px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', padding: '0 12px', fontSize: '0.95rem', boxSizing: 'border-box', textAlign: 'start' }}
        />

        {/* Members */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '18px 0 8px' }}>
          <AppText as="label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            {t('group_add_members', 'Add members')}
          </AppText>
          <AppText as="span" style={{ fontSize: '0.78rem', fontWeight: 700, color: selectedIds.size >= MIN_MEMBERS ? '#10b981' : 'var(--text-muted)' }}>
            {selectedIds.size} {t('selected', 'selected')}
          </AppText>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, borderRadius: 12, border: '1.5px solid var(--border-color)', background: 'var(--bg-card)', padding: '0 12px', marginBottom: 10 }}>
          <FaSearch style={{ color: 'var(--text-muted)', fontSize: '0.85rem', flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_friends', 'Search friends…')}
            style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
          />
        </div>

        {loading ? (
          <AppText as="p" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
            {t('loading', 'Loading…')}
          </AppText>
        ) : mutuals.length === 0 ? (
          <AppText as="p" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0', fontSize: '0.9rem' }}>
            {t('group_no_mutual_friends', 'You can only add mutual friends. Follow each other first to build a group.')}
          </AppText>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map((m) => {
              const on = selectedIds.has(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 14, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-color)'}`, background: on ? 'rgba(139,92,246,0.12)' : 'var(--bg-card)', cursor: 'pointer', textAlign: 'start' }}>
                  <img src={m.avatar} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  <AppText as="span" style={{ flex: 1, fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>{m.name}</AppText>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? 'var(--primary)' : 'transparent', border: on ? 'none' : '2px solid var(--border-color)', color: '#fff', fontSize: '0.7rem' }}>
                    {on ? <FaCheck /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Create */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', background: 'var(--bg-main)', borderTop: '1px solid var(--border-color)', maxWidth: 560, margin: '0 auto' }}>
        <button
          type="button"
          onClick={handleCreate}
          disabled={!canCreate}
          style={{ width: '100%', height: 52, borderRadius: 16, border: 'none', background: canCreate ? 'var(--primary)' : 'var(--border-color)', color: '#fff', fontWeight: 800, fontSize: '1rem', cursor: canCreate ? 'pointer' : 'not-allowed' }}>
          {submitting ? t('creating', 'Creating…') : t('group_create', 'Create group')}
        </button>
        {selectedIds.size < MIN_MEMBERS ? (
          <AppText as="p" style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>
            {t('group_min_members', 'Pick at least 2 friends.')}
          </AppText>
        ) : null}
      </div>
    </div>
  );
}
