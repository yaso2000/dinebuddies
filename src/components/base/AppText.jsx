import React from 'react';
import { formatBiDiChildren } from '../../utils/formatBiDiText';

/**
 * Global read-only text primitive — enforces logical BiDi isolation app-wide.
 *
 * @param {object} props
 * @param {keyof JSX.IntrinsicElements} [props.as='span']
 * @param {boolean} [props.format=true] Apply RLM fallback for Arabic + trailing punctuation
 * @param {'auto'|'ltr'|'rtl'} [props.dir='auto']
 * @param {import('react').ReactNode} props.children
 */
export default function AppText({
    as: Component = 'span',
    children,
    className,
    format = true,
    dir = 'auto',
    style,
    ...rest
}) {
    const mergedClassName = ['app-text', className].filter(Boolean).join(' ') || undefined;

    return (
        <Component dir={dir} className={mergedClassName} style={style} {...rest}>
            {formatBiDiChildren(children, format)}
        </Component>
    );
}
