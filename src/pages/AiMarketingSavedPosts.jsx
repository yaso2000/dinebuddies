import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaFolderOpen } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import MotionPostStudio from '../components/motion/MotionPostStudio';
import './AiMarketingStudio.css';
import './MyCommunity.css';

const AiMarketingSavedPosts = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentUser, loading, isBusiness } = useAuth();

    const businessNavHint = (() => {
        try {
            return Boolean(currentUser?.uid && sessionStorage.getItem('dineb_biz_uid') === currentUser.uid);
        } catch {
            return false;
        }
    })();
    const isBusinessAccount = isBusiness || businessNavHint;

    useEffect(() => {
        if (loading) return;
        if (!currentUser || !isBusinessAccount) {
            navigate('/posts-feed', { replace: true });
        }
    }, [loading, currentUser, isBusinessAccount, navigate]);

    if (loading) {
        return (
            <div className="ai-marketing-studio ai-marketing-studio--loading page-container" role="status" aria-busy="true">
                <div className="ai-marketing-studio__spinner" />
            </div>
        );
    }

    if (!currentUser || !isBusinessAccount) {
        return null;
    }

    return (
        <div className="page-container ai-marketing-studio">
            <header className="ai-marketing-studio__header">
                <button
                    type="button"
                    className="ai-marketing-studio__back"
                    onClick={() => navigate('/ai-marketing-studio')}
                    aria-label={t('go_back', 'Go back')}
                >
                    <FaArrowLeft />
                </button>
                <div className="ai-marketing-studio__header-text">
                    <h1>{t('saved_motion_posts', 'Saved motion posts')}</h1>
                    <p>
                        {t('saved_motion_posts_subtitle', 'Review drafts and published posts in one focused page.')}
                    </p>
                </div>
                <div className="ai-marketing-studio__header-icon" aria-hidden>
                    <FaFolderOpen />
                </div>
            </header>

            <MotionPostStudio showComposer={false} showSavedPosts savedPostsPagePath="" />
        </div>
    );
};

export default AiMarketingSavedPosts;