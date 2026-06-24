import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaUsers, FaMars, FaVenus } from 'react-icons/fa';
import EmojiPicker from '../EmojiPicker';
import {
  DINING_PERSONA_PRESETS,
  DINING_PERSONA_MAX_TAGS,
  INVITE_PREFERENCE_OPTIONS,
  JOIN_REASON_MAX,
  FIRST_DATE_PLACE_HINT_MAX,
  getJoinReasonOptions } from
'../../constants/privateProfileOptions';
import './PrivateProfileFields.css';
import { AppText, AppTextInput } from "../base";

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
  showInvitePreference = true,
  onChange
}) {
  const { t } = useTranslation();
  const [customTag, setCustomTag] = useState('');
  const [pickedEmoji, setPickedEmoji] = useState(null);
  const [emojiWasPicked, setEmojiWasPicked] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const emit = (patch) =>
  onChange({
    diningPersona,
    invitePreference,
    firstDatePlaceHint,
    joinReasons,
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

  const addCustomTag = () => {
    const trimmed = customTag.trim();
    if (!emojiWasPicked || trimmed.length < 2) return;
    const emoji = pickedEmoji || DEFAULT_CUSTOM_EMOJI;
    const fullTag = `${emoji} ${trimmed}`.slice(0, 28);
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
  emojiWasPicked &&
  customTag.trim().length >= 2 &&
  diningPersona.length < DINING_PERSONA_MAX_TAGS;

  const joinReasonOptions = getJoinReasonOptions({ includePrivateOnly: showInvitePreference });

  return (
    <div className="private-profile-fields">
            {showInvitePreference ?
      <div>
                    <label className="private-profile-fields__pref-label">
                        {t('private_profile_invite_pref_title', 'Who can send you Private Invites?')}
                    </label>
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
                        <button
              type="button"
              className="private-profile-fields__emoji-btn"
              onClick={() => setShowEmojiPicker((open) => !open)}
              aria-label={t('pick_emoji', 'Pick emoji')}
              title={t('pick_emoji', 'Pick emoji')}>
              
                            {pickedEmoji ?? DEFAULT_CUSTOM_EMOJI}
                        </button>
                        {showEmojiPicker ?
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
            placeholder={t('private_profile_custom_tag_placeholder', 'Add your own…')}
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