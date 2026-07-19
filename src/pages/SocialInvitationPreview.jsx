import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { FaEdit, FaCheckCircle, FaArrowLeft } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import {
  isPrivateInvitationDraft,
  isPrivateInvitationPublished,
  getPrivateInvitationCreatePath,
  getPrivateDraftRecoveryCreatePath,
  rememberPrivateDraftCreateKind,
  getInvitationDetailsPath } from
'../utils/socialInvitationDraft';
import { fetchHostedInvitationDraft } from '../utils/fetchHostedInvitationDraft';
import { resolveInviteCategory } from '../utils/inviteCategory';
import { readPrivateInvitationShareToken } from '../utils/privateInvitationShare';
import { useInvitations } from '../context/InvitationContext';
import { useToast } from '../context/ToastContext';
import './SocialInvitation.css';
import { getSafeAvatar } from '../utils/avatarUtils';
import SocialInvitationCardPreview from '../components/Invitations/socialCard/SocialInvitationCardPreview';
import { buildSocialInvitationCardPreviewProps } from '../components/Invitations/socialCard/buildSocialInvitationCardPreviewProps';
import { getPrivateInvitationHeroCoverFromInvitation } from '../components/Invitations/privateCard/privateCardBackgrounds';
import { getSocialInvitationHeroCoverFromInvitation } from '../components/Invitations/socialCard/socialCardBackgrounds';
import { getInvitationCardTextBackdropFromInvitation } from '../components/Invitations/socialCard/socialCardTextBackdrop';
import SocialInvitationExternalShare from '../components/Invitations/socialCard/SocialInvitationExternalShare';
import SocialInvitationInviteePanel from '../components/Invitations/socialCard/SocialInvitationInviteePanel';
import SocialInvitationShareCapture from '../components/Invitations/socialCard/SocialInvitationShareCapture';
import '../components/Invitations/socialCard/SocialInvitationExternalShare.css';
import { AppText } from "../components/base";
import { clearPrivateInvitationEditorSession } from '../utils/editorSessionDraft';
import { scheduleScrollPageToTop } from '../utils/scrollPageToTop';

const SocialInvitationPreview = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: draftId } = useParams();
  const { publishPrivateInvitationDraft } = useInvitations();

  const cardCaptureRef = useRef(null);
  const postPublishShareTokenRef = useRef(null);
  const invitationRef = useRef(null);

  const [invitation, setInvitation] = useState(() => {
    const seeded = location.state?.previewInvitation;
    if (seeded?.id && draftId && String(seeded.id) === String(draftId)) {
      return seeded;
    }
    return null;
  });
  invitationRef.current = invitation;

  const [loadError, setLoadError] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [hasSentToMembers, setHasSentToMembers] = useState(false);
  const [postPublishShareToken, setPostPublishShareToken] = useState(null);
  postPublishShareTokenRef.current = postPublishShareToken;
  const [loading, setLoading] = useState(() => {
    const seeded = location.state?.previewInvitation;
    return !(seeded?.id && draftId && String(seeded.id) === String(draftId));
  });
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (loading || !invitation?.id) return undefined;
    return scheduleScrollPageToTop();
  }, [loading, invitation?.id]);

  useEffect(() => {
    let cancelled = false;

    const fetchDraft = async () => {
      if (!draftId) {
        navigate(getPrivateDraftRecoveryCreatePath(), { replace: true });
        return;
      }

      setLoadError(null);
      const seeded = location.state?.previewInvitation;
      const hasSeededDraft =
        seeded?.id && draftId && String(seeded.id) === String(draftId);
      if (!hasSeededDraft) {
        setLoading(true);
      }

      try {
        const loaded = await fetchHostedInvitationDraft(draftId, {
          maxAttempts: hasSeededDraft ? 4 : 10,
          baseDelayMs: 150,
          preferServer: !hasSeededDraft,
          allowPublished: true,
        });
        if (cancelled) return;

        if (!loaded.ok) {
          if (hasSeededDraft && loaded.code !== 'published') {
            rememberPrivateDraftCreateKind(seeded);
            const editorUid = auth.currentUser?.uid;
            if (editorUid) {
              clearPrivateInvitationEditorSession(editorUid, seeded, draftId);
            }
            return;
          }

          if (loaded.code === 'published') {
            setLoadError('published');
          } else if (loaded.code === 'permission') {
            setLoadError('permission');
          } else if (loaded.code === 'invalid_status') {
            setLoadError('invalid_status');
          } else {
            setLoadError('not_found');
          }
          showToast(
            loaded.code === 'permission'
              ? t('social_draft_permission_denied', {
                  defaultValue: 'Could not open the draft. Sign in again and retry.'
                })
              : loaded.code === 'invalid_status'
                ? t('error_loading_draft') || 'Could not open this invitation draft.'
                : t('invitation_not_found') || 'Draft not found',
            'error'
          );
          return;
        }

        if (loaded.published || isPrivateInvitationPublished(loaded.data)) {
          navigate(getInvitationDetailsPath({ id: draftId, ...loaded.data }), { replace: true });
          return;
        }

        if (!isPrivateInvitationDraft(loaded.data)) {
          setLoadError('invalid_status');
          showToast(
            t('error_loading_draft') || 'Could not open this invitation draft.',
            'error'
          );
          return;
        }

        setInvitation({
          id: draftId,
          ...loaded.data
        });
        rememberPrivateDraftCreateKind(loaded.data);
        const editorUid = auth.currentUser?.uid;
        if (editorUid) {
          clearPrivateInvitationEditorSession(editorUid, loaded.data, draftId);
        }
      } catch (error) {
        console.error('Error fetching private draft:', error);
        if (hasSeededDraft) {
          rememberPrivateDraftCreateKind(seeded);
          return;
        }
        const code = error?.code || '';
        setLoadError(code === 'permission-denied' ? 'permission' : 'unknown');
        showToast(
          code === 'permission-denied' ?
          t('social_draft_permission_denied', {
            defaultValue: 'Could not open the draft. Sign in again and retry.'
          }) :
          t('error_loading_draft') || 'Error loading draft',
          'error'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDraft();
    return () => {
      cancelled = true;
    };
  }, [draftId, location.state, navigate, showToast, t]);

  const cardHeroCover = useMemo(() => {
    if (!invitation) return null;
    return (
      getPrivateInvitationHeroCoverFromInvitation(invitation) ||
      getSocialInvitationHeroCoverFromInvitation(invitation)
    );
  }, [invitation]);

  const textBackdrop = useMemo(
    () => invitation ? getInvitationCardTextBackdropFromInvitation(invitation) : null,
    [invitation]
  );

  const cardPreviewProps = useMemo(() => {
    if (!invitation) return null;
    return buildSocialInvitationCardPreviewProps(invitation, {
      heroCover: cardHeroCover,
      inviterName: invitation.author?.name || '',
      inviterAvatarUrl: getSafeAvatar(invitation.author || {}),
      textBackdrop
    });
  }, [invitation, cardHeroCover, textBackdrop]);

  const inviteMode = resolveInviteCategory(invitation) === 'private' ? 'dating' : 'private';
  const selectedMemberCount = invitation?.invitedFriends?.length || 0;
  const canSendToMembers = selectedMemberCount >= 1;

  const handleInvitedFriendsChange = (nextIds) => {
    setInvitation((prev) =>
    prev ?
    {
      ...prev,
      invitedFriends: nextIds,
      rsvps: Object.fromEntries(nextIds.map((id) => [id, 'pending']))
    } :
    prev
    );
  };

  const persistPreviewDraft = useCallback(async () => {
    const current = invitationRef.current;
    if (!draftId || !current) return false;
    const invitedFriends = Array.isArray(current.invitedFriends) ? current.invitedFriends : [];
    const rsvps =
      current.rsvps && typeof current.rsvps === 'object'
        ? current.rsvps
        : Object.fromEntries(invitedFriends.map((id) => [id, 'pending']));
    await updateDoc(doc(db, 'social_invitations', draftId), {
      invitedFriends,
      rsvps,
      updatedAt: serverTimestamp()
    });
    return true;
  }, [draftId]);

  const loadExistingShareToken = useCallback(async () => {
    if (!draftId) return null;
    return readPrivateInvitationShareToken(draftId);
  }, [draftId]);

  useEffect(() => {
    if (!draftId || postPublishShareToken) return undefined;

    let cancelled = false;
    loadExistingShareToken().then((token) => {
      if (!cancelled && token) {
        postPublishShareTokenRef.current = token;
        setPostPublishShareToken(token);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [draftId, loadExistingShareToken, postPublishShareToken]);

  const publishDraftOnce = useCallback(
    async () => {
      if (postPublishShareTokenRef.current) {
        return { success: true, shareToken: postPublishShareTokenRef.current };
      }

      const existingToken = await loadExistingShareToken();
      if (existingToken) {
        postPublishShareTokenRef.current = existingToken;
        setPostPublishShareToken(existingToken);
        return { success: true, shareToken: existingToken, alreadyPublished: true };
      }

      const persisted = await persistPreviewDraft();
      if (!persisted) {
        return {
          success: false,
          message: t('error_loading_draft', { defaultValue: 'Could not load the invitation draft.' })
        };
      }

      return publishPrivateInvitationDraft(draftId);
    },
    [draftId, loadExistingShareToken, persistPreviewDraft, publishPrivateInvitationDraft, t]
  );

  const handleBackClick = () => {
    setShowLeaveDialog(true);
  };

  const handleLeaveSave = async () => {
    setIsLeaving(true);
    try {
      await persistPreviewDraft();
      setShowLeaveDialog(false);
      showToast(
        t('social_preview_draft_saved', {
          defaultValue: 'Invitation draft saved.'
        }),
        'success'
      );
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error saving preview draft:', error);
      showToast(t('failed_save_draft', { defaultValue: 'Could not save draft.' }), 'error');
    } finally {
      setIsLeaving(false);
    }
  };

  const handleLeaveDiscard = () => {
    setShowLeaveDialog(false);
    navigate('/', { replace: true });
  };

  const handleSendToMembers = async () => {
    if (!canSendToMembers || isPublishing || hasSentToMembers) return;

    setIsPublishing(true);
    try {
      const persisted = await persistPreviewDraft();
      if (!persisted) {
        showToast(
          t('error_loading_draft', { defaultValue: 'Could not load the invitation draft.' }),
          'error'
        );
        return;
      }

      const publishResult = await publishPrivateInvitationDraft(draftId);
      if (!publishResult?.success) {
        if (publishResult?.message) {
          showToast(publishResult.message, 'error');
        }
        return;
      }

      if (publishResult.shareToken) {
        setPostPublishShareToken(publishResult.shareToken);
      }

      const inviteeCount = Array.isArray(invitationRef.current?.invitedFriends)
        ? invitationRef.current.invitedFriends.length
        : 0;
      const notificationsSent = Math.max(0, Number(publishResult.notificationsSent) || 0);
      if (inviteeCount > 0 && (notificationsSent === 0 || publishResult.notifyError)) {
        showToast(
          t('social_invite_publish_notify_warning', {
            defaultValue:
              'Invitation published, but notifications could not be delivered to all members. Try sending again from preview.',
          }),
          'warning'
        );
        // Stay on preview — retry hits alreadyPublished and resends missing notifs (no re-charge).
        return;
      }

      setHasSentToMembers(true);
      showToast(
        t('social_invite_sent_to_members', {
          defaultValue: 'Invitation sent to selected members.'
        }),
        'success'
      );

      const current = invitationRef.current;
      navigate(
        getInvitationDetailsPath({
          id: draftId,
          ...(current || {}),
          status: 'published'
        }),
        { replace: true }
      );
    } catch (error) {
      console.error('Error sending private invitation:', error);
      showToast(
        error?.message || t('failed_publish_invitation', { defaultValue: 'Could not publish invitation.' }),
        'error'
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const ensurePublishedForShare = useCallback(async () => {
    // P0: in-memory cache — instant on repeat taps
    if (postPublishShareTokenRef.current) return postPublishShareTokenRef.current;

    // P0: Firestore read only — no Cloud Function, no rate limit
    const existingToken = await readPrivateInvitationShareToken(draftId);
    if (existingToken) {
      postPublishShareTokenRef.current = existingToken;
      setPostPublishShareToken(existingToken);
      return existingToken;
    }

    const publishResult = await publishDraftOnce();
    if (!publishResult?.success || !publishResult.shareToken) {
      return null;
    }
    postPublishShareTokenRef.current = publishResult.shareToken;
    return publishResult.shareToken;
  }, [draftId, publishDraftOnce]);

  if (loading) {
    return <div className="loading-container">{t('loading')}</div>;
  }

  if (!invitation) {
    return (
      <div className="page-container" style={{ padding: 24, textAlign: 'center' }}>
                <AppText as="p" style={{ marginBottom: 16, color: 'var(--text-muted)' }}>
                    {loadError === 'permission' ?
          t('social_draft_permission_denied', {
            defaultValue: 'Could not open the draft. Sign in again and retry.'
          }) :
          t('error_loading_draft', { defaultValue: 'Could not load the invitation draft.' })}
                </AppText>
                <button
          type="button"
          className="vip-btn vip-btn-primary"
          onClick={() => navigate(getPrivateDraftRecoveryCreatePath(), { replace: true })}>
          
                    {t('back_to_create', { defaultValue: 'Back to create invitation' })}
                </button>
            </div>);

  }

  return (
    <div
      className={`private-preview-container page-container theme-${(invitation.occasionType || 'social').toLowerCase()}`}
      style={{ paddingBottom: '40px' }}>
      
            <div className="preview-sticky-header invitation-preview-chrome__header">
                <button
          type="button"
          className="invitation-preview-chrome__back-btn"
          onClick={handleBackClick}
          disabled={isLeaving}>
          
                    <FaArrowLeft /> {t('back')}
                </button>
                <div className="invitation-preview-chrome__mode-label">
                    ✨ {t('preview_mode')}
                </div>
                <button
          type="button"
          className="invitation-preview-chrome__edit-btn"
          onClick={() =>
          navigate(getPrivateInvitationCreatePath(invitation), {
            state: { editInvitation: invitation }
          })
          }
          disabled={isPublishing}
          aria-label={t('edit')}>
          
                    <FaEdit />
                </button>
            </div>

            <div className="private-preview-stack">
                <div className="private-preview-stack__card-wrap">
                    {cardPreviewProps ?
          <SocialInvitationCardPreview {...cardPreviewProps} /> :
          null}
                </div>

                <SocialInvitationShareCapture ref={cardCaptureRef} cardPreviewProps={cardPreviewProps} />

                <SocialInvitationInviteePanel
          invitationId={draftId}
          mode={inviteMode}
          step="preview"
          invitedFriendIds={invitation.invitedFriends || []}
          onInvitedFriendsChange={handleInvitedFriendsChange} />
        

                <div className="private-preview-stack__action-row">
                    <button
            type="button"
            className="private-preview-stack__send-btn vip-btn vip-btn-primary ui-btn ui-btn--primary"
            onClick={handleSendToMembers}
            disabled={!canSendToMembers || isPublishing || hasSentToMembers}>
            
                        {isPublishing ?
            t('publishing') :
            hasSentToMembers ?
            <>
                                <FaCheckCircle aria-hidden />
                                {t('sent', { defaultValue: 'Sent' })}
                            </> :

            <>
                                <FaCheckCircle aria-hidden />
                                {t('send_to_app_members', { defaultValue: 'Send to app members' })}
                            </>
            }
                    </button>

                    <SocialInvitationExternalShare
            invitation={invitation}
            cardCaptureRef={cardCaptureRef}
            minimal />
          
                </div>
            </div>

            {showLeaveDialog ?
      <div
        className="invitation-preview-leave-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('studio_close_title', 'Save your work?')}>
        
                    <div
          className="invitation-preview-leave-dialog__backdrop"
          onClick={() => !isLeaving && setShowLeaveDialog(false)} />
        
                    <div className="invitation-preview-leave-dialog__card">
                        <AppText as="h3" className="invitation-preview-leave-dialog__title">
                            {t('studio_close_title', 'Save your work?')}
                        </AppText>
                        <AppText as="p" className="invitation-preview-leave-dialog__text">
                            {t(
              'social_preview_leave_question',
              'Save your invitation draft before leaving preview?'
            )}
                        </AppText>
                        <div className="invitation-preview-leave-dialog__actions">
                            <button
              type="button"
              className="invitation-preview-leave-dialog__btn invitation-preview-leave-dialog__btn--save"
              onClick={handleLeaveSave}
              disabled={isLeaving}>
              
                                {isLeaving ?
              t('saving', 'Saving…') :
              t('studio_save_draft', 'Save draft')}
                            </button>
                            <button
              type="button"
              className="invitation-preview-leave-dialog__btn invitation-preview-leave-dialog__btn--discard"
              onClick={handleLeaveDiscard}
              disabled={isLeaving}>
              
                                {t('studio_close_discard', 'Discard')}
                            </button>
                            <button
              type="button"
              className="invitation-preview-leave-dialog__btn invitation-preview-leave-dialog__btn--cancel"
              onClick={() => setShowLeaveDialog(false)}
              disabled={isLeaving}>
              
                                {t('studio_close_keep_editing', 'Keep editing')}
                            </button>
                        </div>
                    </div>
                </div> :
      null}
        </div>);

};

export default SocialInvitationPreview;