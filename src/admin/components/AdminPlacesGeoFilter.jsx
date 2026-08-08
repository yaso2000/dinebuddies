import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Country, State } from 'country-state-city';
import CityAutocomplete from '../../components/CityAutocomplete';
import { AppText, AppTextInput } from "../../components/base";

const fieldStyle = {
  width: '100%',
  padding: '0.65rem 0.75rem',
  borderRadius: 8,
  border: '1px solid var(--db-border, var(--border-color))',
  background: 'var(--db-input-bg, var(--bg-input))',
  color: 'var(--db-text, var(--text-main))',
  fontSize: '0.95rem'
};

const panelStyle = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  zIndex: 40,
  borderRadius: 8,
  border: '1px solid var(--db-border, var(--border-color))',
  background: 'var(--db-input-bg, var(--bg-input))',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  overflow: 'hidden'
};

/**
 * Dropdown list with an integrated search row as the first item inside the panel.
 * @param {{
 *   id: string;
 *   placeholder: string;
 *   searchPlaceholder: string;
 *   value: string;
 *   options: { value: string; label: string }[];
 *   disabled?: boolean;
 *   onChange: (value: string) => void;
 *   emptyMessage?: string;
 * }} props
 */
function GeoSearchableList({
  id,
  placeholder,
  searchPlaceholder,
  value,
  options,
  disabled = false,
  onChange,
  emptyMessage
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);
  const searchRef = useRef(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
      o.label.toLowerCase().startsWith(q) ||
      o.value.toLowerCase().startsWith(q)
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const handleSelect = (next) => {
    onChange(next);
    close();
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
            <button
        type="button"
        id={id}
        className="db-input"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
          if (open) setQuery('');
        }}
        style={{
          ...fieldStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.55 : 1,
          textAlign: 'start'
        }}>
        
                <AppText as="span"
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: selected ? 'inherit' : 'var(--db-muted, var(--text-secondary))'
        }}>
          
                    {selected ? selected.label : placeholder}
                </AppText>
                <AppText as="span" aria-hidden style={{ flexShrink: 0, opacity: 0.65, fontSize: '0.75rem' }}>
                    {open ? '▲' : '▼'}
                </AppText>
            </button>

            {open && !disabled &&
      <div style={panelStyle} role="presentation">
                    <div
          style={{
            padding: '0.45rem',
            borderBottom: '1px solid var(--db-border, var(--border-color))',
            background: 'var(--db-input-bg, var(--bg-input))'
          }}>
          
                        <AppTextInput
            ref={searchRef}
            type="search"
            className="db-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                close();
              }
              if (e.key === 'Enter' && filtered.length === 1) {
                e.preventDefault();
                handleSelect(filtered[0].value);
              }
            }}
            placeholder={searchPlaceholder}
            autoComplete="off"
            aria-label={searchPlaceholder}
            style={{
              ...fieldStyle,
              padding: '0.5rem 0.65rem',
              fontSize: '0.9rem'
            }} />
          
                    </div>

                    <ul
          role="listbox"
          aria-labelledby={id}
          style={{
            listStyle: 'none',
            margin: 0,
            padding: '0.25rem 0',
            maxHeight: 240,
            overflowY: 'auto'
          }}>
          
                        {filtered.length === 0 ?
          <li
            className="db-muted"
            style={{ padding: '0.65rem 0.85rem', fontSize: '0.85rem' }}>
            
                                {query.trim() ?
            t('admin_geo_no_results_query', { query: query.trim() }) :
            emptyMessage || t('admin_geo_no_results')}
                            </li> :

          filtered.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li key={opt.value} role="presentation">
                                        <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: isSelected ?
                    'color-mix(in srgb, var(--brand-primary, #6366f1) 18%, transparent)' :
                    'transparent',
                    color: 'var(--db-text, var(--text-main))',
                    textAlign: 'start',
                    padding: '0.55rem 0.85rem',
                    fontSize: '0.92rem',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background =
                      'color-mix(in srgb, var(--brand-primary, #6366f1) 10%, transparent)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}>
                  
                                            {opt.label}
                                        </button>
                                    </li>);

          })
          }
                    </ul>
                </div>
      }
        </div>);

}

/**
 * Cascaded geo filters for admin Google Places import: country → state/province → city.
 * @param {{ onFilterChange: (filter: {
 *   countryCode: string;
 *   countryName: string;
 *   stateCode: string;
 *   stateName: string;
 *   city: string;
 *   readyForBusinessSearch: boolean;
 * }) => void }} props
 */
export default function AdminPlacesGeoFilter({ onFilterChange }) {
  const { t } = useTranslation();
  const [countryIso, setCountryIso] = useState('');
  const [stateIso, setStateIso] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [cityResolved, setCityResolved] = useState('');

  const countries = useMemo(
    () => Country.getAllCountries().sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const countryOptions = useMemo(
    () =>
    countries.map((c) => ({
      value: c.isoCode,
      label: `${c.flag} ${c.name}`
    })),
    [countries]
  );

  const states = useMemo(
    () => countryIso ? State.getStatesOfCountry(countryIso) : [],
    [countryIso]
  );

  const stateOptions = useMemo(
    () => states.map((s) => ({ value: s.isoCode, label: s.name })),
    [states]
  );

  const country = useMemo(
    () => countryIso ? Country.getCountryByCode(countryIso) : null,
    [countryIso]
  );

  const state = useMemo(
    () => states.find((s) => s.isoCode === stateIso) || null,
    [states, stateIso]
  );

  const hasStates = states.length > 0;
  const stateStepDone = !hasStates || Boolean(stateIso);
  const cityStepEnabled = Boolean(countryIso) && stateStepDone;
  const readyForBusinessSearch =
  Boolean(countryIso) && stateStepDone && String(cityResolved || '').trim().length >= 2;

  useEffect(() => {
    onFilterChange({
      countryCode: countryIso,
      countryName: country?.name || '',
      stateCode: stateIso,
      stateName: state?.name || '',
      city: cityResolved,
      readyForBusinessSearch
    });
  }, [
  countryIso,
  country?.name,
  stateIso,
  state?.name,
  cityResolved,
  readyForBusinessSearch,
  onFilterChange]
  );

  const handleCountryChange = (next) => {
    setCountryIso(next);
    setStateIso('');
    setCityInput('');
    setCityResolved('');
  };

  const handleStateChange = (next) => {
    setStateIso(next);
    setCityInput('');
    setCityResolved('');
  };

  const handleCitySelect = ({ city }) => {
    const name = String(city || '').trim();
    setCityInput(name);
    setCityResolved(name);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
                <label className="db-label" htmlFor="admin-geo-country">
                    {t('admin_geo_country_label')}
                </label>
                <GeoSearchableList
          id="admin-geo-country"
          placeholder={t('admin_geo_country_placeholder')}
          searchPlaceholder={t('admin_geo_country_search')}
          value={countryIso}
          options={countryOptions}
          onChange={handleCountryChange}
          emptyMessage={t('admin_geo_no_countries')} />
        
            </div>

            {hasStates &&
      <div>
                    <label className="db-label" htmlFor="admin-geo-state">
                        {t('admin_geo_state_label')}
                    </label>
                    <GeoSearchableList
          id="admin-geo-state"
          placeholder={t('admin_geo_state_placeholder')}
          searchPlaceholder={t('admin_geo_state_search')}
          value={stateIso}
          options={stateOptions}
          disabled={!countryIso}
          onChange={handleStateChange}
          emptyMessage={t('admin_geo_no_states')} />
        
                </div>
      }

            <div>
                <label className="db-label" htmlFor="admin-geo-city">
                    {t('admin_geo_city_label', { step: hasStates ? '3' : '2' })}
                </label>
                <CityAutocomplete
          value={cityInput}
          countryCode={countryIso}
          stateOrRegion={state?.name || ''}
          disabled={!cityStepEnabled}
          placeholder={
          !countryIso ?
          t('admin_geo_city_select_country') :
          hasStates && !stateIso ?
          t('admin_geo_city_select_state') :
          t('admin_geo_city_placeholder')
          }
          onSelect={handleCitySelect} />
        
                {!cityStepEnabled &&
        <AppText as="p" className="db-muted" style={{ marginTop: '0.35rem', fontSize: '0.8rem' }}>
                        {t('admin_geo_city_search_disabled')}
                    </AppText>
        }
                {cityResolved &&
        <AppText as="p" className="db-muted" style={{ marginTop: '0.35rem', fontSize: '0.8rem' }}>
                        {t('admin_geo_city_selected', {
            city: cityResolved,
            region: state?.name ? ` — ${state.name}` : '',
            country: country?.name ? `, ${country.name}` : ''
          })}
                    </AppText>
        }
            </div>
        </div>);

}