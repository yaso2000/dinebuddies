import React from 'react';
import {
    DEFAULT_CARD_STRUCTURE,
    getCardTextOverlayLayoutClass,
    normalizeCardStructure,
} from '../utils/cardStructure';
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
 */
export function CardTextOverlay({
    title,
    description,
    selectedTemplate = DEFAULT_CARD_STRUCTURE,
    className = '',
    showBrandMark = true,
}) {
    const structure = normalizeCardStructure(selectedTemplate);
    const layoutClass = getCardTextOverlayLayoutClass(structure);

    return (
        <div
            className={`${layoutClass}${className ? ` ${className}` : ''}`}
            aria-label="Invitation text overlay"
        >
            <h2 className="card-text-overlay__title">
                {title?.trim() || 'عنوان الدعوة الساحرة'}
            </h2>

            <p className="card-text-overlay__description">
                {description?.trim() ||
                    'اكتب رسالة رقيقة لتظهر هنا متناسقة داخل مساحات الأمان تلقائياً وبأبهى حُلّة بصرية...'}
            </p>

            {showBrandMark ? (
                <div className="card-text-overlay__brand">
                    <span>DineBuddies Premium Invite</span>
                </div>
            ) : null}
        </div>
    );
}

export default CardTextOverlay;
