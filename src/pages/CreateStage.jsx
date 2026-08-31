import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FaCheck, FaMicrophone } from 'react-icons/fa';
import AppBackButton from '../components/AppBackButton';
import UserAvatar from '../components/UserAvatar';
import { AppText } from '../components/base';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useMyLiveStage } from '../hooks/useMyLiveStage';
import app from '../firebase/config';
import { getMutualFollowers } from '../utils/followHelpers';
import { getSafeAvatar } from '../utils/avatarUtils';
import { isVirtualUser } from '../utils/accountRole';
import { getBusinessProAccess } from '../utils/businessSubscription';
import './CreateStage.css';

const MAX_INVITEES = 40;

export default function CreateStage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { currentUser, userProfile, isBusiness } = useAuth();
  const {
    stageId: liveStageId,
    hasLiveStage,
    loading: liveStageLoading,
  } = useMyLiveStage();
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [mutuals, setMutuals] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [loadingMutuals, setLoadingMutuals] = useState(!isBusiness);
  const [submitting, setSubmitting] = useState(false);

  const uid = currentUser?.uid || userProfile?.id;
  const blockedAccount = isVirtualUser(userProfile);
  const businessStageBlocked =
    isBusiness && !getBusinessProAccess(userProfile).canCreateBusinessStage;

  useEffect(() => {
    if (blockedAccount) {
      showToast(t('business_cannot_create_invitation'), 'error');
      navigate(-1);
    }
  }, [blockedAccount, navigate, showToast, t]);

  useEffect(() => {
    if (isBusiness) {
      setLoadingMutuals(false);
      setMutuals([]);
      return undefined;
    }
    if (!uid) {
      setLoadingMutuals(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingMutuals(true);
    const followingIds = Array.isArray(userProfile?.following) ? userProfile.following : [];
    void getMutualFollowers(uid, followingIds)
      .then((rows) => {
        if (cancelled) return;
        setMutuals(
          (rows || []).map((u) => ({
            id: u.id,
            name: u.display_name || u.displayName || u.name || 'User',
            avatar: getSafeAvatar(u),
            raw: u,
          }))
        );
      })
      .catch((err) => {
        console.error('[CreateStage] mutuals', err);
        if (!cancelled) setMutuals([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMutuals(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, userProfile?.following, isBusiness]);

  const selectedCount = selectedIds.size;

  const toggleInvitee = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_INVITEES) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const blockedByExisting = Boolean(hasLiveStage && liveStageId);
  const inviteOnlyNeedsInvitee = !isBusiness && visibility === 'invite_only' && selectedCount === 0;
  const canSubmit =
    !submitting &&
    !blockedAccount &&
    !blockedByExisting &&
    !businessStageBlocked &&
    !liveStageLoading &&
    !inviteOnlyNeedsInvitee;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const functions = getFunctions(app, 'us-central1');
      const createStageRoom = httpsCallable(functions, 'createStageRoom');
      const result = await createStageRoom({
        title: title.trim(),
        // Business Stages are always community-gated (server ignores public/private).
        ...(isBusiness ? {} : { visibility }),
        inviteeIds: isBusiness ? [] : [...selectedIds],
      });
      const stageId = result?.data?.stageId;
      if (!stageId) {
        throw new Error('missing_stage_id');
      }
      showToast(
        isBusiness
          ? t('business_stage_created', 'Business Stage opened')
          : t('stage_created', 'Stage opened'),
        'success'
      );
      navigate(`/stage/${stageId}`, {
        replace: true,
        state: { stageJustCreated: true, stageHostId: uid },
      });
    } catch (err) {
      console.error('[CreateStage] create', err);
      const existingId = err?.details?.existingStageId || err?.customData?.existingStageId;
      if (existingId) {
        showToast(
          t(
            'stage_already_open',
            'You already have an open Stage. Open it instead of creating a new one.'
          ),
          'error'
        );
        navigate(`/stage/${existingId}`, { replace: true });
        return;
      }
      const rawMsg = String(err?.message || '');
      if (/insufficient.*credit|paid Credits to book/i.test(rawMsg)) {
        showToast(
          t(
            'create_stage_free_note',
            'Free — no charge. Live for 24 hours, then the Stage and all its media are deleted.'
          ),
          'error'
        );
        return;
      }
      const code = String(err?.code || '');
      const msg =
        code.includes('failed-precondition') || code.includes('invalid-argument')
          ? rawMsg.replace(/^Firebase: | \(functions\/.*\)\.?$/g, '').trim() ||
            t('stage_create_failed', 'Could not create Stage. Try again.')
          : t('stage_create_failed', 'Could not create Stage. Try again.');
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const subtitle = useMemo(
    () =>
      isBusiness
        ? t(
            'create_business_stage_subtitle',
            'Open a free Stage for your community members for 24 hours. Then it closes and everything is deleted.'
          )
        : t(
            'create_stage_subtitle',
            'Open alone or invite mutual follows. Choose public for everyone, followers only, or invite-only for a fully private Stage.'
          ),
    [isBusiness, t]
  );

  if (liveStageLoading) {
    return (
      <div className="create-stage-page">
        <header className="create-stage-page__header">
          <AppBackButton className="create-stage-page__back" />
          <div className="create-stage-page__heading">
            <AppText as="span" className="create-stage-page__icon" aria-hidden>
              <FaMicrophone />
            </AppText>
            <div>
              <AppText as="h1" className="create-stage-page__title">
                {isBusiness
                  ? t('create_business_stage_title', 'Open business Stage')
                  : t('create_stage_title', 'Open Stage')}
              </AppText>
              <AppText as="p" className="create-stage-page__subtitle">
                {t('loading_stages', 'Loading stages…')}
              </AppText>
            </div>
          </div>
        </header>
      </div>
    );
  }

  if (businessStageBlocked) {
    return (
      <div className="create-stage-page">
        <header className="create-stage-page__header">
          <AppBackButton className="create-stage-page__back" />
          <div className="create-stage-page__heading">
            <AppText as="span" className="create-stage-page__icon" aria-hidden>
              <FaMicrophone />
            </AppText>
            <div>
              <AppText as="h1" className="create-stage-page__title">
                {t('create_business_stage_title', 'Open business Stage')}
              </AppText>
              <AppText as="p" className="create-stage-page__subtitle">
                {t(
                  'business_stage_paid_only_hint',
                  'Business Stage requires a Paid Business plan.'
                )}
              </AppText>
            </div>
          </div>
        </header>
        <Link
          to="/settings/subscription"
          className="create-stage-page__submit"
          style={{ display: 'inline-flex', justifyContent: 'center', textDecoration: 'none' }}
        >
          {t('upgrade_plan_btn', 'Upgrade Plan')}
        </Link>
      </div>
    );
  }

  if (hasLiveStage && liveStageId) {
    return (
      <div className="create-stage-page">
        <header className="create-stage-page__header">
          <AppBackButton className="create-stage-page__back" />
          <div className="create-stage-page__heading">
            <AppText as="span" className="create-stage-page__icon" aria-hidden>
              <FaMicrophone />
            </AppText>
            <div>
              <AppText as="h1" className="create-stage-page__title">
                {t('stage_open_existing', 'Open your Stage')}
              </AppText>
              <AppText as="p" className="create-stage-page__subtitle">
                {t(
                  'stage_already_open',
                  'You already have an open Stage. Open it instead of creating a new one.'
                )}
              </AppText>
            </div>
          </div>
        </header>
        <Link
          to={`/stage/${liveStageId}`}
          state={{ stageJustCreated: false, stageHostId: uid }}
          className="create-stage-page__submit"
          style={{ display: 'inline-flex', justifyContent: 'center', textDecoration: 'none' }}
        >
          {t('stage_open_existing', 'Open your Stage')}
        </Link>
      </div>
    );
  }

  return (
    <div className="create-stage-page">
      <header className="create-stage-page__header">
        <AppBackButton className="create-stage-page__back" />
        <div className="create-stage-page__heading">
          <AppText as="span" className="create-stage-page__icon" aria-hidden>
            <FaMicrophone />
          </AppText>
          <div>
            <AppText as="h1" className="create-stage-page__title">
              {isBusiness
                ? t('create_business_stage_title', 'Open business Stage')
                : t('create_stage_title', 'Open Stage')}
            </AppText>
            <AppText as="p" className="create-stage-page__subtitle">
              {subtitle}
            </AppText>
          </div>
        </div>
      </header>

      <form className="create-stage-page__form" onSubmit={handleSubmit}>
        <label className="create-stage-page__field">
          <AppText as="span" className="create-stage-page__label">
            {t('create_stage_title_label', 'Title (optional)')}
          </AppText>
          <input
            type="text"
            className="create-stage-page__input"
            value={title}
            maxLength={80}
            placeholder={
              isBusiness
                ? t('create_business_stage_title_placeholder', 'Tonight at our place')
                : t('create_stage_title_placeholder', 'Tonight’s Stage')
            }
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        {!isBusiness ? (
          <div className="create-stage-page__field" role="group" aria-label={t('create_stage_visibility', 'Visibility')}>
            <AppText as="span" className="create-stage-page__label">
              {t('create_stage_visibility', 'Visibility')}
            </AppText>
            <div className="create-stage-page__visibility">
              <button
                type="button"
                className={`create-stage-page__visibility-btn${visibility === 'public' ? ' is-selected' : ''}`}
                aria-pressed={visibility === 'public'}
                onClick={() => setVisibility('public')}
              >
                <AppText as="span" className="create-stage-page__visibility-title">
                  {t('create_stage_visibility_public', 'Public')}
                </AppText>
                <AppText as="span" className="create-stage-page__visibility-hint">
                  {t('create_stage_visibility_public_hint', 'Anyone can join')}
                </AppText>
              </button>
              <button
                type="button"
                className={`create-stage-page__visibility-btn${visibility === 'followers' ? ' is-selected' : ''}`}
                aria-pressed={visibility === 'followers'}
                onClick={() => setVisibility('followers')}
              >
                <AppText as="span" className="create-stage-page__visibility-title">
                  {t('create_stage_visibility_followers', 'Followers')}
                </AppText>
                <AppText as="span" className="create-stage-page__visibility-hint">
                  {t('create_stage_visibility_followers_hint', 'Followers only')}
                </AppText>
              </button>
              <button
                type="button"
                className={`create-stage-page__visibility-btn${visibility === 'invite_only' ? ' is-selected' : ''}`}
                aria-pressed={visibility === 'invite_only'}
                onClick={() => setVisibility('invite_only')}
              >
                <AppText as="span" className="create-stage-page__visibility-title">
                  {t('create_stage_visibility_invite_only', 'Private')}
                </AppText>
                <AppText as="span" className="create-stage-page__visibility-hint">
                  {t('create_stage_visibility_invite_only_hint', 'Invite only')}
                </AppText>
              </button>
            </div>
          </div>
        ) : (
          <AppText as="p" className="create-stage-page__hint">
            {t(
              'create_business_stage_audience_note',
              'Only members who joined your business community can enter this Stage.'
            )}
          </AppText>
        )}

        {!isBusiness ? (
          <div className="create-stage-page__field">
            <div className="create-stage-page__label-row">
              <AppText as="span" className="create-stage-page__label">
                {visibility === 'invite_only'
                  ? t('create_stage_guests_required', 'Invite guests')
                  : t('create_stage_guests_optional', 'Invite guests (optional)')}
              </AppText>
              <AppText as="span" className="create-stage-page__count">
                {selectedCount}/{MAX_INVITEES}
              </AppText>
            </div>

            <AppText as="p" className="create-stage-page__hint">
              {visibility === 'invite_only'
                ? t(
                    'create_stage_guests_invite_only_hint',
                    'This Stage is invite-only — nobody else can find or join it. Choose who to invite; you cannot add more people later.'
                  )
                : t(
                    'create_stage_guests_later_hint',
                    'Guests are optional. Open the Stage now — you can invite people after it is created.'
                  )}
            </AppText>

            {loadingMutuals ? (
              <AppText as="p" className="create-stage-page__hint">
                {t('loading', 'Loading…')}
              </AppText>
            ) : mutuals.length === 0 ? (
              <AppText as="p" className="create-stage-page__hint">
                {visibility === 'invite_only'
                  ? t(
                      'create_stage_no_mutuals_invite_only',
                      'No mutual follows yet — you need at least one to invite for a private Stage.'
                    )
                  : t(
                      'create_stage_no_mutuals_optional',
                      'No mutual follows yet. You can still open the Stage alone and share a join link.'
                    )}
              </AppText>
            ) : (
              <ul className="create-stage-page__list">
                {mutuals.map((person) => {
                  const selected = selectedIds.has(person.id);
                  return (
                    <li key={person.id}>
                      <button
                        type="button"
                        className={`create-stage-page__person${selected ? ' is-selected' : ''}`}
                        onClick={() => toggleInvitee(person.id)}
                        aria-pressed={selected}
                      >
                        <UserAvatar
                          user={person.raw}
                          alt=""
                          solidPlaceholder
                          noGenderRing
                          className="create-stage-page__avatar"
                        />
                        <AppText as="span" className="create-stage-page__person-name">
                          {person.name}
                        </AppText>
                        <AppText as="span" className="create-stage-page__check" aria-hidden>
                          {selected ? <FaCheck /> : null}
                        </AppText>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {inviteOnlyNeedsInvitee ? (
              <AppText as="p" className="create-stage-page__hint create-stage-page__hint--warn">
                {t(
                  'create_stage_invite_only_required_hint',
                  'Select at least one guest to invite before opening a private Stage.'
                )}
              </AppText>
            ) : null}
          </div>
        ) : null}

        <AppText as="p" className="create-stage-page__free-note">
          {t(
            'create_stage_free_note',
            'Free — no charge. Live for 24 hours, then the Stage and all its media are deleted.'
          )}
        </AppText>
        <AppText as="p" className="create-stage-page__free-note create-stage-page__free-note--secondary">
          {t(
            'create_stage_one_at_a_time',
            'You can host only one Stage at a time. After 24 hours it is removed and you can open a new one.'
          )}
        </AppText>

        <button type="submit" className="create-stage-page__submit" disabled={!canSubmit}>
          {submitting
            ? t('creating', 'Creating…')
            : isBusiness
              ? t('create_business_stage_open', 'Open business Stage')
              : t('create_stage_open', 'Open Stage')}
        </button>
      </form>
    </div>
  );
}
