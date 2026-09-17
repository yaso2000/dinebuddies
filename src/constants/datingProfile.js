/**
 * Legacy module name kept so existing imports keep working. The only thing still
 * used from here is the age-category list (see ./ageCategories for the source of truth).
 * Gender / "looking for" constants of the former dating space were removed.
 */
import { AGE_CATEGORY_IDS } from './ageCategories';

export const DATING_AGE_CATEGORIES = AGE_CATEGORY_IDS.map((id) => ({ id, label: id.replace('-', '–') }));

export const DATING_AGE_CATEGORY_IDS = DATING_AGE_CATEGORIES.map((c) => c.id);
