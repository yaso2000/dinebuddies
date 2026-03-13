import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { premiumOfferService } from '../services/premiumOfferService';
import PremiumOfferEditor from '../components/PremiumOfferEditor';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft } from 'react-icons/fa';
import { useToast } from '../context/ToastContext';

const PremiumOfferPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser, userProfile, loading: authLoading } = useAuth();
    const { t } = useTranslation();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(id ? true : false);
    const [offerData, setOfferData] = useState(null);
    const [publishing, setPublishing] = useState(false);

    useEffect(() => {
        if (authLoading) return;

        if (!currentUser || userProfile?.role !== 'business') {
            navigate('/');
            return;
        }

        if (id) {
            fetchOffer();
        }
    }, [id, currentUser, userProfile, authLoading, navigate]);

    const fetchOffer = async () => {
        try {
            setLoading(true);
            const offers = await premiumOfferService.getPartnerOffers(currentUser.uid);
            const found = offers.find(o => o.id === id);
            if (found) {
                setOfferData(found);
            } else {
                showToast('Offer not found or unauthorized', 'error');
                navigate('/business-dashboard');
            }
        } catch (error) {
            console.error('Error fetching offer:', error);
            showToast('Failed to load offer data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async (data, file, offerId = null) => {
        try {
            setPublishing(true);
            if (offerId) {
                await premiumOfferService.updateOffer(offerId, data, file);
            } else {
                await premiumOfferService.createOffer(data, file);
            }
            navigate('/business-dashboard');
        } catch (error) {
            console.error('Error publishing offer:', error);
            showToast(`Failed to publish: ${error.message}`, 'error');
        } finally {
            setPublishing(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div className="page-container" style={{ padding: '0', minHeight: '100vh', background: 'var(--bg-body)' }}>
            <div style={{ margin: '0 auto' }}>
                {/* Header/Breadcrumb */}
                <div style={{
                    maxWidth: '650px',
                    margin: '0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '24px 20px',
                    marginBottom: '8px'
                }}>
                    <button
                        onClick={() => navigate('/business-dashboard')}
                        style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-main)',
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                        }}
                    >
                        <FaChevronLeft />
                    </button>
                    <div>
                        <h1 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0 }}>
                            {id ? 'Edit Premium Offer' : 'Create New Premium Offer'}
                        </h1>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                            {id ? 'Update your exclusive offer details' : 'Design an eye-catching offer to attract visitors'}
                        </p>
                    </div>
                </div>

                {publishing ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto 1.5rem' }} />
                        <h3>Publishing...</h3>
                    </div>
                ) : (
                    <PremiumOfferEditor
                        businessProfile={userProfile}
                        initialData={offerData}
                        onPublish={handlePublish}
                        onClose={() => navigate('/business-dashboard')}
                        isFullPage={true}
                    />
                )}
            </div>
        </div>
    );
};

export default PremiumOfferPage;
