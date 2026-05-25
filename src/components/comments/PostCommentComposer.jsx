import React from 'react';
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
}) {
    const avatarUser = userProfile || currentUser;
    const photo = getSafeAvatar(avatarUser || currentUser);

    return (
        <div className={`fb-comment-composer${sticky ? ' fb-comment-composer--sticky' : ''}`}>
            <UserAvatar
                user={avatarUser || {}}
                src={photo || undefined}
                className="fb-comment-composer__avatar"
                alt=""
            />
            <form className="fb-comment-composer__form" onSubmit={onSubmit}>
                <input
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
                    <IoSend size={20} />
                </button>
            </form>
        </div>
    );
}
