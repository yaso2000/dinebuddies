import React, { useCallback } from 'react';
import './StoryCommentStream.css';

/**
 * Bottom-left comment/reaction stream — each item crawls up over 3.5s then is removed.
 * @param {{ items: Array<{ key: string, reaction: object }>, onExpire: (key: string) => void }} props
 */
export default function StoryCommentStream({ items, onExpire }) {
    const handleAnimationEnd = useCallback(
        (key) => {
            onExpire(key);
        },
        [onExpire]
    );

    if (!items.length) return null;

    return (
        <div className="story-comment-stream" aria-live="polite" aria-relevant="additions">
            {items.map(({ key, reaction }) => (
                <div
                    key={key}
                    className="story-comment-stream__item"
                    onAnimationEnd={() => handleAnimationEnd(key)}
                >
                    <div className="story-comment-stream__avatar">
                        {reaction.userPhoto ? (
                            <img src={reaction.userPhoto} alt="" />
                        ) : null}
                    </div>
                    <div className="story-comment-stream__bubble">
                        <span className="story-comment-stream__name">{reaction.userName}</span>
                        <span
                            className={
                                reaction.type === 'emoji' || reaction.type === 'like'
                                    ? 'story-comment-stream__emoji'
                                    : 'story-comment-stream__text'
                            }
                        >
                            {reaction.content}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
