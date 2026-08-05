/**
 * City label for business directory cards (list/grid).
 * Never falls back to street address — that belongs on the profile only.
 */
export function getBusinessCardCity(business) {
    const raw =
        business?.city ||
        business?.businessInfo?.city ||
        business?.businessPublic?.city ||
        '';
    const city = String(raw || '').trim();
    return city;
}
