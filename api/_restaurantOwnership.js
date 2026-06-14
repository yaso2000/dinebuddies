/**
 * Admin-owned restaurant placeholders until a business claims via phone OTP.
 */
export const DEFAULT_ADMIN_OWNER_UID = 'xTgHC1v00LZIZ6ESA9YGjGU5zW33';

export function getAdminOwnerUid() {
    const fromEnv = String(process.env.ADMIN_OWNER_UID || process.env.VITE_ADMIN_OWNER_UID || '').trim();
    return fromEnv || DEFAULT_ADMIN_OWNER_UID;
}
