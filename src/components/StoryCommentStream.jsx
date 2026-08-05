import React, { useCallback } from 'react';
import './StoryCommentStream.css';
import { AppText } from "./base";

function spawnStyle(spawn) {
  const { x = 0, actualY = 0 } = spawn || {};
  return {
    '--initial-x': `${x}px`,
    '--initial-y': `${actualY + 20}px`,
    '--actual-y': `${actualY}px`,
    '--terminal-y': `${actualY - 350}px`
  };
}

/**
 * Advanced reverse waterfall with profile pic (owner view).
 * @param {{ items: Array<{ key: string, reaction: object, spawn?: { x: number, actualY: number } }>, onExpire: (key: string) => void, visible?: boolean }} props
 */
export default function StoryCommentStream({ items, onExpire, visible = true }) {
  const handleAnimationEnd = useCallback(
    (key) => {
      onExpire(key);
    },
    [onExpire]
  );

  if (!visible || !items.length) return null;

  return (
    <div className="story-comment-stream" aria-live="polite" aria-relevant="additions">
            {items.map(({ key, reaction, spawn }) => {
        const isEmoji = reaction.type === 'emoji' || reaction.type === 'like';
        const initial = reaction.userName?.trim()?.charAt(0)?.toUpperCase() || '?';

        return (
          <div
            key={key}
            className="story-comment-stream__bubble"
            style={spawnStyle(spawn)}
            onAnimationEnd={() => handleAnimationEnd(key)}>
            
                        {reaction.userPhoto ?
            <img
              src={reaction.userPhoto}
              className="story-comment-stream__avatar"
              alt="" /> :


            <div className="story-comment-stream__avatar story-comment-stream__avatar--fallback" aria-hidden>
                                {initial}
                            </div>
            }
                        <div className="story-comment-stream__content">
                            <strong className="story-comment-stream__name">{reaction.userName}</strong>
                            <AppText as="span" className={isEmoji ? 'story-comment-stream__emoji' : 'story-comment-stream__text'}>
                                {reaction.content}
                            </AppText>
                        </div>
                    </div>);

      })}
        </div>);

}