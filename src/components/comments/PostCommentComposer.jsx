import React, { useEffect, useRef } from 'react';
import { IoSend } from 'react-icons/io5';
import UserAvatar from '../UserAvatar';
import { getSafeAvatar } from '../../utils/avatarUtils';

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
    nested = false,
}) {
    const inputRef = useRef(null);
    const avatarUser = userProfile || currentUser;
    const photo = getSafeAvatar(avatarUser || currentUser);
    const isInlineReply = variant === 'inline-reply';

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
                isInlineReply && nested ? 'fb-comment-reply-float--nested' : '',
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <UserAvatar
                user={avatarUser || {}}
                src={photo || undefined}
                className="fb-comment-composer__avatar"
                alt=""
            />
            <form className="fb-comment-composer__form" onSubmit={onSubmit}>
                <input
                    ref={inputRef}
                    type="text"
                    className="fb-comment-composer__input"
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange}
                    onClick={(e) => e.stopPropagation()}
                />
                <button
                    type="submit"
                    className="fb-comment-composer__send"
                    disabled={!value.trim() || submitting}
                    aria-label={placeholder}
                >
                    <IoSend size={isInlineReply ? 18 : 20} />
                </button>
            </form>
            {onCancel ? (
                <button
                    type="button"
                    className="fb-comment-reply-float__cancel"
                    onClick={(e) => {
                        e.stopPropagation();
                        onCancel();
                    }}
                    aria-label={placeholder}
                >
                    ✕
                </button>
            ) : null}
        </div>
    );
}
