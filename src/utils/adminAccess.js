const ADMIN_EMAILS = [
    'admin@dinebuddies.com',
    'yaser@dinebuddies.com',
    'info@dinebuddies.com.au',
    'y.abohamed@gmail.com'
];

const SUPER_ADMIN_UIDS = ['xTgHC1v00LZIZ6ESA9YGjGU5zW33'];

export function isAdminIdentity(currentUser, userProfile) {
    const email = String(currentUser?.email || userProfile?.email || '').toLowerCase();
    const uid = currentUser?.uid || currentUser?.id || userProfile?.uid || userProfile?.id;
    const role = String(userProfile?.role || '').toLowerCase();
    return role === 'admin' || ADMIN_EMAILS.includes(email) || SUPER_ADMIN_UIDS.includes(uid);
}

