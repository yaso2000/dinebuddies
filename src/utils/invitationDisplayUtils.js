/**
 * Formats age groups selected for an invitation using a "smart" logic.
 * 
 * Logic:
 * 1. If all categories are selected -> "All"
 * 2. If multiple contiguous categories are selected -> Range (e.g., 18-34)
 * 3. If "55+" is the end of a contiguous range -> "MinAge+" (e.g., 25+)
 * 4. otherwise -> List separated by commas
 * 
 * @param {string[]} selectedGroups Array of selected age groups (e.g. ['18-24', '25-34'])
 * @param {Function} t Translation function
 * @returns {string} Formatted string
 */
export const formatAgeGroupsSmart = (selectedGroups, t) => {
    const ALL_AGE_GROUPS = ['18-24', '25-34', '35-44', '45-54', '55+'];

    if (!selectedGroups || selectedGroups.length === 0) return '18+';

    // Support legacy "any" tag
    if (selectedGroups.includes('any')) return t('age_all', 'All Ages');

    // Filter out any invalid items just in case
    const validSelections = selectedGroups.filter(g => ALL_AGE_GROUPS.includes(g));

    if (validSelections.length === 0) return '18+';

    // Check if ALL are selected
    if (validSelections.length === ALL_AGE_GROUPS.length) {
        return t('age_all', 'All Ages');
    }

    // Sort based on the predefined order
    const sortedGroups = [...validSelections].sort((a, b) =>
        ALL_AGE_GROUPS.indexOf(a) - ALL_AGE_GROUPS.indexOf(b)
    );

    // Check for continuity
    const indices = sortedGroups.map(g => ALL_AGE_GROUPS.indexOf(g));
    const isContiguous = indices.length > 1 && indices.every((val, i) => i === 0 || val === indices[i - 1] + 1);

    if (isContiguous) {
        const firstGroup = sortedGroups[0];
        const lastGroup = sortedGroups[sortedGroups.length - 1];

        const startAge = firstGroup.split('-')[0];

        if (lastGroup === '55+') {
            return `${startAge}+`;
        } else {
            const endAge = lastGroup.split('-')[1];
            return `${startAge}-${endAge}`;
        }
    }

    // If not contiguous or just one, join them
    return sortedGroups.join(', ');
};
