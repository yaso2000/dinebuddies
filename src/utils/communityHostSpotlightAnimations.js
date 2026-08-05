/** Random enter/exit animation ids for host banner spotlight bubbles. */

export const HOST_SPOTLIGHT_ENTER_ANIMATIONS = [
    'rise',
    'drop',
    'pop',
    'slide-left',
    'slide-right',
    'swing',
    'blur',
    'zoom',
    'flip',
    'bounce',
];

export const HOST_SPOTLIGHT_EXIT_ANIMATIONS = [
    'fade-up',
    'fade-down',
    'shrink',
    'slide-left',
    'slide-right',
    'swing-out',
    'blur-out',
    'zoom-out',
    'flip-out',
    'drop-out',
];

function pickRandom(list, avoid) {
    if (list.length <= 1) return list[0];
    let next = list[Math.floor(Math.random() * list.length)];
    let guard = 0;
    while (next === avoid && guard < 8) {
        next = list[Math.floor(Math.random() * list.length)];
        guard += 1;
    }
    return next;
}

export function pickHostSpotlightEnterAnimation(previous) {
    return pickRandom(HOST_SPOTLIGHT_ENTER_ANIMATIONS, previous);
}

export function pickHostSpotlightExitAnimation(previous) {
    return pickRandom(HOST_SPOTLIGHT_EXIT_ANIMATIONS, previous);
}

export function hostSpotlightEnterClassName(id) {
    return `community-host-banner-messages__spotlight--enter-${id}`;
}

export function hostSpotlightExitClassName(id) {
    return `community-host-banner-messages__spotlight--exit-${id}`;
}
