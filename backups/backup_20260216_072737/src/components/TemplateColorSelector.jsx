import React, { useState } from 'react';
import { COLOR_SCHEMES, TEMPLATE_STYLES } from '../utils/invitationTemplates';

const TemplateColorSelector = ({ onSelect, selectedTemplate, selectedColor }) => {
    const [activeTab, setActiveTab] = useState('template'); // 'template' or 'color'

    return (
        <div style={{
            background: 'var(--bg-card)',
            borderRadius: '20px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)'
        }}>
            {/* DEBUG BANNER - Remove this later */}
            <div style={{
                background: 'linear-gradient(135deg, #f59e0b, #dc2626)',
                color: 'white',
                padding: '10px',
                borderRadius: '10px',
                marginBottom: '1rem',
                textAlign: 'center',
                fontWeight: '800',
                fontSize: '1rem'
            }}>
                🐛 DEBUG: TemplateColorSelector is RENDERING! ({Object.keys(TEMPLATE_STYLES).length} templates, {Object.keys(COLOR_SCHEMES).length} colors)
            </div>

            {/* Title */}
            <h3 style={{
                fontSize: '1.1rem',
                fontWeight: '800',
                color: 'var(--text-main)',
                marginBottom: '1rem'
            }}>
                🎨 Choose Your Style
            </h3>

            {/* Tab Switcher */}
            <div style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '1.5rem',
                background: 'var(--bg-main)',
                padding: '6px',
                borderRadius: '12px'
            }}>
                <button
                    onClick={() => setActiveTab('template')}
                    style={{
                        flex: 1,
                        padding: '10px',
                        background: activeTab === 'template'
                            ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                            : 'transparent',
                        color: activeTab === 'template' ? 'white' : 'var(--text-main)',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: activeTab === 'template' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
                    }}
                >
                    📐 Template ({Object.keys(TEMPLATE_STYLES).length})
                </button>
                <button
                    onClick={() => setActiveTab('color')}
                    style={{
                        flex: 1,
                        padding: '10px',
                        background: activeTab === 'color'
                            ? 'linear-gradient(135deg, #10b981, #059669)'
                            : 'transparent',
                        color: activeTab === 'color' ? 'white' : 'var(--text-main)',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: activeTab === 'color' ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
                    }}
                >
                    🎨 Color ({Object.keys(COLOR_SCHEMES).length})
                </button>
            </div>

            {/* Template Grid */}
            {activeTab === 'template' && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: '12px'
                }}>
                    {Object.entries(TEMPLATE_STYLES).length > 0 ? (
                        Object.entries(TEMPLATE_STYLES).map(([key, template]) => {
                            console.log('🎨 Rendering template:', key, template);
                            return (
                                <button
                                    key={key}
                                    onClick={() => onSelect({ template: key })}
                                    style={{
                                        background: selectedTemplate === key
                                            ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(29, 78, 216, 0.2))'
                                            : 'var(--bg-main)',
                                        border: selectedTemplate === key
                                            ? '3px solid #3b82f6'
                                            : '2px solid var(--border-color)',
                                        borderRadius: '16px',
                                        padding: '1.25rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        textAlign: 'center',
                                        boxShadow: selectedTemplate === key
                                            ? '0 8px 24px rgba(59, 130, 246, 0.3)'
                                            : '0 4px 12px rgba(0, 0, 0, 0.05)'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (selectedTemplate !== key) {
                                            e.currentTarget.style.transform = 'translateY(-4px)';
                                            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (selectedTemplate !== key) {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
                                        }
                                    }}
                                >
                                    <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
                                        {template.emoji}
                                    </div>
                                    <div style={{
                                        fontSize: '0.9rem',
                                        fontWeight: '800',
                                        color: 'var(--text-main)',
                                        marginBottom: '4px'
                                    }}>
                                        {template.name}
                                    </div>
                                    <div style={{
                                        fontSize: '0.7rem',
                                        color: 'var(--text-muted)',
                                        lineHeight: '1.3'
                                    }}>
                                        {template.description}
                                    </div>
                                </button>
                            );
                        })
                    ) : (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
                            ❌ No templates loaded! Check console for errors.
                        </div>
                    )}
                </div>
            )}

            {/* Color Grid */}
            {activeTab === 'color' && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '12px'
                }}>
                    {Object.entries(COLOR_SCHEMES).map(([key, color]) => (
                        <button
                            key={key}
                            onClick={() => onSelect({ color: key })}
                            style={{
                                background: color.gradient,
                                border: selectedColor === key
                                    ? '4px solid var(--text-main)'
                                    : '2px solid transparent',
                                borderRadius: '16px',
                                padding: '1.25rem 1rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                textAlign: 'center',
                                color: 'white',
                                boxShadow: selectedColor === key
                                    ? `0 12px 32px ${color.shadow}`
                                    : `0 6px 16px ${color.shadow}`,
                                transform: selectedColor === key ? 'scale(1.05)' : 'scale(1)'
                            }}
                            onMouseEnter={(e) => {
                                if (selectedColor !== key) {
                                    e.currentTarget.style.transform = 'scale(1.03)';
                                    e.currentTarget.style.boxShadow = `0 12px 32px ${color.shadow}`;
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (selectedColor !== key) {
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.boxShadow = `0 6px 16px ${color.shadow}`;
                                }
                            }}
                        >
                            <div style={{ fontSize: '2rem', marginBottom: '6px' }}>
                                {color.emoji}
                            </div>
                            <div style={{
                                fontSize: '0.85rem',
                                fontWeight: '800',
                                textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                            }}>
                                {color.name}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Selection Summary */}
            <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: 'var(--bg-main)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
            }}>
                <div style={{
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    color: 'var(--text-main)'
                }}>
                    ✨ Current Selection:
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{
                        padding: '6px 12px',
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(29, 78, 216, 0.15))',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        color: '#3b82f6'
                    }}>
                        {TEMPLATE_STYLES[selectedTemplate]?.emoji} {TEMPLATE_STYLES[selectedTemplate]?.name}
                    </span>
                    <span style={{
                        padding: '6px 12px',
                        background: COLOR_SCHEMES[selectedColor]?.gradient,
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        color: 'white',
                        boxShadow: `0 4px 12px ${COLOR_SCHEMES[selectedColor]?.shadow}`
                    }}>
                        {COLOR_SCHEMES[selectedColor]?.emoji} {COLOR_SCHEMES[selectedColor]?.name}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default TemplateColorSelector;
