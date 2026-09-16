import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { IoSend } from 'react-icons/io5';
import UserAvatar from '../UserAvatar';
import { getSafeAvatar } from '../../utils/avatarUtils';
import { textDir } from '../../utils/textDir';
import { AppTextInput } from "../base";

export default function PostCommentComposer({
  currentUser,
  userProfile,
  value,
  onChange,
  onSubmit,
  submitting,
  placeholder,
  sticky = false,
  variant = 'comment',
  onCancel,
  autoFocus = false,
  nested = false
}) {
  const { i18n } = useTranslation();
  const inputRef = useRef(null);
  const avatarUser = userProfile || currentUser;
  const photo = getSafeAvatar(avatarUser || currentUser);
  const isInlineReply = variant === 'inline-reply';
  // Default to the UI language when empty (Arabic UI → RTL), then follow the
  // content: flips to LTR the moment English is typed, RTL for Arabic.
  const inputDir = textDir(value, i18n.language === 'ar' ? 'rtl' : 'ltr');

  useEffect(() => {
    if (!autoFocus || !inputRef.current) return;
    inputRef.current.focus();
  }, [autoFocus]);

  return (
    <div
      className={[
      'fb-comment-composer',
      `fb-comment-composer--${variant}`,
      sticky ? 'fb-comment-composer--sticky' : '',
      isInlineReply ? 'fb-comment-reply-float' : '',
      isInlineReply && nested ? 'fb-comment-reply-float--nested' : ''].

      filter(Boolean).
      join(' ')}>

            <UserAvatar
        user={avatarUser || {}}
        src={photo || undefined}
        className="fb-comment-composer__avatar"
        alt="" />

            <form className="fb-comment-composer__form" onSubmit={onSubmit}>
                <AppTextInput
          ref={inputRef}
          type="text"
          className="fb-comment-composer__input"
          placeholder={placeholder}
          value={value}
          dir={inputDir}
          style={{ textAlign: 'start' }}
          onChange={onChange}
          onClick={(e) => e.stopPropagation()} />

                <button
          type="submit"
          className="fb-comment-composer__send"
          disabled={!value.trim() || submitting}
          aria-label={placeholder}>

                    <IoSend size={isInlineReply ? 18 : 20} />
                </button>
            </form>
            {onCancel ?
      <button
        type="button"
        className="fb-comment-reply-float__cancel"
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        aria-label={placeholder}>

                    ✕
                </button> :
      null}
        </div>);

}