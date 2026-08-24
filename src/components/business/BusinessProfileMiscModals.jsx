import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes } from 'react-icons/fa';
import { AppText } from '../base';
import { getSafeAvatar, getShareableCoverImage } from '../../utils/avatarUtils';
import ShareButtons from '../ShareButtons';
import ShareSheet from '../ShareSheet';
import CreateInvitationSelector from '../CreateInvitationSelector';
import FeedbackSubmissionModal from '../FeedbackSubmissionModal';

export default function BusinessProfileMiscModals({ profile }) {
  const { t } = useTranslation();
  const {
    business,
    lightboxOpen,
    setLightboxOpen,
    lightboxIndex,
    setLightboxIndex,
    showShareModal,
    setShowShareModal,
    isSelectorOpen,
    setIsSelectorOpen,
    selectorState,
    showFeedbackModal,
    setShowFeedbackModal,
    profileId,
  } = profile;

  return (
    <>
            {/* Lightbox for Gallery */}
            {
    lightboxOpen &&
    <div
      className="business-profile-modal-overlay"
      style={{
        background: 'rgba(0, 0, 0, 0.95)',
        zIndex: 9999,
        padding: '20px'
      }}
      onClick={() => setLightboxOpen(false)}>

                    {/* Close Button */}
                    <button
      onClick={() => setLightboxOpen(false)}
      style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.1)',
        border: '2px solid white',
        color: 'white',
        fontSize: '1.5rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}>

                        <FaTimes />
                    </button>

                    {/* Image */}
                    <img
      src={(business?.businessInfo?.gallery || [])[lightboxIndex]}
      alt="Gallery"
      style={{
        maxWidth: '90%',
        maxHeight: '90%',
        objectFit: 'contain',
        borderRadius: '12px'
      }}
      onClick={(e) => e.stopPropagation()} />


                    {/* Navigation Arrows */}
                    {(business?.businessInfo?.gallery || []).length > 1 &&
    <>
                            <button
      onClick={(e) => {
        e.stopPropagation();
        setLightboxIndex((prev) =>
        prev === 0 ? (business?.businessInfo?.gallery || []).length - 1 : prev - 1
        );
      }}
      style={{
        position: 'absolute',
        left: '20px',
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.1)',
        border: '2px solid white',
        color: 'white',
        fontSize: '1.5rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>

                                ‹
                            </button>
                            <button
      onClick={(e) => {
        e.stopPropagation();
        setLightboxIndex((prev) =>
        prev === (business?.businessInfo?.gallery || []).length - 1 ? 0 : prev + 1
        );
      }}
      style={{
        position: 'absolute',
        right: '20px',
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.1)',
        border: '2px solid white',
        color: 'white',
        fontSize: '1.5rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>

                                ›
                            </button>
                        </>
    }

                    {/* Image Counter */}
                    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0, 0, 0, 0.7)',
      padding: '8px 16px',
      borderRadius: '20px',
      color: 'white',
      fontWeight: '700'
    }}>
                        {lightboxIndex + 1} / {(business?.businessInfo?.gallery || []).length}
                    </div>
                </div>

    }

            <ShareSheet
      open={showShareModal}
      title={t('share_profile') || 'Share Profile'}
      onClose={() => setShowShareModal(false)}>
                <ShareButtons
      url={window.location.href}
      title={business.display_name}
      description={`Check out ${business.display_name} on DineBuddies!`}
      type="business"
      storyData={{
        title: business.display_name,
        image: getShareableCoverImage(business.businessInfo?.coverImage) || getSafeAvatar(business),
        description: business.businessInfo?.description,
        location: business.businessInfo?.address,
        hostName: business.display_name,
        hostImage: getSafeAvatar(business),
        shareUrl: window.location.href
      }} />
            </ShareSheet>
            {/* Invitation Type Selector Modal */}
            <CreateInvitationSelector
      isOpen={isSelectorOpen}
      onClose={() => setIsSelectorOpen(false)}
      navigationState={selectorState} />


            {/* Modals */}
            <FeedbackSubmissionModal
      isOpen={showFeedbackModal}
      onClose={() => setShowFeedbackModal(false)}
      businessId={profileId} />

        </>);

}
