import React, { useState } from 'react';
import './EmojiPicker.css';

const EMOJI_CATEGORIES = {
    smileys: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳'],
    gestures: ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤙', '💪'],
    hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
    food: ['🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥓', '🥚', '🍳', '🧇', '🥞', '🧈', '🍞', '🥐', '🥖', '🥨', '🥯', '🧀', '🥗', '🥙', '🥪', '🌮', '🌯', '🥑'],
    activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪀', '🥅', '⛳', '🪁', '🏹', '🎣'],
    symbols: ['✨', '💫', '⭐', '🌟', '✅', '❌', '❓', '❗', '💯', '🔥', '💥', '💢', '💬', '💭', '🗯️', '💤']
};

const EmojiPicker = ({ onEmojiSelect, onClose }) => {
    const [activeCategory, setActiveCategory] = useState('smileys');

    const categories = [
        { id: 'smileys', label: '😊', name: 'Smileys' },
        { id: 'gestures', label: '👍', name: 'Gestures' },
        { id: 'hearts', label: '❤️', name: 'Hearts' },
        { id: 'food', label: '🍕', name: 'Food' },
        { id: 'activities', label: '⚽', name: 'Activities' },
        { id: 'symbols', label: '✨', name: 'Symbols' }
    ];

    const handleEmojiClick = (emoji) => {
        onEmojiSelect(emoji);
        // Don't close automatically - let user select multiple emojis
    };

    return (
        <div className="emoji-picker">
            <div className="emoji-picker-header">
                <div className="emoji-categories">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            type="button"
                            className={`emoji-category-btn ${activeCategory === cat.id ? 'active' : ''}`}
                            onClick={() => setActiveCategory(cat.id)}
                            title={cat.name}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
                <button type="button" className="emoji-close-btn" onClick={onClose}>✕</button>
            </div>

            <div className="emoji-grid">
                {EMOJI_CATEGORIES[activeCategory].map((emoji, index) => (
                    <button
                        key={index}
                        type="button"
                        className="emoji-btn"
                        onClick={() => handleEmojiClick(emoji)}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default EmojiPicker;
