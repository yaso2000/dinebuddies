import React, { useState, useEffect, useRef } from 'react';
import { FaPaperPlane, FaHistory, FaEnvelope, FaSearch, FaExclamationTriangle } from 'react-icons/fa';
import { adminSecurityService } from '../../services/adminSecurityService';
import { loadGoogleMapsScript, isGoogleMapsKeyConfigured } from '../../utils/loadGoogleMaps';

function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const AdminNotifications = () => {
    const [targetId, setTargetId] = useState('');
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);

    const [audienceMode, setAudienceMode] = useState('filters');
    const [roleFilter, setRoleFilter] = useState('all');
    const [countryCode, setCountryCode] = useState('');
    const [geoLat, setGeoLat] = useState('');
    const [geoLng, setGeoLng] = useState('');
    const [geoRadiusKm, setGeoRadiusKm] = useState('');
    const [cityResolvedLabel, setCityResolvedLabel] = useState('');
    const [mapsNote, setMapsNote] = useState(null);

    const [emailsText, setEmailsText] = useState('');
    const [namePrefix, setNamePrefix] = useState('');

    const [emailSubject, setEmailSubject] = useState('');
    const [emailHtml, setEmailHtml] = useState('');
    const [emailBusy, setEmailBusy] = useState(false);
    const [preview, setPreview] = useState(null);
    const [emailResult, setEmailResult] = useState(null);

    const cityInputRef = useRef(null);
    const autocompleteRef = useRef(null);

    useEffect(() => {
        if (audienceMode !== 'filters') return;
        if (!isGoogleMapsKeyConfigured()) {
            setMapsNote('Add VITE_GOOGLE_MAPS_API_KEY to enable city search (same key as the app). You can still enter lat / lng manually.');
            return;
        }
        let cancelled = false;
        loadGoogleMapsScript()
            .then(() => {
                if (cancelled || !cityInputRef.current || !window.google?.maps?.places) return;
                const ac = new window.google.maps.places.Autocomplete(cityInputRef.current, {
                    types: ['(cities)'],
                    fields: ['geometry', 'formatted_address', 'name'],
                });
                autocompleteRef.current = ac;
                ac.addListener('place_changed', () => {
                    const place = ac.getPlace();
                    const loc = place.geometry?.location;
                    if (!loc) return;
                    const lat = loc.lat();
                    const lng = loc.lng();
                    let radiusKm = 35;
                    const vp = place.geometry?.viewport;
                    if (vp) {
                        const ne = vp.getNorthEast();
                        const sw = vp.getSouthWest();
                        const d = haversineKm(ne.lat(), ne.lng(), sw.lat(), sw.lng());
                        radiusKm = Math.min(100, Math.max(12, (d / 2) * 1.15));
                    }
                    setGeoLat(lat.toFixed(6));
                    setGeoLng(lng.toFixed(6));
                    setGeoRadiusKm(String(Math.round(radiusKm)));
                    setCityResolvedLabel(place.formatted_address || place.name || '');
                });
            })
            .catch((e) => {
                if (e?.message === 'API_KEY_NOT_SET') {
                    setMapsNote('Google Maps key not set — enter coordinates manually or add VITE_GOOGLE_MAPS_API_KEY.');
                }
            });
        return () => {
            cancelled = true;
            if (autocompleteRef.current && window.google?.maps?.event) {
                window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
                autocompleteRef.current = null;
            }
        };
    }, [audienceMode]);

    const buildGeoPayload = () => {
        const lat = parseFloat(geoLat);
        const lng = parseFloat(geoLng);
        const r = parseFloat(geoRadiusKm);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(r) || r <= 0) return null;
        return { lat, lng, radiusKm: r };
    };

    const buildEmailAudiencePayload = () => {
        if (audienceMode === 'explicit_emails') {
            return { audienceMode: 'explicit_emails', emailsText };
        }
        if (audienceMode === 'name_prefix') {
            return { audienceMode: 'name_prefix', namePrefix: namePrefix.trim() };
        }
        const payload = { audienceMode: 'filters', roleFilter };
        const cc = countryCode.trim().toUpperCase().slice(0, 2);
        if (cc.length === 2) payload.countryCode = cc;
        const geo = buildGeoPayload();
        if (geo) payload.geo = geo;
        return payload;
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!targetId.trim() || !title.trim() || !message.trim()) {
            setResult({ ok: false, message: 'Fill target, title and message.' });
            return;
        }
        setSending(true);
        setResult(null);
        try {
            await adminSecurityService.createNotification({
                userId: targetId.trim(),
                type: 'message',
                title: title.trim().slice(0, 120),
                message: message.trim().slice(0, 500),
            });
            setResult({ ok: true, message: 'Notification sent.' });
            setTitle('');
            setMessage('');
        } catch (err) {
            setResult({ ok: false, message: err?.message || 'Failed.' });
        } finally {
            setSending(false);
        }
    };

    const handlePreviewEmail = async () => {
        setEmailBusy(true);
        setPreview(null);
        setEmailResult(null);
        try {
            const data = await adminSecurityService.previewEmailCampaign(buildEmailAudiencePayload());
            setPreview(data);
        } catch (err) {
            setEmailResult({ ok: false, message: err?.message || 'Preview failed.' });
        } finally {
            setEmailBusy(false);
        }
    };

    const handleSendEmail = async () => {
        if (!emailSubject.trim() || !emailHtml.trim()) {
            setEmailResult({ ok: false, message: 'Subject and HTML body are required.' });
            return;
        }
        if (!window.confirm('Send this email campaign via Resend with the selected audience?')) return;
        setEmailBusy(true);
        setEmailResult(null);
        try {
            const data = await adminSecurityService.sendEmailCampaign({
                ...buildEmailAudiencePayload(),
                subject: emailSubject.trim().slice(0, 200),
                html: emailHtml,
            });
            setEmailResult({
                ok: true,
                message: `Sent: ${data.sent ?? 0}. Scanned: ${data.scanned ?? '—'}.`,
                data,
            });
        } catch (err) {
            setEmailResult({ ok: false, message: err?.message || 'Send failed.' });
        } finally {
            setEmailBusy(false);
        }
    };

    return (
        <div>
            <div className="admin-page-header">
                <h1 className="admin-page-title">Notifications & email</h1>
                <p className="admin-page-subtitle">
                    In-app (one user) and Resend campaigns. Audience: filters (role / country / map), explicit emails, or display-name prefix.
                </p>
            </div>

            <div className="admin-card admin-mb-4" style={{ borderLeft: '3px solid #6366f1' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaEnvelope /> Email campaign (Resend)
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', marginBottom: '1rem' }}>
                    Set <code style={{ fontSize: '0.85em' }}>RESEND_API_KEY</code> on Cloud Functions. Verified domain: use a matching &quot;From&quot; in Resend.
                </p>

                <div className="admin-mb-3">
                    <label className="admin-label">Audience</label>
                    <select className="admin-select" style={{ maxWidth: 420 }} value={audienceMode} onChange={(e) => setAudienceMode(e.target.value)}>
                        <option value="filters">Filters — role, country, optional area on map</option>
                        <option value="explicit_emails">Explicit list — paste emails (must exist in Firestore)</option>
                        <option value="name_prefix">Display name — prefix search (same rules as user search)</option>
                    </select>
                </div>

                {audienceMode === 'explicit_emails' && (
                    <div className="admin-mb-3">
                        <label className="admin-label">Email addresses (space, comma, or line)</label>
                        <textarea
                            className="admin-input"
                            rows={5}
                            value={emailsText}
                            onChange={(e) => setEmailsText(e.target.value)}
                            placeholder="a@x.com&#10;b@y.com"
                            style={{ resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}
                        />
                        <p style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: 6 }}>
                            Only accounts that exist in <code>users</code> with this email (or authEmail) receive mail. Others are skipped.
                        </p>
                    </div>
                )}

                {audienceMode === 'name_prefix' && (
                    <div className="admin-mb-3">
                        <label className="admin-label">Start of display name</label>
                        <input
                            className="admin-input"
                            style={{ maxWidth: 400 }}
                            value={namePrefix}
                            onChange={(e) => setNamePrefix(e.target.value)}
                            placeholder="e.g. Sam"
                        />
                        <p style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: 6 }}>
                            Firestore ordering is case-sensitive. Max ~{400} matches. Combine with a short prefix if needed.
                        </p>
                    </div>
                )}

                {audienceMode === 'filters' && (
                    <>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                gap: '0.75rem',
                                marginBottom: '1rem',
                            }}
                        >
                            <div>
                                <label className="admin-label">Account type</label>
                                <select className="admin-select" style={{ width: '100%' }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                                    <option value="all">All roles</option>
                                    <option value="user">Consumers (role: user)</option>
                                    <option value="business">Business</option>
                                    <option value="staff">Staff / support / admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="admin-label">Country (ISO2, optional)</label>
                                <input
                                    className="admin-input"
                                    placeholder="e.g. AU"
                                    maxLength={2}
                                    value={countryCode}
                                    onChange={(e) => setCountryCode(e.target.value)}
                                />
                            </div>
                        </div>

                        <p style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', marginBottom: '0.5rem' }}>
                            Optional: pick a <strong>city / region</strong> from Google (autocomplete). We fill center + estimated radius; you can edit numbers.
                        </p>
                        <div className="admin-mb-2" style={{ maxWidth: '100%' }}>
                            <label className="admin-label">City or area (Google Maps)</label>
                            <input
                                ref={cityInputRef}
                                className="admin-input"
                                type="text"
                                autoComplete="off"
                                placeholder="Type e.g. Sydney, Melbourne…"
                                onFocus={() => setMapsNote(null)}
                            />
                            {cityResolvedLabel ? (
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 6 }}>Selected: {cityResolvedLabel}</p>
                            ) : null}
                            {mapsNote ? (
                                <p style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: 6 }}>{mapsNote}</p>
                            ) : null}
                        </div>

                        <p style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', marginBottom: '0.5rem' }}>
                            Or set the circle manually (users need stored coordinates):
                        </p>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                gap: '0.75rem',
                                marginBottom: '1rem',
                            }}
                        >
                            <div>
                                <label className="admin-label">Center lat</label>
                                <input className="admin-input" type="text" value={geoLat} onChange={(e) => setGeoLat(e.target.value)} placeholder="-33.86" />
                            </div>
                            <div>
                                <label className="admin-label">Center lng</label>
                                <input className="admin-input" type="text" value={geoLng} onChange={(e) => setGeoLng(e.target.value)} placeholder="151.20" />
                            </div>
                            <div>
                                <label className="admin-label">Radius (km)</label>
                                <input className="admin-input" type="text" value={geoRadiusKm} onChange={(e) => setGeoRadiusKm(e.target.value)} placeholder="50" />
                            </div>
                        </div>
                    </>
                )}

                <div className="admin-mb-2">
                    <label className="admin-label">Subject</label>
                    <input className="admin-input" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} maxLength={200} />
                </div>
                <div className="admin-mb-2">
                    <label className="admin-label">HTML body</label>
                    <textarea
                        className="admin-input"
                        rows={8}
                        value={emailHtml}
                        onChange={(e) => setEmailHtml(e.target.value)}
                        placeholder="<p>Hello …</p>"
                        style={{ resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}
                    />
                </div>

                <div className="admin-flex admin-gap-2" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                    <button type="button" className="admin-btn admin-btn-secondary" disabled={emailBusy} onClick={handlePreviewEmail}>
                        <FaSearch /> Preview audience
                    </button>
                    <button type="button" className="admin-btn admin-btn-primary" disabled={emailBusy} onClick={handleSendEmail}>
                        {emailBusy ? '…' : 'Send email campaign'}
                    </button>
                </div>

                {preview && (
                    <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: 'var(--admin-radius-sm)', background: 'rgba(99,102,241,0.08)', fontSize: '0.875rem' }}>
                        <strong>Mode:</strong> {preview.audienceMode ?? '—'}
                        <br />
                        <strong>Matches:</strong> {preview.matchCount ?? '—'}
                        <br />
                        <strong>User docs scanned:</strong> {preview.scanned ?? '—'}
                        {preview.scanTruncated ? (
                            <span>
                                {' '}
                                <FaExclamationTriangle style={{ display: 'inline', color: '#f59e0b' }} /> (scan cap — count may be incomplete)
                            </span>
                        ) : null}
                        {typeof preview.emailsNotFoundInDatabase === 'number' && preview.emailsNotFoundInDatabase > 0 ? (
                            <div style={{ marginTop: '0.5rem', color: '#f59e0b' }}>
                                Emails in list not found as accounts: ~{preview.emailsNotFoundInDatabase}
                            </div>
                        ) : null}
                        {preview.sampleEmails?.length ? (
                            <div style={{ marginTop: '0.5rem' }}>
                                <strong>Sample emails:</strong> {preview.sampleEmails.join(', ')}
                            </div>
                        ) : null}
                    </div>
                )}

                {emailResult && (
                    <div
                        style={{
                            marginTop: '0.75rem',
                            padding: '0.75rem',
                            borderRadius: 'var(--admin-radius-sm)',
                            background: emailResult.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            color: emailResult.ok ? 'var(--admin-success)' : 'var(--admin-danger)',
                            fontSize: '0.875rem',
                        }}
                    >
                        {emailResult.message}
                    </div>
                )}
            </div>

            <div className="admin-card admin-mb-4">
                <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaPaperPlane /> In-app notification (one user)
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', marginBottom: '1rem' }}>
                    Creates a row in the user&apos;s in-app notifications feed (same as other app notifications).
                </p>
                <form onSubmit={handleSend} style={{ maxWidth: '480px' }}>
                    <div className="admin-mb-2">
                        <label className="admin-label">Target user ID (Firebase UID)</label>
                        <input type="text" className="admin-input" value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="User UID" required />
                    </div>
                    <div className="admin-mb-2">
                        <label className="admin-label">Title</label>
                        <input type="text" className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={120} required />
                    </div>
                    <div className="admin-mb-2">
                        <label className="admin-label">Message</label>
                        <textarea className="admin-input" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message" rows={3} maxLength={500} required style={{ resize: 'vertical' }} />
                    </div>
                    {result && (
                        <div className="admin-mb-2" style={{ padding: '0.75rem', borderRadius: 'var(--admin-radius-sm)', background: result.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: result.ok ? 'var(--admin-success)' : 'var(--admin-danger)', fontSize: '0.875rem' }}>
                            {result.message}
                        </div>
                    )}
                    <button type="submit" className="admin-btn admin-btn-primary" disabled={sending}>
                        {sending ? 'Sending…' : 'Send to user'}
                    </button>
                </form>
            </div>

            <div className="admin-card">
                <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaHistory /> Campaign log
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)' }}>
                    Sent campaigns are appended to Firestore <code>admin_email_campaigns</code> (server-side only).
                </p>
            </div>
        </div>
    );
};

export default AdminNotifications;
