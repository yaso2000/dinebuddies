/**
 * One line of overlay text for dating invitations. Not shared with private.
 */

class DatingCopyLineComposer {
    compose(blueprint) {
        const place = blueprint.placeDisplayName || 'a nice spot';
        const intent = blueprint.interactionIntent || 'meet';
        const msg = (blueprint.message || '').trim();
        let line = `${intent} · ${place}`;
        if (msg && line.length + msg.length + 3 <= 120) {
            line = `${line} — ${msg}`;
        }
        return line.slice(0, 120).trim();
    }
}

module.exports = DatingCopyLineComposer;
