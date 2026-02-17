import React from 'react';
import './EmptyState.css';

const EmptyState = ({
    icon: Icon,
    title,
    message,
    actionText,
    onAction,
    variant = 'default' // default, primary, secondary
}) => {
    return (
        <div className={`empty-state empty-state-${variant}`}>
            <div className="empty-state-content">
                {Icon && (
                    <div className="empty-state-icon">
                        <Icon />
                    </div>
                )}

                <h3 className="empty-state-title">{title}</h3>

                {message && (
                    <p className="empty-state-message">{message}</p>
                )}

                {actionText && onAction && (
                    <button
                        className="empty-state-action"
                        onClick={onAction}
                    >
                        {actionText}
                    </button>
                )}
            </div>
        </div>
    );
};

export default EmptyState;
