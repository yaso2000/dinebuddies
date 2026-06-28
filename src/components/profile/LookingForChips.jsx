import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    normalizeLookingFor,
    getPersonalInviteCategoryMeta,
} from '../../constants/personalInviteCategories';
import { AppText } from '../base';

/**
 * Read-only chips for relationship intentions (dating / friendship / social).
 */
export default function LookingForChips({
    ids,
    className = '',
    chipClassName = '',
    includeDating = true,
}) {
    const { t } = useTranslation();
    const items = normalizeLookingFor(ids, { includeDating });
    if (!items.length) return null;

    return (
        <div className={className}>
            {items.map((id) => {
                const meta = getPersonalInviteCategoryMeta(id);
                return (
                    <AppText as="span" key={id} className={chipClassName}>
                        {t(meta.labelKey, meta.defaultLabel)} {meta.icon}
                    </AppText>
                );
            })}
        </div>
    );
}
