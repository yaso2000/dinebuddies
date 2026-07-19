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
import { useJoinedStages } from '../hooks/useJoinedStages';
import app from '../firebase/config';
import { getMutualFollowers } from '../utils/followHelpers';
import { getSafeAvatar } from '../utils/avatarUtils';
import './CreateStage.css';

const MAX_INVITEES = 40;

export default function CreateStage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { currentUser, userProfile, cannotCreateInvitations } = useAuth();
  const { stages, loading: stagesLoading } = useJoinedStages();
  const [title, setTitle] = useState('');
  const [mutuals, setMutuals] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [loadingMutuals, setLoadingMutuals] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const uid = currentUser?.uid || userProfile?.id;

  const existingHostedStage = useMemo(
    () => stages.find((s) => s.isHost) || null,
    [stages]
  );

  useEffect(() => {
    if (cannotCreateInvitations) {
      showToast(t('business_cannot_create_invitation'), 'error');
      navigate(-1);
    }
  }, [cannotCreateInvitations, navigate, showToast, t]);

  useEffect(() => {
    if (!stagesLoading && existingHostedStage?.id) {
      showToast(
        t(
          'stage_already_open',
          'You already have an open Stage. Open it instead of creating a new one.'
        ),
        'info'
      );
      navigate(`/stage/${existingHostedStage.id}`, { replace: true });
    }
  }, [stagesLoading, existingHostedStage, navigate, showToast, t]);

  useEffect(() => {
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
  }, [uid, userProfile?.following]);

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

  const blockedByExisting = Boolean(existingHostedStage);
  const canSubmit =
    selectedCount > 0 && !submitting && !cannotCreateInvitations && !blockedByExisting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const functions = getFunctions(app, 'us-central1');
      const createStageRoom = httpsCallable(functions, 'createStageRoom');
      const result = await createStageRoom({
        title: title.trim(),
        inviteeIds: [...selectedIds],
      });
      const stageId = result?.data?.stageId;
      if (!stageId) {
        throw new Error('missing_stage_id');
      }
      showToast(t('stage_created', 'Stage opened'), 'success');
      navigate(`/stage/${stageId}`, { replace: true });
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
      const code = String(err?.code || '');
      const msg =
        code.includes('failed-precondition') || code.includes('invalid-argument')
          ? err.message?.replace(/^Firebase: | \(functions\/.*\)\.?$/g, '').trim() ||
            t('stage_create_failed', 'Could not create Stage. Try again.')
          : t('stage_create_failed', 'Could not create Stage. Try again.');
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const subtitle = useMemo(
    () =>
      t(
        'create_stage_subtitle',
        'Pick mutual follows to invite. A new Stage room opens for this event.'
      ),
    [t]
  );

  if (stagesLoading || existingHostedStage) {
    return (
      <div className="create-stage-page">
        <AppText as="p" className="create-stage-page__hint">
          {t('loading', 'Loading…')}
        </AppText>
        {existingHostedStage ? (
          <Link to={`/stage/${existingHostedStage.id}`} className="create-stage-page__submit">
            {t('stage_open_existing', 'Open your Stage')}
          </Link>
        ) : null}
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
              {t('create_stage_title', 'Open Stage')}
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
            placeholder={t('create_stage_title_placeholder', 'Tonight’s Stage')}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className="create-stage-page__field">
          <div className="create-stage-page__label-row">
            <AppText as="span" className="create-stage-page__label">
              {t('create_stage_guests', 'Guests (mutual follows)')}
            </AppText>
            <AppText as="span" className="create-stage-page__count">
              {selectedCount}/{MAX_INVITEES}
            </AppText>
          </div>

          {loadingMutuals ? (
            <AppText as="p" className="create-stage-page__hint">
              {t('loading', 'Loading…')}
            </AppText>
          ) : mutuals.length === 0 ? (
            <AppText as="p" className="create-stage-page__hint">
              {t(
                'create_stage_no_mutuals',
                'You need at least one mutual follow to open a Stage.'
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
        </div>

        <AppText as="p" className="create-stage-page__pricing-note">
          {t(
            'create_stage_one_at_a_time',
            'You can host only one Stage at a time. After 24 hours it is removed and you can open a new one.'
          )}
        </AppText>

        <button type="submit" className="create-stage-page__submit" disabled={!canSubmit}>
          {submitting
            ? t('creating', 'Creating…')
            : t('create_stage_open', 'Open Stage')}
        </button>
      </form>
    </div>
  );
}
