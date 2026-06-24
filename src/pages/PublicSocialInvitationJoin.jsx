import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigate, useParams } from 'react-router-dom';

import { useTranslation } from 'react-i18next';

import { FaCalendarAlt, FaMapMarkerAlt } from 'react-icons/fa';

import { useAuth } from '../context/AuthContext';

import { useInvitations } from '../context/InvitationContext';

import { useToast } from '../context/ToastContext';

import PersonalOAuthButtons from '../components/auth/PersonalOAuthButtons';

import SocialInvitationCardPreview from '../components/Invitations/socialCard/SocialInvitationCardPreview';

import { DEFAULT_FRAME_COLOR_ID } from '../components/Invitations/socialCard/socialCardFrameColors';

import { DEFAULT_FONT_ID } from '../components/Invitations/socialCard/socialCardFonts';

import {

  DEFAULT_CARD_COPY_OFFSET_Y,

  DEFAULT_CARD_COPY_WIDTH_PCT,

  DEFAULT_CARD_COPY_FONT_SCALE } from

'../components/Invitations/socialCard/socialCardCopyLayout';

import { getPrivateHeroCoverFromMediaData } from '../components/Invitations/privateCard/privateCardBackgrounds';

import {

  buildLoginUrlWithNext,

  buildPrivateInvitationSharePath,

  buildPrivateInvitationShareUrl,

  formatInvitationShareDate,

  formatInvitationShareTime,

  stashPendingPrivateInviteToken } from

'../utils/privateInvitationShare';

import {

  generatePrivateInvitationMetaTags,

  resetSocialMetaTags,

  updateSocialMetaTags } from

'../utils/socialMetaTags';

import { consumeOAuthRedirectError } from '../utils/localDevAuth';

import { getAuthErrorMessage } from '../utils/errorMessages';

import '../components/Invitations/socialCard/SocialInvitationExternalShare.css';

import './SocialInvitation.css';
import { AppText } from "../components/base";



function normUid(v) {

  if (v == null || v === '') return '';

  return typeof v === 'string' ? v : String(v);

}



export default function PublicSocialInvitationJoin() {

  const { token } = useParams();

  const { t, i18n } = useTranslation();

  const navigate = useNavigate();

  const { showToast } = useToast();

  const { currentUser, loading: authLoading } = useAuth();

  const { getPrivateInvitationSharePreview, claimPrivateInvitationShare } = useInvitations();

  const getPreviewRef = useRef(getPrivateInvitationSharePreview);

  const claimRef = useRef(claimPrivateInvitationShare);

  getPreviewRef.current = getPrivateInvitationSharePreview;

  claimRef.current = claimPrivateInvitationShare;



  const [preview, setPreview] = useState(null);

  const [loading, setLoading] = useState(true);

  const [claiming, setClaiming] = useState(false);

  const [oauthRedirecting, setOauthRedirecting] = useState(false);

  const [error, setError] = useState(null);



  const previewFetchKeyRef = useRef(null);

  const claimAttemptedRef = useRef(false);

  const sessionUid = normUid(currentUser?.uid || currentUser?.id);



  const invitePath = useMemo(() => buildPrivateInvitationSharePath(token), [token]);

  const loginHref = useMemo(() => buildLoginUrlWithNext(invitePath), [invitePath]);

  const sharePageUrl = useMemo(

    () => token ? buildPrivateInvitationShareUrl(token) : '',

    [token]

  );



  const stashToken = useCallback(() => {

    if (token) stashPendingPrivateInviteToken(token);

  }, [token]);



  useEffect(() => {

    const redirectErr = consumeOAuthRedirectError();

    if (redirectErr) {

      showToast(getAuthErrorMessage(redirectErr) || redirectErr.message, 'error');

    }

  }, [showToast]);



  useEffect(() => {

    if (!preview || !sharePageUrl) return undefined;

    const meta = generatePrivateInvitationMetaTags(preview, sharePageUrl);

    if (meta?.title) updateSocialMetaTags(meta);

    return () => resetSocialMetaTags();

  }, [preview, sharePageUrl]);



  useEffect(() => {

    if (!token) {

      setError('invalid');

      setLoading(false);

      return undefined;

    }



    const fetchKey = String(token);

    if (previewFetchKeyRef.current === fetchKey) return undefined;

    previewFetchKeyRef.current = fetchKey;



    let cancelled = false;

    setLoading(true);

    setError(null);



    getPreviewRef.current(token).

    then((data) => {

      if (cancelled) return;

      if (!data?.preview) {

        setError('not_found');

        return;

      }

      setPreview(data.preview);

    }).

    catch(() => {

      if (!cancelled) setError('not_found');

    }).

    finally(() => {

      if (!cancelled) setLoading(false);

    });



    return () => {

      cancelled = true;

    };

  }, [token]);



  useEffect(() => {

    if (!token || authLoading || !preview || claimAttemptedRef.current) return undefined;

    if (!sessionUid || sessionUid === 'guest') return undefined;



    claimAttemptedRef.current = true;

    let cancelled = false;

    setClaiming(true);



    claimRef.current(token).

    then((invitationId) => {

      if (cancelled || !invitationId) return;

      navigate(`/invitation/social/${invitationId}`, { replace: true });

    }).

    catch((err) => {

      if (cancelled) return;

      claimAttemptedRef.current = false;

      console.error('[PublicSocialInvitationJoin] claim', err);

      showToast(

        t('social_invite_claim_failed', 'Could not open this invitation. Try again.'),

        'error'

      );

    }).

    finally(() => {

      if (!cancelled) setClaiming(false);

    });



    return () => {

      cancelled = true;

    };

  }, [token, authLoading, sessionUid, preview, navigate, showToast, t]);



  const heroCover = useMemo(() => {

    if (!preview) return null;

    return getPrivateHeroCoverFromMediaData({

      type: preview.mediaType === 'video' ? 'video' : 'image',

      preview: preview.customImage || preview.videoThumbnail,

      url: preview.customImage,

      publishedUrl: preview.customImage,

      videoThumbnail: preview.videoThumbnail

    });

  }, [preview]);



  const eventWhen = useMemo(() => {

    if (!preview) return '';

    const datePart = formatInvitationShareDate(preview.date, i18n.language);

    const timePart = formatInvitationShareTime(preview.time);

    return [datePart, timePart].filter(Boolean).join(' · ');

  }, [preview, i18n.language]);



  const handleMoreSignInOptions = () => {

    stashToken();

    navigate(loginHref);

  };



  if (loading || claiming || oauthRedirecting) {

    return (

      <div className="loading-container public-social-invite-join">
                
        {claiming ?

        t('social_invite_opening', 'Opening your invitation…') :

        oauthRedirecting ?

        t('social_invite_signing_in', 'Completing sign-in…') :

        t('loading')}
            
      </div>);



  }



  if (error || !preview) {

    return (

      <div className="page-container public-social-invite-join" style={{ textAlign: 'center' }}>
                
        <AppText as="p" style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
                    
          {t('social_invite_link_invalid', 'This invitation link is invalid or has expired.')}
                
        </AppText>
                
        <button type="button" className="vip-btn vip-btn-primary" onClick={() => navigate('/')}>
                    
          {t('back_home', 'Back home')}
                
        </button>
            
      </div>);



  }



  const hostName = preview.inviterName || '';



  return (

    <div className="public-social-invite-join page-container">
            
      <div className="public-social-invite-join__hero">
                
        <AppText as="p" className="public-social-invite-join__eyebrow">
                    
          {t('social_invite_viewing_now', {

            defaultValue: 'You are viewing a private invitation'

          })}
                
        </AppText>
                
        <AppText as="h1" className="public-social-invite-join__headline">
                    
          {hostName ?

          t('social_invite_landing_headline_named', {

            defaultValue: '{{host}} invites you',

            host: hostName

          }) :

          t('social_invite_guest_title', 'You are invited!')}
                
        </AppText>
                
        {preview.title ?

        <AppText as="p" className="public-social-invite-join__event-title">{preview.title}</AppText> :

        null}
            
      </div>

            

      <div className="public-social-invite-join__card-wrap">
                
        <SocialInvitationCardPreview

          className="social-invitation-card-preview--showcase"

          cardTemplateSet={preview.type === 'Private' ? 'dating' : 'private'}

          frameColorId={preview.cardFrameColorId ?? DEFAULT_FRAME_COLOR_ID}

          cardThemeColor={preview.socialCardThemeColor ?? null}

          cardFontId={preview.cardFontId ?? DEFAULT_FONT_ID}

          copyOffsetY={preview.cardCopyOffsetY ?? DEFAULT_CARD_COPY_OFFSET_Y}

          copyWidthPct={preview.cardCopyWidthPct ?? DEFAULT_CARD_COPY_WIDTH_PCT}

          copyFontScale={preview.cardCopyFontScale ?? DEFAULT_CARD_COPY_FONT_SCALE}

          freezeMotion

          occasionType={preview.occasionType}

          cardBackgroundId={preview.cardBackgroundId || null}

          cardGradientId={preview.cardGradientId || null}

          heroCoverSrc={heroCover?.src ?? null}

          heroCoverMediaType={heroCover?.mediaType ?? null}

          heroCoverPoster={heroCover?.poster ?? null}

          title={preview.title}

          description={preview.description}

          date={preview.date}

          time={preview.time}

          location={preview.location}

          inviterName={preview.inviterName}

          showHostAndMessage={preview.socialCardShowHostAndMessage !== false}

          textBackdropTone={preview.socialCardTextBackdropTone || undefined} />

        
            
      </div>

            

      {(eventWhen || preview.location) &&

      <div className="public-social-invite-join__meta">
                    
        {eventWhen ?

        <AppText as="span" className="public-social-invite-join__meta-chip">
                            
          <FaCalendarAlt aria-hidden />
                            
          {eventWhen}
                        
        </AppText> :

        null}
                    
        {preview.location ?

        <AppText as="span" className="public-social-invite-join__meta-chip">
                            
          <FaMapMarkerAlt aria-hidden />
                            
          {preview.location}
                        
        </AppText> :

        null}
                
      </div>

      }

            

      <div className="public-social-invite-join__cta public-social-invite-join__cta--landing">
                
        <AppText as="p" className="public-social-invite-join__subtitle">
                    
          {hostName ?

          t('social_invite_landing_subtitle_named', {

            defaultValue:

            'Join DineBuddies free to accept or decline {{host}}\'s invitation — it only takes a few seconds.',

            host: hostName

          }) :

          t('social_invite_landing_subtitle', {

            defaultValue:

            'Join DineBuddies free to accept or decline — it only takes a few seconds.'

          })}
                
        </AppText>

                

        <PersonalOAuthButtons

          providers={['google', 'apple']}

          onBeforeOAuth={stashToken}

          onOAuthRedirect={() => setOauthRedirecting(true)} />

        

                

        <AppText as="p" className="public-social-invite-join__oauth-hint">
                    
          {t('social_invite_oauth_hint', {

            defaultValue: 'Free account · no password needed'

          })}
                
        </AppText>

                

        <button

          type="button"

          className="public-social-invite-join__more-options"

          onClick={handleMoreSignInOptions}>

          
                    
          {t('social_invite_more_options', {

            defaultValue: 'More sign-in options'

          })}
                
        </button>
            
      </div>
        
    </div>);



}