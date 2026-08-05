import React from 'react';
import './EmptyState.css';
import { AppText } from "./base";

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
                {Icon &&
        <div className="empty-state-icon">
                        <Icon />
                    </div>
        }

                <AppText as="h3" className="empty-state-title">{title}</AppText>

                {message &&
        <AppText as="p" className="empty-state-message">{message}</AppText>
        }

                {actionText && onAction &&
        <button
          className="empty-state-action"
          onClick={onAction}>

                        {actionText}
                    </button>
        }
            </div>
        </div>);

};

export default EmptyState;