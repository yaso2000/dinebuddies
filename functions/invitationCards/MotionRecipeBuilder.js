/**
 * Lightweight animation hints for HTML/CSS looped motion (mobile-friendly).
 */

class MotionRecipeBuilder {
    build(outputFormat, variationSlot) {
        if (outputFormat !== 'animated') {
            return null;
        }

        const presets = [
            {
                preset: 'gentle_float',
                cssHints: {
                    animation: 'invCardFloat 6s ease-in-out infinite',
                    keyframesName: 'invCardFloat'
                }
            },
            {
                preset: 'soft_glow_pulse',
                cssHints: {
                    animation: 'invCardGlow 5s ease-in-out infinite',
                    keyframesName: 'invCardGlow'
                }
            },
            {
                preset: 'slow_pan',
                cssHints: {
                    animation: 'invCardPan 8s linear infinite',
                    keyframesName: 'invCardPan'
                }
            }
        ];

        return presets[(variationSlot - 1) % 3];
    }
}

module.exports = MotionRecipeBuilder;
