/**
 * Business "about" (bio) for an ingested venue.
 *  - If Google has an editorial summary, use it verbatim → bioSource: 'google'.
 *  - Otherwise store NOTHING → bioSource: '' . A one-line summary (type, price,
 *    rating, services) is composed on the CLIENT in the current UI language
 *    (see src/utils/venueSummary.js). We never store a fixed-language generated
 *    string — that would show, e.g., Arabic prose in an English UI.
 * The structured facts themselves (priceLevel, rating, serviceFlags, …) are
 * stored separately by the ingest, so the client has everything it needs.
 */

/**
 * @param {{ editorialSummary?: string }} details
 * @returns {{ description: string, bioSource: 'google'|'' }}
 */
export function buildBusinessBio(details = {}) {
    const editorial = String(details.editorialSummary || '').trim();
    if (editorial) return { description: editorial, bioSource: 'google' };
    return { description: '', bioSource: '' };
}

export default buildBusinessBio;
