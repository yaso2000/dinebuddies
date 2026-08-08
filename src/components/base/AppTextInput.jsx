import React, { forwardRef } from 'react';

/**
 * Global text input primitive — auto direction while typing (no RLM injection on value).
 *
 * @typedef {object} AppTextInputProps
 * @property {'input'|'textarea'} [as='input']
 * @property {string} [type='text'] — only when `as="input"`
 * @property {'auto'|'ltr'|'rtl'} [dir='auto']
 */

/**
 * @type {React.ForwardRefRenderFunction<
 *   HTMLInputElement | HTMLTextAreaElement,
 *   AppTextInputProps & React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>
 * >}
 */
const AppTextInput = forwardRef(function AppTextInput(
    { as = 'input', className, dir = 'auto', type = 'text', style, ...rest },
    ref
) {
    const mergedClassName = ['app-text-input', className].filter(Boolean).join(' ') || undefined;

    if (as === 'textarea') {
        return (
            <textarea
                ref={ref}
                dir={dir}
                className={mergedClassName}
                style={style}
                {...rest}
            />
        );
    }

    return (
        <input
            ref={ref}
            dir={dir}
            type={type}
            className={mergedClassName}
            style={style}
            {...rest}
        />
    );
});

export default AppTextInput;
