const fs = require('fs');
const file = 'src/pages/business-pro/ExportAssets.jsx';
const content = fs.readFileSync(file, 'utf8');

const marker = '// ─── Main Export Assets';
const index = content.indexOf(marker);
if (index === -1) {
    console.error('Marker not found');
    process.exit(1);
}

const prefix = content.slice(0, index);

const newComponent = `// ─── Main Export Assets ───────
const ExportAssets = ({ onBack }) => {
    const { currentUser, userProfile } = useAuth();
    const businessCardRef = useRef(null);
    const flyerRef = useRef(null);
    const [exporting, setExporting] = useState(null);
    const [qrDataUrl, setQrDataUrl] = useState('');

    const [cardTemplateId, setCardTemplateId] = useState('1');
    const [flyerTemplateId, setFlyerTemplateId] = useState('1');

    const brandKit = userProfile?.businessInfo?.brandKit || {};
    const currentTheme = BUSINESS_THEMES.find(t => t.id === userProfile?.businessInfo?.theme) || BUSINESS_THEMES[0];
    const primaryColor = brandKit.primaryColor || currentTheme?.colors?.accent || '#a78bfa';
    const isElite = (userProfile?.subscriptionTier || 'free').toLowerCase() === 'elite';
    const fontFamily = userProfile?.businessInfo?.brandKit?.fontFamily || 'sans-serif';

    const defaultName = userProfile?.businessInfo?.businessName || userProfile?.display_name || 'Business';
    const defaultTagline = userProfile?.businessInfo?.cuisine || userProfile?.businessInfo?.category || 'DineBuddies Partner';

    const biz = userProfile?.businessInfo || {};
    const contactEmail = biz.email || '';
    const contactPhone = biz.phone || '';
    const contactWebsite = biz.website || '';
    const contactAddress = biz.address || '';

    const profileUrl = currentUser?.uid ? \`\${window.location.origin}/business/\${currentUser.uid}\` : '';
    useEffect(() => {
        if (!profileUrl) return;
        QRCode.toDataURL(profileUrl, { width: 256, margin: 1 }).then(setQrDataUrl).catch(() => setQrDataUrl(''));
    }, [profileUrl]);

    const logo = getSafeAvatar(userProfile);
    const logoFallback = \`https://ui-avatars.com/api/?name=\${encodeURIComponent(defaultName)}&background=7c3aed&color=fff\`;

    const cardBackground = CARD_TEMPLATES.find(t => t.id === cardTemplateId)?.defaultBg || CARD_TEMPLATES[0].defaultBg;
    const flyerBackground = FLYER_TEMPLATES.find(t => t.id === flyerTemplateId)?.defaultBg || FLYER_TEMPLATES[0].defaultBg;

    const isCardLight = cardBackground && (cardBackground.includes('#f') || cardBackground.includes('#e') || cardBackground.includes('#fff'));
    const defaultCardTitleColor = isCardLight ? '#1e293b' : '#ffffff';
    const defaultCardTextColor = isCardLight ? 'rgba(30,41,59,0.65)' : 'rgba(255,255,255,0.6)';
    const cardTitleStyle = { color: defaultCardTitleColor };
    const cardTextStyle = { color: defaultCardTextColor };

    const isFlyerLight = flyerBackground && (flyerBackground.includes('#f') || flyerBackground.includes('#e') || flyerBackground.includes('#fff'));
    const defaultFlyerTitleColor = isFlyerLight ? '#1e293b' : '#ffffff';
    const defaultFlyerTextColor = isFlyerLight ? 'rgba(30,41,59,0.65)' : 'rgba(255,255,255,0.6)';
    const flyerTitleStyle = { color: defaultFlyerTitleColor };
    const flyerTextStyle = { color: defaultFlyerTextColor };

    const handleExportPrintable = async (kind) => {
        const ref = kind === 'flyer-pdf' ? flyerRef : businessCardRef;
        if (!ref?.current) return;
        setExporting(kind);
        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(ref.current, { backgroundColor: null, scale: 2, useCORS: true, logging: false });
            const dataUrl = canvas.toDataURL('image/png');
            const { jsPDF } = await import('jspdf');
            const safeName = (userProfile?.businessInfo?.businessName || userProfile?.display_name || 'business').toLowerCase().replace(/\\s+/g, '-');

            if (kind === 'card-png') {
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = \`\${safeName}-business-card.png\`;
                a.click();
                return;
            }
            if (kind === 'card-pdf') {
                const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                const cardW = 85, cardH = 55, pageW = 210, pageH = 297, cols = 2, rows = 4;
                const startX = (pageW - cols * cardW) / 2, startY = (pageH - rows * cardH) / 2;
                for (let row = 0; row < rows; row++)
                    for (let col = 0; col < cols; col++)
                        doc.addImage(dataUrl, 'PNG', startX + col * cardW, startY + row * cardH, cardW, cardH);
                doc.save(\`\${safeName}-business-cards-8up.pdf\`);
            } else if (kind === 'flyer-pdf') {
                const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
                doc.addImage(dataUrl, 'PNG', 0, 0, 148, 210);
                doc.save(\`\${safeName}-flyer.pdf\`);
            }
        } catch (e) {
            console.error('Printable export error:', e);
        } finally {
            setExporting(null);
        }
    };

    if (!isElite) {
        return (
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#f1f5f9', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.85rem', fontWeight: 600 }}>
                        <FaArrowLeft /> Design Studio
                    </button>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9' }}>Export Assets</span>
                </div>
                <div className="bpro-stat-card" style={{ padding: 32, textAlign: 'center' }}>
                    <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>Business cards and flyers with QR code are available on the <strong style={{ color: '#fbbf24' }}>Elite</strong> plan.</div>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>Upgrade to create printable business cards and flyers linked to your profile.</div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#f1f5f9', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.85rem', fontWeight: 600 }}>
                    <FaArrowLeft /> Design Studio
                </button>
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9' }}>Export Assets</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
                Select a template for your business cards and flyers. Your printable assets are generated automatically from your business profile details.
            </div>

            <style>{\`
                .export-assets-split { display: grid; grid-template-columns: 360px 1fr; gap: 24px; align-items: start; }
                .export-assets-tools { padding-right: 8px; }
                .export-assets-preview { position: sticky; top: 24px; }
                @media (max-width: 900px) {
                    .export-assets-split { grid-template-columns: 1fr !important; }
                    .export-assets-preview { position: static; }
                }
            \`}</style>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                {/* ── Business Cards ── */}
                <div className="bpro-stat-card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <span style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>ELITE</span>
                        <FaIdCard style={{ color: '#fbbf24' }} />
                        <span style={{ fontWeight: 700, color: '#f1f5f9' }}>Business Cards</span>
                    </div>
                    <div className="export-assets-split">
                        <div className="export-assets-tools">
                            <div style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Select Template</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                                {CARD_TEMPLATES.map(t => (
                                    <button key={t.id} type="button" onClick={() => setCardTemplateId(t.id)} style={{ padding: '6px 12px', borderRadius: 8, border: \`1px solid \${cardTemplateId === t.id ? primaryColor : 'rgba(255,255,255,0.2)'}\`, background: cardTemplateId === t.id ? \`\${primaryColor}22\` : 'transparent', color: '#f1f5f9', fontSize: '0.8rem', cursor: 'pointer' }}>{t.name}</button>
                                ))}
                            </div>
                            <div style={{ marginTop: 20, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>Profile Data Included</div>
                                <div style={{ fontSize: '0.8rem', color: '#f1f5f9', marginBottom: 4 }}>• {defaultName}</div>
                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>• {defaultTagline}</div>
                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>• Contact Information</div>
                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>• QR Code Profile Link</div>
                            </div>
                        </div>
                        <div className="export-assets-preview">
                            <div style={{ marginBottom: 8, fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>Preview · 85×55mm</div>
                            <div style={{ display: 'flex', justifyContent: 'center', transform: 'scale(0.82)', transformOrigin: 'top center' }} ref={businessCardRef}>
                                <BusinessCardRender templateId={cardTemplateId} title={defaultName} text={defaultTagline} background={cardBackground} logo={logo} logoFallback={logoFallback} qrDataUrl={qrDataUrl} primaryColor={primaryColor} fontFamily={fontFamily} titleStyle={cardTitleStyle} textStyle={cardTextStyle} email={contactEmail} phone={contactPhone} website={contactWebsite} address={contactAddress} overlay={null} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                                <button onClick={() => handleExportPrintable('card-png')} disabled={!!exporting} className="bpro-btn-primary" style={{ flex: 1, minWidth: 100, justifyContent: 'center', height: 40 }}>{exporting === 'card-png' ? '⏳ Generating...' : <><FaDownload /> Download PNG</>}</button>
                                <button onClick={() => handleExportPrintable('card-pdf')} disabled={!!exporting} className="bpro-btn-primary" style={{ flex: 1, minWidth: 140, justifyContent: 'center', height: 40 }}>{exporting === 'card-pdf' ? '⏳ Generating...' : <><FaDownload /> Download PDF (8/sheet)</>}</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Flyers ── */}
                <div className="bpro-stat-card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <span style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>ELITE</span>
                        <FaNewspaper style={{ color: '#fbbf24' }} />
                        <span style={{ fontWeight: 700, color: '#f1f5f9' }}>Flyers</span>
                    </div>
                    <div className="export-assets-split">
                        <div className="export-assets-tools">
                            <div style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Select Template</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                                {FLYER_TEMPLATES.map(t => (
                                    <button key={t.id} type="button" onClick={() => setFlyerTemplateId(t.id)} style={{ padding: '6px 12px', borderRadius: 8, border: \`1px solid \${flyerTemplateId === t.id ? primaryColor : 'rgba(255,255,255,0.2)'}\`, background: flyerTemplateId === t.id ? \`\${primaryColor}22\` : 'transparent', color: '#f1f5f9', fontSize: '0.8rem', cursor: 'pointer' }}>{t.name}</button>
                                ))}
                            </div>
                            <div style={{ marginTop: 20, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>Profile Data Included</div>
                                <div style={{ fontSize: '0.8rem', color: '#f1f5f9', marginBottom: 4 }}>• {defaultName}</div>
                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>• {defaultTagline}</div>
                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>• Contact Information</div>
                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>• QR Code Profile Link</div>
                            </div>
                        </div>
                        <div className="export-assets-preview">
                            <div style={{ marginBottom: 8, fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>Preview · A5</div>
                            <div style={{ display: 'flex', justifyContent: 'center', maxHeight: 'min(420px, calc(100vh - 220px))', overflow: 'auto', borderRadius: 8 }}>
                                <div ref={flyerRef} style={{ transform: 'scale(0.52)', transformOrigin: 'top center' }}>
                                    <FlyerRender templateId={flyerTemplateId} title={defaultName} text={defaultTagline} background={flyerBackground} logo={logo} logoFallback={logoFallback} qrDataUrl={qrDataUrl} primaryColor={primaryColor} fontFamily={fontFamily} titleStyle={flyerTitleStyle} textStyle={flyerTextStyle} email={contactEmail} phone={contactPhone} website={contactWebsite} address={contactAddress} overlay={null} />
                                </div>
                            </div>
                            <button onClick={() => handleExportPrintable('flyer-pdf')} disabled={!!exporting} className="bpro-btn-primary" style={{ width: '100%', justifyContent: 'center', height: 44, marginTop: 12 }}>{exporting === 'flyer-pdf' ? '⏳ Generating…' : <><FaDownload /> Download Flyer (PDF)</>}</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExportAssets;
`;

fs.writeFileSync(file, prefix + newComponent, 'utf8');
console.log('Successfully updated ExportAssets.jsx');
