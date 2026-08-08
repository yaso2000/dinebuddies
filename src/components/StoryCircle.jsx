import React from 'react';
import UserAvatar from './UserAvatar';
import { AppText } from "./base";

const StoryCircle = ({ partner, hasNewStory, onClick }) => {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer',
        minWidth: '80px',
        flexShrink: 0
      }}>
      
            <div
        className={`avatar-story-ring${hasNewStory ? ' avatar-story-ring--active' : ' avatar-story-ring--viewed'}`}
        style={{ transition: 'transform 0.2s' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}>
        
                <UserAvatar
          user={{
            id: partner.id,
            display_name: partner.name,
            photo_url: partner.logo,
            gender: partner.gender
          }}
          src={partner.logo}
          alt={partner.name}
          style={{
            width: 64,
            height: 64
          }} />
        
            </div>

            <AppText as="span"
      style={{
        fontSize: '0.75rem',
        fontWeight: '600',
        color: 'var(--text-primary)',
        maxWidth: '70px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textAlign: 'center'
      }}>
        
                {partner.name}
            </AppText>
        </div>);

};

export default StoryCircle;