import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_CARD_STRUCTURE,
  getCardTextOverlayLayoutClass,
  normalizeCardStructure } from
'../utils/cardStructure';
import './CardTextOverlay.css';

/**
 * Geometry-safe text overlay for invitation card templates (AI copy + safe zones).
 *
 * @param {{
 *   title: string,
 *   description: string,
 *   selectedTemplate?: import('../utils/cardStructure.js').CardStructure | string,
 *   className?: string,
 *   showBrandMark?: boolean,
 * }} props
 */import { AppText } from "./base";
export function CardTextOverlay({
  title,
  description,
  selectedTemplate = DEFAULT_CARD_STRUCTURE,
  className = '',
  showBrandMark = true
}) {
  const { t } = useTranslation();
  const structure = normalizeCardStructure(selectedTemplate);
  const layoutClass = getCardTextOverlayLayoutClass(structure);

  return (
    <div
      className={`${layoutClass}${className ? ` ${className}` : ''}`}
      aria-label="Invitation text overlay">

            <AppText as="h2" className="card-text-overlay__title">
                {title?.trim() || t('card_overlay_title_placeholder')}
            </AppText>

            <AppText as="p" className="card-text-overlay__description">
                {description?.trim() || t('card_overlay_desc_placeholder')}
            </AppText>

            {showBrandMark ?
      <div className="card-text-overlay__brand">
                    <AppText as="span">DineBuddies Premium Invite</AppText>
                </div> :
      null}
        </div>);

}

export default CardTextOverlay;