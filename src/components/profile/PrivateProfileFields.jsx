import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaUsers, FaMars, FaVenus, FaHeart } from 'react-icons/fa';
import EmojiPicker from '../EmojiPicker';
import {
  DINING_PERSONA_PRESETS,
  DINING_PERSONA_MAX_TAGS,
  INVITE_PREFERENCE_OPTIONS,
  JOIN_REASON_MAX,
  FIRST_DATE_PLACE_HINT_MAX,
  getJoinReasonOptions,
  isInvitePreferenceChosen,
} from '../../constants/privateProfileOptions';
import {
  getLookingForOptions,
} from '../../constants/personalInviteCategories';
import {
  syncLookingForWithOpenToDating,
} from '../../utils/openToDating';
import './PrivateProfileFields.css';
import { AppText, AppTextInput } from "../base";
import { shouldUseAppEmojiPicker, showComposerEmojiButton } from '../../utils/emojiInputMode';

const INVITE_PREF_ICONS = {
  any: FaUsers,
  male: FaMars,
  female: FaVenus
};

const DEFAULT_CUSTOM_EMOJI = '✨';

/**
 * Unified profile fields — interests & intent always visible; invite preference only when accepting private invites.
 */
export default function PrivateProfileFields({
  diningPersona = [],
  invitePreference = 'any',
  firstDatePlaceHint = '',
  joinReasons = [],
  lookingFor = [],
  openToDating = false,
  availableForPrivateInvite = true,
  showAvailableForPrivateInviteToggle = false,
  showInvitePreference = true,
  requireInviteFields = false,
  onChange
}) {
  const { t } = useTranslation();
  const [customTag, setCustomTag] = useState('');
  const [pickedEmoji, setPickedEmoji] = useState(null);
  const [emojiWasPicked, setEmojiWasPicked] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const useDesktopEmojiPicker = shouldUseAppEmojiPicker();

  const emit = (patch) =>
  onChange({
    diningPersona,
    invitePreference,
    firstDatePlaceHint,
    joinReasons,
    lookingFor,
    openToDating,
    availableForPrivateInvite,
    ...patch
  });

  const togglePreset = (tag) => {
    const has = diningPersona.includes(tag);
    if (has) {
      emit({ diningPersona: diningPersona.filter((item) => item !== tag) });
      return;
    }
    if (diningPersona.length >= DINING_PERSONA_MAX_TAGS) return;
    emit({ diningPersona: [...diningPersona, tag] });
  };

  const toggleJoinReason = (id) => {
    const has = joinReasons.includes(id);
    if (has) {
      emit({ joinReasons: joinReasons.filter((item) => item !== id) });
      return;
    }
    if (joinReasons.length >= JOIN_REASON_MAX) return;
    emit({ joinReasons: [...joinReasons, id] });
  };

  const toggleLookingFor = (id) => {
    const has = lookingFor.includes(id);
    if (has) {
      emit({ lookingFor: lookingFor.filter((item) => item !== id) });
      return;
    }
    emit({ lookingFor: [...lookingFor, id] });
  };

  const addCustomTag = () => {
    const trimmed = customTag.trim();
    if (trimmed.length < 2) return;

    const fullTag = useDesktopEmojiPicker
      ? `${pickedEmoji || DEFAULT_CUSTOM_EMOJI} ${trimmed}`.slice(0, 28)
      : trimmed.slice(0, 28);

    if (useDesktopEmojiPicker && !emojiWasPicked) return;

    if (diningPersona.some((item) => item.toLowerCase() === fullTag.toLowerCase())) {
      setCustomTag('');
      setPickedEmoji(null);
      setEmojiWasPicked(false);
      return;
    }
    if (diningPersona.length >= DINING_PERSONA_MAX_TAGS) return;
    emit({ diningPersona: [...diningPersona, fullTag] });
    setCustomTag('');
    setPickedEmoji(null);
    setEmojiWasPicked(false);
  };

  const removeTag = (tag) => {
    emit({ diningPersona: diningPersona.filter((item) => item !== tag) });
  };

  const canAddCustom =
  (useDesktopEmojiPicker ? emojiWasPicked : true) &&
  customTag.trim().length >= 2 &&
  diningPersona.length < DINING_PERSONA_MAX_TAGS;

  const joinReasonOptions = getJoinReasonOptions({ includePrivateOnly: showInvitePreference });
  const lookingForOptions = getLookingForOptions({ includeDating: openToDating });
  const invitePrefMissing = requireInviteFields && !isInvitePreferenceChosen(invitePreference);
  const lookingForMissing = requireInviteFields && !lookingFor.length;

  const setOpenToDating = (next) => {
    emit({
      openToDating: next,
      lookingFor: syncLookingForWithOpenToDating(lookingFor, next),
    });
  };

  return (
    <div className="private-profile-fields">
            {showAvailableForPrivateInviteToggle ?
      <div className={`private-profile-fields__dating-switch${availableForPrivateInvite ? ' private-profile-fields__dating-switch--on private-profile-fields__private-invite-switch--on' : ''}`}>
                <div className="private-profile-fields__dating-switch-copy">
                    <label className="private-profile-fields__pref-label private-profile-fields__dating-label" htmlFor="profile-available-private-invite">
                        {t('available_for_private_invite', 'Available for private invitations')}
                    </label>
                    <AppText as="p" className="private-profile-fields__join-hint">
                        {t(
              'admin_demo_user_private_invite_hint',
              'When off, this demo user only accepts public/social invites.'
            )}
                    </AppText>
                </div>
                <button
          id="profile-available-private-invite"
          type="button"
          role="switch"
          aria-checked={availableForPrivateInvite === true}
          className={`private-profile-fields__switch private-profile-fields__switch--invite${availableForPrivateInvite ? ' private-profile-fields__switch--on private-profile-fields__switch--invite-on' : ''}`}
          onClick={() => emit({ availableForPrivateInvite: !availableForPrivateInvite })}>
          
                    <AppText as="span" className="private-profile-fields__switch-knob" aria-hidden />
                </button>
            </div> :
      null}

            <div className={`private-profile-fields__dating-switch${openToDating ? ' private-profile-fields__dating-switch--on' : ''}`}>
                <div className="private-profile-fields__dating-switch-copy">
                    <label className="private-profile-fields__pref-label private-profile-fields__dating-label" htmlFor="profile-open-to-dating">
                        <FaHeart
              className={`private-profile-fields__dating-label-icon${openToDating ? '' : ' private-profile-fields__dating-label-icon--muted'}`}
              aria-hidden />
                        {t('profile_open_to_dating_title', 'Open to dating')}
                    </label>
                    <AppText as="p" className="private-profile-fields__join-hint">
                        {t(
              'profile_open_to_dating_hint',
              'When on, others see a heart on your card (dating). When off, they can follow you as friends.'
            )}
                    </AppText>
                </div>
                <button
          id="profile-open-to-dating"
          type="button"
          role="switch"
          aria-checked={openToDating === true}
          className={`private-profile-fields__switch${openToDating ? ' private-profile-fields__switch--on' : ''}`}
          onClick={() => setOpenToDating(!openToDating)}>
          
                    {openToDating ?
          <FaHeart className="private-profile-fields__switch-heart" aria-hidden /> :
          null}
                    <AppText as="span" className="private-profile-fields__switch-knob" aria-hidden />
                </button>
            </div>

            {showInvitePreference ?
      <div className={invitePrefMissing ? 'private-profile-fields__section--required' : ''}>
                    <label className="private-profile-fields__pref-label">
                        {t('private_profile_invite_pref_title', 'Who can send you Private Invites?')}
                        {requireInviteFields ?
            <AppText as="span" className="private-profile-fields__required-mark" aria-hidden> *</AppText> :
            null}
                    </label>
                    {invitePrefMissing ?
          <AppText as="p" className="private-profile-fields__required-hint" role="alert">
                        {t(
              'profile_private_invite_gender_pref_required',
              'Choose who can send you private invites (gender preference).'
            )}
                    </AppText> :
          null}
                    <div className="private-profile-fields__pref-row">
                        {INVITE_PREFERENCE_OPTIONS.map((opt) => {
            const active = invitePreference === opt.value;
            const Icon = INVITE_PREF_ICONS[opt.icon] || FaUsers;
            return (
              <button
                key={opt.value}
                type="button"
                className={`private-profile-fields__pref-btn${active ? ' private-profile-fields__pref-btn--active' : ''}`}
                onClick={() => emit({ invitePreference: opt.value })}
                title={t(opt.labelKey, opt.fallback)}>
                
                                    <Icon className="private-profile-fields__pref-icon" aria-hidden />
                                    <AppText as="span" className="private-profile-fields__pref-label-text">
                                        {t(opt.labelKey, opt.fallback)}
                                    </AppText>
                                </button>);

          })}
                    </div>
                </div> :
      null}

            <div className={lookingForMissing ? 'private-profile-fields__section--required' : ''}>
                <label className="private-profile-fields__pref-label">
                    {t('profile_looking_for_title', 'Looking for')}
                    {requireInviteFields ?
          <AppText as="span" className="private-profile-fields__required-mark" aria-hidden> *</AppText> :
          null}
                </label>
                <AppText as="p" className="private-profile-fields__join-hint">
                    {t(
            'profile_looking_for_hint',
            'Select all that apply — your relationship intentions on DineBuddies.'
          )}
                </AppText>
                {lookingForMissing ?
        <AppText as="p" className="private-profile-fields__required-hint" role="alert">
                    {t(
            'profile_private_invite_looking_for_required',
            'Select at least one option under Looking for.'
          )}
                </AppText> :
        null}
                <div className="private-profile-fields__looking-for">
                    {lookingForOptions.map((opt) => {
            const active = lookingFor.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                className={`private-profile-fields__looking-btn${active ? ' private-profile-fields__looking-btn--active' : ''}`}
                onClick={() => toggleLookingFor(opt.id)}>
                
                                <AppText as="span" className="private-profile-fields__looking-icon" aria-hidden>
                                    {opt.icon}
                                </AppText>
                                {t(opt.labelKey, opt.defaultLabel)}
                            </button>);

          })}
                </div>
            </div>

            <div>
                <label className="private-profile-fields__pref-label">
                    {t('join_reason_title', 'Reason for Joining')}
                </label>
                <AppText as="p" className="private-profile-fields__join-hint">
                    {t('join_reason_hint', 'Pick up to 2 — helps others know what you are here for.')}
                </AppText>
                <div className="private-profile-fields__join-reasons">
                    {joinReasonOptions.map((opt) => {
            const active = joinReasons.includes(opt.id);
            const atMax = joinReasons.length >= JOIN_REASON_MAX && !active;
            return (
              <button
                key={opt.id}
                type="button"
                className={`private-profile-fields__join-btn${active ? ' private-profile-fields__join-btn--active' : ''}`}
                onClick={() => toggleJoinReason(opt.id)}
                disabled={atMax}>
                
                                {t(opt.labelKey, opt.fallback)}
                            </button>);

          })}
                </div>
                <AppText as="p" className="private-profile-fields__count">
                    {joinReasons.length} / {JOIN_REASON_MAX}
                </AppText>
            </div>

            <div className="private-profile-fields__header">
                <AppText as="h3" className="private-profile-fields__title">
                    {t('private_profile_taste_title', 'Vibe & Interests')}
                </AppText>
                <AppText as="p" className="private-profile-fields__desc">
                    {t(
            'private_profile_taste_desc',
            'Help others know your favorite activities for 1-on-1 meetups'
          )}
                </AppText>
            </div>

            <div className="private-profile-fields__presets">
                {DINING_PERSONA_PRESETS.map((tag) => {
          const active = diningPersona.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              className={`private-profile-fields__preset${active ? ' private-profile-fields__preset--active' : ''}`}
              onClick={() => togglePreset(tag)}
              title={tag}>
              
                            {tag}
                        </button>);

        })}
            </div>

            <div className="private-profile-fields__custom-row">
                <div className="private-profile-fields__custom-tag-row">
                    <div className="private-profile-fields__emoji-wrap">
                        {showComposerEmojiButton() ? (
                        <button
              type="button"
              className="private-profile-fields__emoji-btn"
              onClick={() => setShowEmojiPicker((open) => !open)}
              aria-label={t('pick_emoji', 'Pick emoji')}
              title={t('pick_emoji', 'Pick emoji')}>
              
                            {pickedEmoji ?? DEFAULT_CUSTOM_EMOJI}
                        </button>
                        ) : null}
                        {showEmojiPicker && useDesktopEmojiPicker ?
            <div className="private-profile-fields__emoji-popover">
                                <EmojiPicker
                onEmojiSelect={(emoji) => {
                  setPickedEmoji(emoji);
                  setEmojiWasPicked(true);
                  setShowEmojiPicker(false);
                }}
                onClose={() => setShowEmojiPicker(false)} />
              
                            </div> :
            null}
                    </div>
                    <AppTextInput
            type="text"
            className="ui-form-field private-profile-fields__custom-input"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomTag();
              }
            }}
            placeholder={
              useDesktopEmojiPicker
                ? t('private_profile_custom_tag_placeholder', 'Add your own…')
                : t('private_profile_custom_tag_mobile_placeholder', 'Add emoji + text from keyboard…')
            }
            maxLength={24} />
          
                </div>
                <button
          type="button"
          className="ui-btn ui-btn--secondary private-profile-fields__add-btn"
          onClick={addCustomTag}
          disabled={!canAddCustom}>
          
                    {t('add', 'Add')}
                </button>
            </div>

            {diningPersona.length > 0 &&
      <div className="private-profile-fields__selected">
                    {diningPersona.map((tag) =>
        <AppText as="span" key={tag} className="private-profile-fields__chip">
                            <AppText as="span" className="private-profile-fields__chip-label">{tag}</AppText>
                            <button
            type="button"
            className="private-profile-fields__chip-remove"
            onClick={() => removeTag(tag)}
            aria-label={t('remove', 'Remove')}>
            
                                ×
                            </button>
                        </AppText>
        )}
                </div>
      }

            <AppText as="p" className="private-profile-fields__count">
                {diningPersona.length} / {DINING_PERSONA_MAX_TAGS}
            </AppText>

            <div>
                <label className="private-profile-fields__pref-label" htmlFor="meetup-spot-hint">
                    {t('private_meetup_spot_title', 'Ideal meetup spot')}
                </label>
                <AppTextInput
          id="meetup-spot-hint"
          type="text"
          className="ui-form-field private-profile-fields__first-place-input"
          value={firstDatePlaceHint}
          onChange={(e) => emit({ firstDatePlaceHint: e.target.value })}
          placeholder={t(
            'private_meetup_spot_placeholder',
            'e.g. cozy café, art gallery, walking track...'
          )}
          maxLength={FIRST_DATE_PLACE_HINT_MAX} />
        
                <AppText as="p" className="private-profile-fields__first-place-count">
                    {firstDatePlaceHint.length} / {FIRST_DATE_PLACE_HINT_MAX}
                </AppText>
            </div>
        </div>);

}