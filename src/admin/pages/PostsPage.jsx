import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../api';
import { AppText } from '../../components/base';

export default function PostsPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [cursorSource, setCursorSource] = useState(null);
  const [cursorCreatedAt, setCursorCreatedAt] = useState(null);
  const [hasNext, setHasNext] = useState(false);
  const [acting, setActing] = useState(null);

  const load = useCallback(
    async (startAfter = null) => {
      setLoading(true);
      try {
        const res = await adminApi.listPosts({
          startAfterId: startAfter?.id ?? null,
          startAfterSource: startAfter?.source ?? null,
          startAfterCreatedAt: startAfter?.createdAt ?? null,
          pageSize: 25,
        });
        setItems(res.items || []);
        setHasNext(!!res.hasNext);
        if (res.lastId) {
          setCursor(res.lastId);
          setCursorSource(res.lastSource || null);
          setCursorCreatedAt(res.lastCreatedAt || null);
        } else {
          setCursor(null);
          setCursorSource(null);
          setCursorCreatedAt(null);
        }
      } catch (e) {
        alert(e.message || t('admin_load_failed'));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    load(null);
  }, [load]);

  const remove = async (post) => {
    if (!window.confirm(t('admin_posts_confirm_delete'))) return;
    setActing(post.id);
    try {
      await adminApi.moderatePost(post.id, 'delete', post.source || 'community');
      await load(null);
    } catch (e) {
      alert(e.message || t('admin_failed'));
    } finally {
      setActing(null);
    }
  };

  const sourceLabel = (source) => {
    if (source === 'featured') return t('admin_posts_source_featured', 'Featured (business)');
    if (source === 'motion') return t('admin_posts_source_motion', 'Studio (business)');
    return t('admin_posts_source_community', 'Community');
  };

  const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

  return (
    <>
      <AppText as="h1" className="db-h1">{t('admin_posts_title')}</AppText>
      <AppText as="p" className="db-lead">{t('admin_posts_lead')}</AppText>

      <div className="db-panel">
        {loading ? (
          <div className="db-spin" />
        ) : items.length === 0 ? (
          <div className="db-empty">{t('admin_empty_posts')}</div>
        ) : (
          <table className="db-table">
            <thead>
              <tr>
                <th>{t('admin_posts_preview')}</th>
                <th>{t('admin_posts_author')}</th>
                <th>{t('admin_posts_type')}</th>
                <th>{t('admin_posts_date')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((post) => (
                <tr key={`${post.source || 'community'}:${post.id}`}>
                  <td>
                    <div>{post.preview}</div>
                    <div className="db-id">{post.id}</div>
                  </td>
                  <td>
                    <div>{post.authorName || post.authorId || '—'}</div>
                    {post.authorId && post.authorName ? (
                      <div className="db-id">{post.authorId}</div>
                    ) : null}
                  </td>
                  <td>
                    <AppText as="span" className="db-badge">{post.type}</AppText>
                    <div className="db-id">{sourceLabel(post.source)}</div>
                  </td>
                  <td>{fmt(post.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="db-btn db-btn--danger"
                      disabled={acting === post.id}
                      onClick={() => remove(post)}
                    >
                      {t('admin_posts_delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {hasNext && !loading && (
          <div className="db-toolbar" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="db-btn"
              onClick={() =>
                load(
                  cursor
                    ? { id: cursor, source: cursorSource, createdAt: cursorCreatedAt }
                    : null
                )
              }
            >
              {t('admin_more')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
