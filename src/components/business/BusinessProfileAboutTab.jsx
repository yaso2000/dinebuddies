import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaInfoCircle } from 'react-icons/fa';
import { AppText } from '../base';
import { BusinessSectionCard, EditActionBtn } from './BusinessProfileCardParts';
import { FreeFeatureBadge } from '../PremiumBadge';
import BrandColorSwatchRail from './BrandColorSwatchRail';
import EnhancedGallery from '../EnhancedGallery';
import EnhancedReviews from '../EnhancedReviews';
import PremiumOfferCard from '../PremiumOfferCard';
import BusinessJobsPanel from './BusinessJobsPanel';

export default function BusinessProfileAboutTab({ profile }) {
  const { t } = useTranslation();
  const {
    activeTab,
    isOwner,
    showColorRail,
    setShowColorRail,
    businessInfo,
    categoryBadges,
    navigate,
    openBasicInfoModal,
    profileId,
    business,
    tc,
    reviews,
    currentUser,
    userProfile,
    setShowFeedbackModal,
    setShowReviewModal,
    averageRating,
    highlights,
  } = profile;

  if (activeTab !== 'about') return null;

  return (
    <div className="profile-section-content">

            {/* About Card */}
            <BusinessSectionCard
      icon={<FaInfoCircle />}
      title={t('about_us', 'About Us')}
      className="business-profile-card--accent"
      actions={isOwner &&
      <>
          <FreeFeatureBadge text={t('free_feature', 'Free')} />
          <EditActionBtn tc={tc} onClick={() => setShowColorRail((v) => !v)} icon={<AppText as="span" style={{ fontSize: '1rem' }}>🎨</AppText>} />
          <EditActionBtn tc={tc} onClick={openBasicInfoModal} />
        </>
      }>

                {isOwner && showColorRail &&
      <BrandColorSwatchRail />
      }

                {(businessInfo.businessType || businessInfo.cuisineType || categoryBadges.length > 0) &&
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '16px'
        }}>

                        {(businessInfo.businessType || businessInfo.cuisineType) &&
        <button
          type="button"
          onClick={() =>
          navigate(
            `/restaurants?category=${encodeURIComponent(businessInfo.businessType || 'Venue')}`
          )
          }
          className="business-profile-chip">

                                {businessInfo.businessType ?
          t(businessInfo.businessType, businessInfo.businessType) :
          ''}
                                {businessInfo.cuisineType ?
          ` • ${t(businessInfo.cuisineType, businessInfo.cuisineType)}` :
          ''}
                            </button>
        }
                        {categoryBadges.map((label) =>
        <AppText as="span"
        key={label}
        className="business-profile-chip--static">

                                {label}
                            </AppText>
        )}
                    </div>
      }

                {businessInfo.description ?
      <AppText as="p" style={{
        color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '1rem', margin: 0,
        whiteSpace: 'pre-wrap'
      }}>
                        {businessInfo.description}
                    </AppText> :

      <div style={{ padding: '24px', textAlign: 'center', background: 'var(--hover-overlay)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
                        <AppText as="p" style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem', fontWeight: '500' }}>{t('no_description_available', 'No description available')}</AppText>
                        {isOwner && <AppText as="p" style={{ color: 'var(--text-muted)', margin: '8px 0 0', fontSize: '0.85rem', opacity: 0.9 }}>{t('click_edit_to_add', 'Click Edit to add one')}</AppText>}
                    </div>
      }
            </BusinessSectionCard>



            {/* Enhanced Gallery Section */}
            <EnhancedGallery
      profileId={profileId}
      business={business}
      isOwner={isOwner}
      theme={{ colors: tc || {} }} />




            {/* Feedback — visitors only; owners cannot complain to their own business */}
            {!isOwner &&
      <BusinessSectionCard
      title={t('feedback_box', 'Feedback & Complaints')}
      actions={
      <button onClick={() => setShowFeedbackModal(true)} style={{ background: 'var(--brand-primary)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {t('send_feedback_btn', 'Send Feedback')}
                        </button>
      }>

                    <AppText as="p" style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t('feedback_desc', 'Have a complaint or suggestion? Contact the management directly and privately.')}</AppText>
                </BusinessSectionCard>
      }

            {/* Open positions — visitors can apply; owners see a hint */}
            <BusinessJobsPanel profileId={profileId} isOwner={isOwner} />

            <EnhancedReviews
      reviews={reviews}
      profileId={profileId}
      isOwner={isOwner}
      currentUser={currentUser}
      userProfile={userProfile}
      onWriteReview={() => setShowReviewModal(true)}
      averageRating={averageRating}
      theme={{ colors: tc }} />


            {/* Highlights Section */}
            {!highlights.loading && (highlights.offers.length > 0 || highlights.posts.length > 0 || highlights.events.length > 0) &&
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--profile-stack-gap)', marginTop: 'var(--profile-stack-gap)' }}>

                    {/* Offers */}
                    {highlights.offers.length > 0 &&
      <BusinessSectionCard title={typeof t('offers', 'Offers') === 'string' ? t('offers', 'Offers') : 'Offers'}>
                            {highlights.offers.map((offer) =>
        <div key={offer.id || Math.random().toString()} style={{ width: '100%' }}>

                                    <PremiumOfferCard offer={offer} isOwnerView={false} compactHeight={true} />
                                </div>
        )}
                        </BusinessSectionCard>
      }

                    {/* Posts (Square Thumbnails Grid) */}
                    {highlights.posts.length > 0 &&
      <BusinessSectionCard title={typeof t('featured_posts', 'Featured Posts') === 'string' ? t('featured_posts', 'Featured Posts') : 'Featured Posts'}>
                            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                {highlights.posts.map((post) => {
            let bgImage = post.imageUrl || post.mediaUrl || post.mediaUrls && post.mediaUrls[0] || post.backgroundUrl || '';
            let bgStyle = { background: 'var(--brand-primary)' };

            if (post.background) {
              const { type, value, gradientStart, gradientEnd } = post.background;
              if (type === 'image' && value) bgImage = value;else
              if (type === 'gradient') bgStyle = { background: `linear-gradient(135deg, ${gradientStart || '#1e1e2e'}, ${gradientEnd || '#2d2b42'})` };else
              if (type === 'color' && value) bgStyle = { background: value };else
              if (value && type !== 'image') bgStyle = { background: value };
            }

            if (bgImage) {
              bgStyle = { background: `url(${bgImage}) top center/cover no-repeat var(--bg-card)` };
            }

            const safeTitle = typeof post.title === 'string' ? post.title : post.title?.text || 'Post';

            return (
              <div key={post.id || Math.random().toString()}
              onClick={() => {
                navigate(`/post/featured/${post.id}`);
              }}
              style={{
                cursor: 'pointer',
                flex: 1,
                aspectRatio: '1 / 1',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                position: 'relative',
                overflow: 'hidden',
                ...bgStyle
              }}>

                                                    {!bgImage &&
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem', fontWeight: '800', textAlign: 'center', padding: '8px' }}>
                                                            {safeTitle}
                                                        </div>
                }
                                                </div>);

          })}
                            </div>
                        </BusinessSectionCard>
      }

                    {/* Events */}
                    {highlights.events.length > 0 &&
      <BusinessSectionCard title={typeof t('events', 'Events') === 'string' ? t('events', 'Events') : 'Events'}>
                            {highlights.events.map((event) => {
          const isEpoch = typeof event.startDate === 'number';
          const isDateString = typeof event.startDate === 'string';
          const isTimestamp = event.startDate?.toDate;

          let evtDate = new Date();
          if (isTimestamp) evtDate = event.startDate.toDate();else
          if (isEpoch || isDateString) evtDate = new Date(event.startDate);else
          if (event.createdAt?.toDate) evtDate = event.createdAt.toDate();

          const shortMonth = Number.isNaN(evtDate.getTime()) ? 'EVT' : evtDate.toLocaleString('default', { month: 'short' });
          const dayDate = Number.isNaN(evtDate.getTime()) ? '*' : evtDate.getDate();

          const safeEventTitle = typeof event.title === 'string' ? event.title : 'Upcoming Event';
          const safeEventDesc = typeof event.content === 'string' ? event.content : typeof event.description === 'string' ? event.description : 'Join us for this special event!';

          return (
            <div key={event.id || Math.random().toString()}
            onClick={() => {
              navigate(`/post/${event.id}`);
            }}
            style={{ cursor: 'pointer', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '12px', display: 'flex', gap: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', width: '100%' }}>

                                                <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'var(--brand-primary)', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <AppText as="span" style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{shortMonth}</AppText>
                                                    <AppText as="span" style={{ fontSize: '1.2rem', fontWeight: '900', lineHeight: '1' }}>{dayDate}</AppText>
                                                </div>
                                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                                    <AppText as="h4" style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                                        {safeEventTitle}
                                                    </AppText>
                                                    <AppText as="p" style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                        {safeEventDesc}
                                                    </AppText>
                                                </div>
                                            </div>);

        })}
                        </BusinessSectionCard>
      }
                </div>
      }

        </div>);

}
