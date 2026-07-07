import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaImage, FaPaperPlane, FaSmile, FaTimes } from 'react-icons/fa';
import { AppText, AppTextInput } from '../base';
import EmojiPicker from '../EmojiPicker';
import { getAppBidiFieldProps, getAppTextDirection, prepareBidiDisplayText } from '../../utils/bidiText';
import { preventComposerControlBlur } from '../../utils/chatVisualViewportLock';
import { handleEmojiButtonClick, shouldUseAppEmojiPicker, showComposerEmojiButton } from '../../utils/emojiInputMode';

/** Shared message composer — text, emoji picker, and image attach. */
export default function CommunityChatComposer({
  sendMessage,
  sendImageMessage,
  isMutedInChat,
  uploadingImage = false,
  pendingReplyTo,
  onCancelReply,
}) {
  const { t, i18n } = useTranslation();
  const contentDir = getAppTextDirection(i18n.language);
  const inputBidiProps = getAppBidiFieldProps(i18n.language);
  const [draft, setDraft] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiWrapRef = useRef(null);

  const handleSend = useCallback(async () => {
    const ok = await sendMessage(draft);
    if (ok) {
      setDraft('');
      setShowEmojiPicker(false);
    }
  }, [draft, sendMessage]);

  const handleImagePick = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || !sendImageMessage) return;
      const ok = await sendImageMessage(file);
      if (ok) {
        setShowEmojiPicker(false);
      }
    },
    [sendImageMessage]
  );

  const handleEmojiSelect = useCallback((emoji) => {
    setDraft((prev) => `${prev}${emoji}`);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!showEmojiPicker) return undefined;

    const onOutside = (event) => {
      if (emojiWrapRef.current && !emojiWrapRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [showEmojiPicker]);

  const composerDisabled = isMutedInChat || uploadingImage;

  const replyPreview =
    pendingReplyTo?.type === 'image'
      ? t('community_chat_image_alt', 'Chat image')
      : prepareBidiDisplayText(String(pendingReplyTo?.text || '').slice(0, 120), i18n.language).text;

  return (
    <div className="community-composer-bar" dir={contentDir}>
      {pendingReplyTo ? (
        <div className="community-composer-bar__reply-preview">
          <div className="community-composer-bar__reply-copy">
            <AppText as="span" className="community-composer-bar__reply-label">
              {t('community_chat_replying_to', 'Replying to {{name}}', {
                name: pendingReplyTo.senderName || t('user', 'User'),
              })}
            </AppText>
            <AppText as="span" className="community-composer-bar__reply-snippet">
              {replyPreview}
            </AppText>
          </div>
          <button
            type="button"
            className="community-composer-bar__reply-cancel"
            aria-label={t('cancel', 'Cancel')}
            onClick={onCancelReply}
          >
            <FaTimes size={14} />
          </button>
        </div>
      ) : null}

      {showEmojiPicker && shouldUseAppEmojiPicker() ? (
        <div ref={emojiWrapRef} className="community-composer-bar__emoji-wrap">
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            onClose={() => setShowEmojiPicker(false)}
          />
        </div>
      ) : null}

      <div className="community-main-chat__input-row">
        <div className="chat-composer-input community-composer-bubble">
        <div className="community-main-chat__attachments">
          <button
            type="button"
            className="community-main-chat__attach-btn"
            aria-label={t('community_chat_attach_image', 'Attach image')}
            title={t('community_chat_attach_image', 'Attach image')}
            disabled={composerDisabled || !sendImageMessage}
            onPointerDown={preventComposerControlBlur}
            onMouseDown={preventComposerControlBlur}
            onClick={() => fileInputRef.current?.click()}
          >
            <FaImage size={16} aria-hidden />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="community-main-chat__file-input"
            onChange={(event) => void handleImagePick(event)}
          />
          {showComposerEmojiButton() ? (
          <button
            type="button"
            className={`community-main-chat__attach-btn${showEmojiPicker ? ' community-main-chat__attach-btn--active' : ''}`}
            aria-label={t('community_chat_add_emoji', 'Add emoji')}
            title={t('community_chat_add_emoji', 'Add emoji')}
            aria-pressed={showEmojiPicker}
            disabled={isMutedInChat}
            onPointerDown={preventComposerControlBlur}
            onMouseDown={preventComposerControlBlur}
            onClick={() => {
              handleEmojiButtonClick({ inputRef, setPickerOpen: setShowEmojiPicker });
            }}
          >
            <FaSmile size={16} aria-hidden />
          </button>
          ) : null}
        </div>

        <AppTextInput
          ref={inputRef}
          type="text"
          className="community-main-chat__input chat-input-field"
          placeholder={t('message_placeholder', 'Type a message…')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSend();
            }
          }}
          disabled={composerDisabled}
          aria-label={t('message_placeholder', 'Type a message…')}
          dir={inputBidiProps.dir}
          lang={inputBidiProps.lang}
          style={inputBidiProps.style}
        />
        </div>
        <button
          type="button"
          className="community-main-chat__send-btn chat-send-btn"
          aria-label={t('send', 'Send')}
          disabled={composerDisabled || !draft.trim()}
          onPointerDown={preventComposerControlBlur}
          onMouseDown={preventComposerControlBlur}
          onClick={() => void handleSend()}
        >
          <FaPaperPlane size={16} aria-hidden />
          <AppText as="span" className="community-main-chat__send-label">
            {uploadingImage
              ? t('community_chat_uploading_image', 'Uploading…')
              : t('send', 'Send')}
          </AppText>
        </button>
      </div>
    </div>
  );
}
