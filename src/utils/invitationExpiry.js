/**
 * When a public invitation should leave the live feed / be archived.
 * Event end + 24 hours grace (matches Cloud Functions invitationArchiveCore).
 */
export function computeArchiveAfterDate(date, time = '20:30') {
    const base = date ? new Date(date) : new Date();
    if (Number.isNaN(base.getTime())) return new Date();

    const [hoursRaw, minutesRaw] = String(time || '20:30').split(':');
    const hours = parseInt(hoursRaw, 10);
    const minutes = parseInt(minutesRaw, 10);
    base.setHours(Number.isFinite(hours) ? hours : 20, Number.isFinite(minutes) ? minutes : 30, 0, 0);
    return new Date(base.getTime() + 24 * 60 * 60 * 1000);
}

/** @param {import('firebase/firestore').Timestamp} Timestamp */
export function computeArchiveAfterFirestoreTimestamp(date, time, Timestamp) {
    return Timestamp.fromDate(computeArchiveAfterDate(date, time));
}

export function isPublicInvitationExpiredForArchive(inv, now = new Date()) {
    if (!inv || inv.privacy === 'private') return false;
    if (inv.status === 'draft') return false;

    if (inv.archiveAfterAt) {
        const ts = inv.archiveAfterAt.toDate ? inv.archiveAfterAt.toDate() : new Date(inv.archiveAfterAt);
        return ts.getTime() <= now.getTime();
    }

    return computeArchiveAfterDate(inv.date, inv.time).getTime() <= now.getTime();
}

/** Map user or legacy archive doc to profile list shape. */
export function mapArchivedInvitationToListItem(archiveDoc) {
    const data = archiveDoc.data?.() ?? archiveDoc;
    const id = archiveDoc.id ?? data.invitationId;
    const kind = data.kind || (data.source === 'public_expired' ? 'public' : 'social');
    return {
        id: data.invitationId || id,
        title: data.title || '',
        date: data.startDate || data.date || '',
        time: data.startTime || data.time || '',
        endAt: data.endAt || null,
        location: data.location || '',
        type: data.type || (kind === 'public' ? 'Public' : 'Social'),
        kind,
        privacy: kind === 'public' ? 'public' : 'private',
        role: data.role || 'host',
        hostId: data.hostId || null,
        hostName: data.hostName || null,
        isArchived: true,
        readOnly: true,
        thumbnailUrl: data.thumbnailUrl || null,
        archivedAt: data.archivedAt || null,
    };
}

export function formatArchiveDateRange(inv, t) {
    const start = inv.date ? String(inv.date).split('T')[0] : '';
    const startTime = inv.time || '';
    let endLabel = '';
    if (inv.endAt?.toDate) {
        endLabel = inv.endAt.toDate().toLocaleString();
    } else if (start && startTime) {
        endLabel = computeArchiveAfterDate(start, startTime).toLocaleString();
    }
    if (!start) return endLabel || '—';
    const startLabel = startTime ? `${start} ${startTime}` : start;
    if (!endLabel) return startLabel;
    return `${startLabel} → ${endLabel}`;
}

export function sortInvitationsByDateDesc(a, b) {
    const aTime = a.archivedAt?.toMillis?.() || new Date(a.date || 0).getTime();
    const bTime = b.archivedAt?.toMillis?.() || new Date(b.date || 0).getTime();
    return bTime - aTime;
}
