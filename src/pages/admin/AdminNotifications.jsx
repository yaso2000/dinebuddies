import React, { useState, useEffect, useRef } from 'react';
import { FaPaperPlane, FaHistory, FaEnvelope, FaSearch, FaExclamationTriangle } from 'react-icons/fa';
import { adminSecurityService } from '../../services/adminSecurityService';
import { searchNominatimCities, nominatimCityToLatLngRadius } from '../../utils/osmPhotonSearch';
import { PLACES_AUTOCOMPLETE_DEBOUNCE_MS } from '../../utils/placesCostControl';

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
    const [citySearchInput, setCitySearchInput] = useState('');
    const [citySuggestions, setCitySuggestions] = useState([]);
    const [citySearchLoading, setCitySearchLoading] = useState(false);

    const [emailsText, setEmailsText] = useState('');
    const [namePrefix, setNamePrefix] = useState('');

    const [emailSubject, setEmailSubject] = useState('');
    const [emailHtml, setEmailHtml] = useState('');
    const [emailBusy, setEmailBusy] = useState(false);
    const [preview, setPreview] = useState(null);
    const [emailResult, setEmailResult] = useState(null);

    const citySearchDebounceRef = useRef(null);
    const citySearchGenRef = useRef(0);

    useEffect(() => {
        if (audienceMode !== 'filters') return undefined;
        if (citySearchDebounceRef.current) clearTimeout(citySearchDebounceRef.current);
        const q = citySearchInput.trim();
        if (q.length < 2) {
            setCitySuggestions([]);
            setCitySearchLoading(false);
            return undefined;
        }
        citySearchGenRef.current += 1;
        const gen = citySearchGenRef.current;
        setCitySearchLoading(true);
        citySearchDebounceRef.current = setTimeout(() => {
            citySearchDebounceRef.current = null;
            searchNominatimCities(q, countryCode)
                .then((rows) => {
                    if (gen !== citySearchGenRef.current) return;
                    setCitySuggestions(rows);
                })
                .catch(() => {
                    if (gen === citySearchGenRef.current) setCitySuggestions([]);
                })
                .finally(() => {
                    if (gen === citySearchGenRef.current) setCitySearchLoading(false);
                });
        }, PLACES_AUTOCOMPLETE_DEBOUNCE_MS);
        return () => {
            if (citySearchDebounceRef.current) clearTimeout(citySearchDebounceRef.current);
        };
    }, [audienceMode, citySearchInput, countryCode]);

    const handlePickCitySuggestion = (s) => {
        const r = nominatimCityToLatLngRadius(s.nominatim);
        if (r) {
            setGeoLat(r.lat.toFixed(6));
            setGeoLng(r.lng.toFixed(6));
            setGeoRadiusKm(String(r.radiusKm));
            setCityResolvedLabel(s.description || s.main_text || '');
            setCitySearchInput(s.main_text || '');
        }
        setCitySuggestions([]);
        setMapsNote(null);
    };

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
                            Optional: pick a <strong>city / region</strong> (OpenStreetMap / Nominatim). We fill center + estimated radius; you can edit numbers.
                        </p>
                        <div className="admin-mb-2" style={{ maxWidth: '100%', position: 'relative' }}>
                            <label className="admin-label">City or area (OpenStreetMap)</label>
                            <input
                                className="admin-input"
                                type="text"
                                autoComplete="off"
                                value={citySearchInput}
                                onChange={(e) => setCitySearchInput(e.target.value)}
                                placeholder="Type e.g. Sydney, Melbourne…"
                                onFocus={() => setMapsNote(null)}
                            />
                            {citySearchLoading && (
                                <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>Searching…</p>
                            )}
                            {citySuggestions.length > 0 && (
                                <ul
                                    style={{
                                        listStyle: 'none',
                                        margin: '6px 0 0',
                                        padding: 0,
                                        border: '1px solid var(--admin-border, #334155)',
                                        borderRadius: 8,
                                        maxHeight: 200,
                                        overflowY: 'auto',
                                        background: 'var(--admin-bg, #0f172a)',
                                        zIndex: 10,
                                    }}
                                >
                                    {citySuggestions.map((s) => (
                                        <li
                                            key={s.place_id}
                                            onClick={() => handlePickCitySuggestion(s)}
                                            style={{
                                                padding: '8px 12px',
                                                cursor: 'pointer',
                                                fontSize: '0.85rem',
                                                borderBottom: '1px solid rgba(148,163,184,0.2)',
                                            }}
                                        >
                                            <strong>{s.main_text}</strong>
                                            <div style={{ opacity: 0.8, fontSize: '0.75rem' }}>{s.secondary_text}</div>
                                        </li>
                                    ))}
                                </ul>
                            )}
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
