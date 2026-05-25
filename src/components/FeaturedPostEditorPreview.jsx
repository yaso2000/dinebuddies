import React, { useEffect, useRef } from 'react';
import { getBackgroundStyle } from './FeaturedPostSlideCard';
import { pickSafeDisplayImageUrl } from '../utils/avatarUtils';

function EditableBlock({
    tag: Tag,
    className,
    value,
    placeholder,
    style,
    maxLength,
    onChange,
    isActive,
    onFocus,
    onBlur,
}) {
    const ref = useRef(null);

    useEffect(() => {
        const el = ref.current;
        if (!el || document.activeElement === el) return;
        const next = value || '';
        if (el.textContent !== next) el.textContent = next;
    }, [value]);

    const handleInput = (e) => {
        const el = e.currentTarget;
        let text = el.textContent || '';
        if (text.length > maxLength) {
            text = text.slice(0, maxLength);
            el.textContent = text;
        }
        onChange(text);
    };

    return (
        <Tag
            ref={ref}
            className={`${className}${isActive ? ' is-focused' : ''}${!String(value || '').trim() ? ' is-empty' : ''}`}
            contentEditable
            suppressContentEditableWarning
            style={style}
            data-placeholder={placeholder}
            onInput={handleInput}
            onFocus={onFocus}
            onBlur={(e) => {
                onChange(e.currentTarget.textContent || '');
                onBlur?.(e);
            }}
        />
    );
}

/**
 * Featured post editor canvas — title + description edited directly on the slide.
 */
export default function FeaturedPostEditorPreview({
    title = '',
    description = '',
    onTitleChange,
    onDescriptionChange,
    titleStyle,
    descStyle,
    background,
    activeField = 'title',
    onFocusField,
    onTextFocus,
    onTextBlur,
    titlePlaceholder = 'اكتب العنوان هنا',
    descPlaceholder = 'اكتب الوصف هنا (اختياري)',
    /** Extra vertical padding for top camera + bottom gradient rails */
    withOverlayChrome = false,
}) {
    const bgStyle = getBackgroundStyle(background);

    const titleCss = {
        fontFamily: titleStyle?.fontFamily || '"Cairo", sans-serif',
        fontSize: titleStyle?.fontSize ? `${titleStyle.fontSize}px` : '1.35rem',
        fontWeight: titleStyle?.fontWeight === 'bold' ? 700 : 400,
        fontStyle: titleStyle?.fontStyle === 'italic' ? 'italic' : 'normal',
        color: titleStyle?.color || '#fff',
        textAlign: titleStyle?.textAlign || 'center',
        textShadow: '0 2px 12px rgba(0,0,0,0.45)',
    };

    const descCss = {
        fontFamily: descStyle?.fontFamily || '"Cairo", sans-serif',
        fontSize: descStyle?.fontSize ? `${descStyle.fontSize}px` : '0.9rem',
        fontWeight: descStyle?.fontWeight === 'bold' ? 700 : 400,
        fontStyle: descStyle?.fontStyle === 'italic' ? 'italic' : 'normal',
        color: descStyle?.color || 'rgba(255,255,255,0.92)',
        textAlign: descStyle?.textAlign || 'center',
        textShadow: '0 1px 8px rgba(0,0,0,0.4)',
    };

    const imageBg =
        background?.type === 'image' && background?.value
            ? pickSafeDisplayImageUrl(background.value)
            : null;

    return (
        <div
            className={`fp-editor-preview${withOverlayChrome ? ' fp-editor-preview--overlay-chrome' : ''}`}
            style={{ containerType: 'inline-size' }}
        >
            <div className="fp-editor-preview__bg" style={imageBg ? undefined : bgStyle} aria-hidden>
                {imageBg ? (
                    <img src={imageBg} alt="" className="fp-editor-preview__bg-img" />
                ) : null}
            </div>
            <div className="fp-editor-preview__scrim" aria-hidden />
            <div
                className="fp-editor-preview__content"
                style={{ alignItems: titleStyle?.textAlign === 'left' ? 'flex-start' : titleStyle?.textAlign === 'right' ? 'flex-end' : 'center' }}
            >
                <EditableBlock
                    tag="h2"
                    className="fp-editor-preview__title"
                    value={title}
                    placeholder={titlePlaceholder}
                    style={titleCss}
                    maxLength={120}
                    onChange={onTitleChange}
                    isActive={activeField === 'title'}
                    onFocus={() => {
                        onFocusField?.('title');
                        onTextFocus?.();
                    }}
                    onBlur={onTextBlur}
                />
                <EditableBlock
                    tag="p"
                    className="fp-editor-preview__desc"
                    value={description}
                    placeholder={descPlaceholder}
                    style={descCss}
                    maxLength={400}
                    onChange={onDescriptionChange}
                    isActive={activeField === 'description'}
                    onFocus={() => {
                        onFocusField?.('description');
                        onTextFocus?.();
                    }}
                    onBlur={onTextBlur}
                />
            </div>
        </div>
    );
}
