import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../api';
import AdminDemoUserPicker from './AdminDemoUserPicker';
import { uploadAdminPostImage } from '../utils/adminPostImageUpload';
import { AppText, AppTextInput } from '../../components/base';

export default function AdminCreateDemoPostForm({ onCreated }) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [demoUid, setDemoUid] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const canSubmit = Boolean(demoUid && (content.trim() || mediaUrl.trim() || mediaFile));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || creating) return;

    setCreating(true);
    setError('');
    setMsg('');
    setUploadProgress(0);

    try {
      let finalMediaUrl = mediaUrl.trim() || null;
      if (mediaFile) {
        finalMediaUrl = await uploadAdminPostImage(
          mediaFile,
          currentUser?.uid,
          (pct) => setUploadProgress(pct)
        );
      }

      const result = await adminApi.createDemoPost({
        demoUid,
        postTitle: postTitle.trim() || null,
        content: content.trim(),
        mediaUrl: finalMediaUrl,
        mediaType: finalMediaUrl ? 'image' : null,
      });

      setMsg(
        t('admin_posts_create_success', {
          name: result.authorName || demoUid,
          id: result.postId,
          defaultValue: 'Post published as {{name}} ({{id}}).',
        })
      );
      setPostTitle('');
      setContent('');
      setMediaUrl('');
      setMediaFile(null);
      setDemoUid('');
      onCreated?.();
    } catch (err) {
      setError(err.message || t('admin_failed', 'Action failed.'));
    } finally {
      setCreating(false);
      setUploadProgress(0);
    }
  };

  return (
    <form
      className="db-panel"
      style={{ marginBottom: '1.25rem', padding: '1rem' }}
      onSubmit={handleSubmit}
    >
      <AppText as="h2" className="db-h2" style={{ marginTop: 0 }}>
        {t('admin_posts_create_section', 'Create post as demo user')}
      </AppText>
      <AppText as="p" className="db-muted" style={{ marginTop: 0, marginBottom: '1rem', fontSize: '0.85rem' }}>
        {t(
          'admin_posts_create_hint',
          'Choose a demo user as the author, then write the post. It appears in the community feed under their name.'
        )}
      </AppText>

      <div style={{ display: 'grid', gap: '1rem', maxWidth: 560 }}>
        <AdminDemoUserPicker value={demoUid} onChange={setDemoUid} disabled={creating} />

        <div>
          <label className="db-label" htmlFor="admin-post-title">
            {t('admin_posts_create_title', 'Title (optional)')}
          </label>
          <AppTextInput
            id="admin-post-title"
            className="db-input"
            style={{ width: '100%', maxWidth: 560 }}
            value={postTitle}
            maxLength={100}
            disabled={creating}
            onChange={(e) => setPostTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="db-label" htmlFor="admin-post-content">
            {t('admin_posts_create_content', 'Post text')}
          </label>
          <textarea
            id="admin-post-content"
            className="db-input"
            style={{ width: '100%', maxWidth: 560, minHeight: 120, resize: 'vertical' }}
            value={content}
            maxLength={300}
            disabled={creating}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div>
          <label className="db-label" htmlFor="admin-post-image-url">
            {t('admin_posts_create_image_url', 'Image URL (optional)')}
          </label>
          <AppTextInput
            id="admin-post-image-url"
            className="db-input"
            style={{ width: '100%', maxWidth: 560 }}
            value={mediaUrl}
            disabled={creating || Boolean(mediaFile)}
            placeholder="https://…"
            onChange={(e) => setMediaUrl(e.target.value)}
          />
        </div>

        <div>
          <label className="db-label" htmlFor="admin-post-image-file">
            {t('admin_posts_create_image_file', 'Or upload image')}
          </label>
          <input
            id="admin-post-image-file"
            type="file"
            accept="image/*"
            disabled={creating || Boolean(mediaUrl.trim())}
            onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
          />
          {uploadProgress > 0 && uploadProgress < 100 ? (
            <AppText as="p" className="db-muted" style={{ margin: '0.35rem 0 0', fontSize: '0.82rem' }}>
              {t('admin_upload_progress', { pct: uploadProgress, defaultValue: 'Uploading… {{pct}}%' })}
            </AppText>
          ) : null}
        </div>

        <div className="db-toolbar" style={{ margin: 0 }}>
          <button type="submit" className="db-btn db-btn--lime" disabled={!canSubmit || creating}>
            {creating
              ? t('admin_posts_create_publishing', 'Publishing…')
              : t('admin_posts_create_submit', 'Publish post')}
          </button>
        </div>

        {msg ? (
          <AppText as="p" className="db-ok-text" style={{ margin: 0 }}>
            {msg}
          </AppText>
        ) : null}
        {error ? (
          <AppText as="p" className="db-error" style={{ margin: 0 }}>
            {error}
          </AppText>
        ) : null}
      </div>
    </form>
  );
}
