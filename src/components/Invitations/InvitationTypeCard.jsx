import React from 'react';

/**
 * Tappable invitation-type row (DineBuddy Open / Private / Date).
 */import { AppText } from "../base";
const InvitationTypeCard = ({
  icon: Icon,
  title,
  description,
  variant = 'public',
  onClick,
  onKeyDown,
  disabled = false,
  busy = false,
  ariaLabel
}) =>
<button
  type="button"
  className={`inv-type-card inv-type-card--${variant}`}
  onClick={onClick}
  onKeyDown={onKeyDown}
  disabled={disabled || busy}
  aria-busy={busy}
  aria-label={ariaLabel || title}>
  
        <AppText as="span" className="inv-type-card__icon" aria-hidden>
            <Icon />
        </AppText>
        <AppText as="span" className="inv-type-card__body">
            <AppText as="span" className="inv-type-card__title">{title}</AppText>
            <AppText as="span" className="inv-type-card__desc">{description}</AppText>
        </AppText>
    </button>;


export default InvitationTypeCard;