/**
 * One line of overlay text for private invitations. Not shared with dating.
 */

class PrivateCopyLineComposer {
    compose(blueprint) {
        const host = blueprint.inviterDisplayName || 'Host';
        const place = blueprint.placeDisplayName || 'the venue';
        const occ = blueprint.occasionLabel || 'gathering';
        const msg = (blueprint.message || '').trim();
        let line = `${host} · ${occ} at ${place}`;
        if (msg && line.length + msg.length + 3 <= 120) {
            line = `${line} — ${msg}`;
        }
        return line.slice(0, 120).trim();
    }
}

module.exports = PrivateCopyLineComposer;
