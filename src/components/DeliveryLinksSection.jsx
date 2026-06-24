import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdDeliveryDining } from 'react-icons/md';
import { FaEdit, FaSave, FaPlus, FaTrash, FaSync, FaExternalLinkAlt } from 'react-icons/fa';
import {
  MAX_DELIVERY_LINKS,
  resolveDeliveryLinkFromUrl,
  createEmptyDeliveryLinkRow,
  deliveryLinksReadyToSave } from
'../utils/deliveryLinkMeta';
import { getBusinessSubscriptionAccess } from '../utils/businessSubscription';
import { AppText, AppTextInput } from "./base";

const cardStyle = {
  background: 'var(--bg-card)',
  borderRadius: 'var(--profile-card-radius, 20px)',
  padding: '1.5rem',
  margin: 0,
  border: '1px solid var(--border-color)',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
};

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '10px',
  border: '2px solid var(--border-color)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-main)',
  fontSize: '0.9rem',
  fontFamily: 'inherit',
  boxSizing: 'border-box'
};

function LinkBrandMark({ link, size = 38 }) {
  const bg = link.color || 'var(--primary)';
  if (link.icon) {
    return (
      <div
        style={{
          background: bg,
          borderRadius: '10px',
          padding: '5px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: size + 20,
          height: size,
          flexShrink: 0
        }}>
        
                <img
          src={link.icon}
          alt=""
          style={{
            maxHeight: size - 12,
            maxWidth: 72,
            objectFit: 'contain',
            filter: link.icon.includes('simpleicons') ? 'brightness(0) invert(1)' : 'none'
          }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }} />
        
            </div>);

  }
  return (
    <div
      style={{
        background: bg,
        borderRadius: '10px',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.25rem',
        flexShrink: 0
      }}>
      
            {link.emoji || '🔗'}
        </div>);

}

const DeliveryLinksSection = ({
  business,
  isOwner,
  deliveryLinks,
  tempDeliveryLinks,
  setTempDeliveryLinks,
  editingDeliveryLinks,
  setEditingDeliveryLinks,
  onSave,
  onCancel
}) => {
  const { t } = useTranslation();
  const [fetchingId, setFetchingId] = useState(null);

  const isPaid = getBusinessSubscriptionAccess(business?.subscriptionTier).isPaid;
  const savedLinks = deliveryLinksReadyToSave(deliveryLinks);
  const hasAnyLink = savedLinks.length > 0;

  if (!isOwner && (!hasAnyLink || !isPaid)) return null;

  const updateRow = (id, patch) => {
    setTempDeliveryLinks((rows) => rows.map((r) => r.id === id ? { ...r, ...patch } : r));
  };

  const removeRow = (id) => {
    setTempDeliveryLinks((rows) => rows.filter((r) => r.id !== id));
  };

  const addRow = () => {
    setTempDeliveryLinks((rows) => {
      if (rows.length >= MAX_DELIVERY_LINKS) return rows;
      return [...rows, createEmptyDeliveryLinkRow()];
    });
  };

  const handleFetchMeta = async (row) => {
    const url = String(row.url || '').trim();
    if (!url) {
      return { ok: false };
    }
    setFetchingId(row.id);
    try {
      const resolved = resolveDeliveryLinkFromUrl(url);
      if (!resolved.ok) return resolved;
      updateRow(row.id, {
        name: resolved.name,
        icon: resolved.icon,
        color: resolved.color,
        gradient: resolved.gradient,
        emoji: resolved.emoji
      });
      return resolved;
    } finally {
      setFetchingId(null);
    }
  };

  const startEditing = () => {
    setTempDeliveryLinks(
      savedLinks.length > 0 ?
      savedLinks.map((l) => ({ ...l })) :
      [createEmptyDeliveryLinkRow()]
    );
    setEditingDeliveryLinks(true);
  };

  const displayLinks = savedLinks;

  return (
    <div style={cardStyle}>
            <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
        
                <AppText as="h3"
        style={{
          fontSize: '1.25rem',
          fontWeight: '800',
          color: 'var(--text-main)',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          
                    <MdDeliveryDining style={{ fontSize: '1.5rem', color: 'var(--primary)' }} />
                    {t('order_online', 'Order Online')}
                </AppText>

                {isOwner && !editingDeliveryLinks &&
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                            <AppText as="span"
            title="Professional Plan"
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: 20,
              border: '1px solid #8b5cf6',
              color: '#a78bfa',
              background: 'rgba(139,92,246,0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              whiteSpace: 'nowrap'
            }}>
              
                                ⚡ Pro
                            </AppText>
                            <AppText as="span"
            title="Elite Plan"
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: 20,
              border: '1px solid #f59e0b',
              color: '#fbbf24',
              background: 'rgba(245,158,11,0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              whiteSpace: 'nowrap'
            }}>
              
                                👑 Elite
                            </AppText>
                        </div>
                        <button
            type="button"
            onClick={startEditing}
            title={t('edit_delivery_links', 'Edit delivery links')}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
              cursor: 'pointer',
              border: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              transition: 'all 0.2s'
            }}>
            
                            <FaEdit size={16} />
                        </button>
                    </div>
        }
            </div>

            {editingDeliveryLinks && isOwner &&
      <div>
                    <AppText as="p" style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                        {t(
            'delivery_links_edit_hint',
            'Paste any delivery link, then tap Fetch to detect the service name and icon. Up to {{max}} links.',
            { max: MAX_DELIVERY_LINKS }
          )}
                    </AppText>

                    <div style={{ display: 'grid', gap: '1rem', marginBottom: '1rem' }}>
                        {tempDeliveryLinks.map((row, index) =>
          <div
            key={row.id}
            style={{
              padding: '12px',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)'
            }}>
            
                                <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
                gap: '8px'
              }}>
              
                                    <AppText as="span" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                        {t('delivery_link_number', 'Link {{n}}', { n: index + 1 })}
                                    </AppText>
                                    {tempDeliveryLinks.length > 1 &&
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                aria-label={t('remove_link', 'Remove link')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-danger, #ef4444)',
                  cursor: 'pointer',
                  padding: '4px'
                }}>
                
                                            <FaTrash size={14} />
                                        </button>
              }
                                </div>

                                <AppTextInput
              type="url"
              value={row.url}
              onChange={(e) => updateRow(row.id, { url: e.target.value })}
              placeholder={t(
                'delivery_link_url_placeholder',
                'https://example.com/your-restaurant'
              )}
              style={{ ...inputStyle, marginBottom: '8px' }} />
            

                                <button
              type="button"
              className="ui-btn ui-btn--primary delivery-link-fetch-btn"
              disabled={fetchingId === row.id || !String(row.url || '').trim()}
              onClick={() => void handleFetchMeta(row)}
              style={{
                width: '100%',
                marginBottom: row.name ? '10px' : 0,
                fontSize: '0.88rem',
                cursor: fetchingId === row.id ? 'wait' : 'pointer',
                opacity: !String(row.url || '').trim() ? 0.55 : 1
              }}>
              
                                    <FaSync
                style={
                fetchingId === row.id ?
                { animation: 'spin 0.8s linear infinite' } :
                undefined
                } />
              
                                    {fetchingId === row.id ?
              t('fetching', 'Fetching…') :
              t('delivery_link_fetch', 'Fetch name & icon')}
                                </button>

                                {row.name &&
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginTop: '10px',
                padding: '10px',
                borderRadius: '10px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)'
              }}>
              
                                        <LinkBrandMark link={row} size={36} />
                                        <AppTextInput
                type="text"
                value={row.name}
                onChange={(e) => updateRow(row.id, { name: e.target.value })}
                placeholder={t('delivery_link_name_placeholder', 'Display name')}
                style={{ ...inputStyle, flex: 1, margin: 0 }} />
              
                                    </div>
            }
                            </div>
          )}
                    </div>

                    {tempDeliveryLinks.length < MAX_DELIVERY_LINKS &&
        <button
          type="button"
          onClick={addRow}
          style={{
            width: '100%',
            padding: '12px',
            marginBottom: '1rem',
            borderRadius: '12px',
            border: '2px dashed var(--border-color)',
            background: 'transparent',
            color: 'var(--text-main)',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
          
                            <FaPlus size={12} />
                            {t('add_delivery_link', 'Add another link')}
                        </button>
        }

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '10px 20px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
            
                            {t('cancel', 'Cancel')}
                        </button>
                        <button
            type="button"
            className="ui-btn ui-btn--primary"
            onClick={onSave}
            style={{
              padding: '10px 20px',
              fontWeight: '600'
            }}>
            
                            <FaSave style={{ fontSize: '1rem' }} />
                            {t('save_links', 'Save Links')}
                        </button>
                    </div>
                </div>
      }

            {!editingDeliveryLinks &&
      <>
                    {displayLinks.length === 0 && isOwner &&
        <AppText as="p" style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            {t('delivery_links_empty_owner', 'Add delivery links so customers can order from your profile.')}
                        </AppText>
        }
                    {displayLinks.length > 0 &&
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px'
          }}>
          
                            {displayLinks.map((link) => {
            const href = link.url.startsWith('http') ? link.url : `https://${link.url}`;
            const bg =
            link.gradient ||
            `linear-gradient(135deg, ${link.color || 'var(--primary)'}, var(--primary-hover, var(--primary)))`;

            const inner =
            <>
                                        <LinkBrandMark link={link} size={38} />
                                        <AppText as="span" style={{ fontWeight: 700 }}>{link.name}</AppText>
                                        {!isPaid &&
              <div
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '8px',
                  fontSize: '0.7rem',
                  background: 'rgba(0,0,0,0.3)',
                  padding: '2px 6px',
                  borderRadius: '6px',
                  backdropFilter: 'blur(4px)'
                }}>
                
                                                🔒 {t('locked', 'Locked')}
                                            </div>
              }
                                    </>;


            const commonStyles = {
              background: bg,
              color: 'white',
              padding: '16px 20px',
              borderRadius: '12px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              boxShadow: `0 4px 12px color-mix(in srgb, ${link.color || 'var(--primary)'} 35%, transparent)`,
              transition: 'all 0.3s ease',
              textAlign: 'center',
              minHeight: '60px',
              position: 'relative',
              cursor: isPaid ? 'pointer' : 'not-allowed',
              opacity: isPaid ? 1 : 0.6
            };

            if (isPaid) {
              return (
                <a
                  key={link.id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={commonStyles}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}>
                  
                                            {inner}
                                            <FaExternalLinkAlt style={{ fontSize: '0.75rem', opacity: 0.85 }} />
                                        </a>);

            }

            return (
              <div
                key={link.id}
                title={t('delivery_links_upgrade', 'Upgrade to Pro to unlock delivery links')}
                style={commonStyles}>
                
                                        {inner}
                                    </div>);

          })}
                        </div>
        }
                </>
      }
        </div>);

};

export default DeliveryLinksSection;