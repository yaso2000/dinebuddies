import React, { useEffect, useRef, useState } from 'react';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { AppTextInput } from './base';
import { matchesAllTokens } from '../utils/searchNormalize';

/**
 * Unified directory search box — one field that finds an item by name AND filters
 * by city or country, all from loaded data (free, no external API). Matching is
 * lenient/normalized (ignores hamza/tashkeel differences) and spans the item's
 * name + city as well as the place suggestions.
 *
 * - `text` / `onTextChange`   — free-text query (drives the list; matched across fields by the parent).
 * - `place` / `onPlaceChange` — selected { id, type:'country'|'city', value, label, sublabel } or null.
 * - `items` — [{ id, name, city }] for name suggestions (venues or members).
 * - `places` — [{ id, type, value, label, sublabel }] place suggestions.
 * - `itemIcon` — emoji shown next to item (name) suggestions. Default 🍴.
 */
export default function DirectorySearchBar({
  text,
  onTextChange,
  place,
  onPlaceChange,
  items = [],
  places = [],
  placeholder,
  clearLabel,
  itemIcon = '🍴',
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  // When a place is selected the box shows its label; otherwise the typed text.
  const display = place ? place.label : text;
  const q = place ? '' : text;

  const itemMatches = q.trim() ?
  items.filter((it) => matchesAllTokens(`${it.name} ${it.city || ''}`, q)).slice(0, 6) :
  [];
  const placeMatches = (q.trim() ?
  places.filter((o) => matchesAllTokens(`${o.label} ${o.sublabel || ''}`, q)) :
  places).slice(0, 6);

  const suggestions = [
  ...itemMatches.map((it) => ({ kind: 'item', id: `i:${it.id}`, label: it.name, sublabel: it.city, name: it.name })),
  ...placeMatches.map((p) => ({ kind: 'place', id: `p:${p.id}`, label: p.label, sublabel: p.sublabel, type: p.type, place: p }))].
  slice(0, 10);

  const pick = (item) => {
    if (item.kind === 'item') {
      onPlaceChange(null);
      onTextChange(item.name);
    } else {
      onTextChange('');
      onPlaceChange(item.place);
    }
    setOpen(false);
  };
  const clear = () => {
    onTextChange('');
    onPlaceChange(null);
    setOpen(false);
  };

  const iconFor = (item) => item.kind === 'item' ? itemIcon : item.type === 'city' ? '🏙️' : '🌍';

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: '1 1 auto', minWidth: '200px' }}>
      <FaSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem', pointerEvents: 'none' }} />
      <AppTextInput
        type="text"
        value={display}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const v = e.target.value;
          if (place) onPlaceChange(null);
          onTextChange(v);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && suggestions.length > 0) {
            e.preventDefault();
            pick(suggestions[0]);
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        aria-label={placeholder}
        style={{
          width: '100%',
          height: '38px',
          padding: '10px 30px 10px 36px',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          background: 'var(--bg-main)',
          color: 'var(--text-main)',
          fontSize: '0.85rem',
        }} />
      {(place || text) &&
      <button
        type="button"
        onClick={clear}
        aria-label={clearLabel}
        style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}>
        <FaTimes />
      </button>
      }
      {open && suggestions.length > 0 &&
      <div
        role="listbox"
        style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          minWidth: '100%',
          maxWidth: '300px',
          zIndex: 60,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}>
        {suggestions.map((item) =>
        <button
          key={item.id}
          type="button"
          role="option"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pick(item)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            textAlign: 'start',
            padding: '9px 12px',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-main)',
            fontSize: '0.85rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}>
          <span style={{ fontSize: '0.9rem', flex: '0 0 auto' }}>{iconFor(item)}</span>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.label}
            {item.sublabel ?
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> · {item.sublabel}</span> :
            null}
          </span>
        </button>
        )}
      </div>
      }
    </div>);
}
