import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft } from 'react-icons/fa';
import { AppText } from '../../components/base';
import { getList, allLists, entryName, listTitle, listSub } from './pickoneData';
import { runnerUp } from './duelEngine';
import usePickOne from './usePickOne';
import PickOneDuel from './PickOneDuel';
import PickOneResult from './PickOneResult';
import './pickone.css';

/** 2×2-ish collage (4 entries) for a list card. */
function ListCard({ list, language, onClick }) {
  const { t } = useTranslation();
  const sample = list.entries.filter((e) => e.tier === 1).slice(0, 4);
  const title = listTitle(list, language);
  const sub = listSub(list, language);
  return (
    <button type="button" className="po-listcard" onClick={onClick}>
      <div className="po-listcard__grid">
        {sample.map((e) => (
          <Cell key={e.id} entry={e} language={language} />
        ))}
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <AppText as="div" style={{ fontWeight: 900, fontSize: '1.05rem' }}>{title}</AppText>
        <AppText as="div" style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)' }}>
          {sub} · {t('pickone.list.count', { n: list.entries.length, defaultValue: `${list.entries.length} names` })}
        </AppText>
      </div>
    </button>
  );
}

function Cell({ entry, language }) {
  const [broken, setBroken] = useState(false);
  const name = entryName(entry, language);
  return (
    <div className="po-listcard__cell" style={{ background: `linear-gradient(160deg, ${entry.color}, #111)` }} title={name}>
      {entry.image && !broken ? <img src={entry.image} alt="" onError={() => setBroken(true)} /> : <span>{name.trim().charAt(0)}</span>}
    </div>
  );
}

/**
 * `/pickone` — category picker → duel (portal) → result.
 * `?list=<listId>` starts that list directly (deep link for ads).
 */
export default function PickOnePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const rtl = i18n.dir() === 'rtl';
  const language = i18n.language;
  const { lastResult, saveResult } = usePickOne();

  const [phase, setPhase] = useState('pick'); // 'pick' | 'duel' | 'result'
  const [list, setList] = useState(null);
  const [seed, setSeed] = useState(0);
  const [final, setFinal] = useState(null);
  const [sameAsLast, setSameAsLast] = useState(false);

  const start = (l) => {
    setList(l);
    setSeed((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    setFinal(null);
    setSameAsLast(false);
    setPhase('duel');
  };

  // Deep link: /pickone?list=singers-arab-f
  useEffect(() => {
    const id = params.get('list');
    if (!id) return;
    const l = getList(id);
    if (l) { start(l); }
    setParams({}, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFinish = async (state) => {
    const prev = lastResult(list.id);
    setSameAsLast(Boolean(prev?.championId && prev.championId === state.champion.id));
    setFinal(state);
    setPhase('result');
    saveResult({ listId: list.id, championId: state.champion.id, runnerUpId: runnerUp(state), seed: state.seed });
  };

  const goBack = () => {
    if (phase === 'result') { setPhase('pick'); return; }
    navigate(-1);
  };

  const lists = allLists();

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-body)' }} dir={i18n.dir()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(14px + env(safe-area-inset-top, 0px)) 16px 14px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
        <button type="button" onClick={goBack} aria-label={t('back', 'Back')} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.2rem', cursor: 'pointer' }}>
          <FaChevronLeft style={{ transform: rtl ? 'scaleX(-1)' : 'none' }} />
        </button>
        <AppText as="h2" style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{t('pickone.title', 'Pick One')}</AppText>
      </div>

      {phase === 'pick' && (
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '18px 16px calc(120px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <AppText as="p" style={{ margin: 0, textAlign: 'center', color: 'var(--text-secondary, #6b7280)', fontSize: '0.92rem' }}>
            {t('pickone.hint', 'Tap the one you prefer. Last one standing wins.')}
          </AppText>

          {lists.map((l) => (
            <ListCard key={l.id} list={l} language={language} onClick={() => start(l)} />
          ))}
        </div>
      )}

      {phase === 'duel' && list && (
        <PickOneDuel key={`${list.id}-${seed}`} list={list} seed={seed} onFinish={handleFinish} onExit={() => setPhase('pick')} />
      )}

      {phase === 'result' && list && final && (
        <PickOneResult
          list={list}
          state={final}
          sameAsLast={sameAsLast}
          onPlayAgain={() => start(list)}
          onPlayList={(l) => start(l)}
          onDone={() => navigate('/profile')}
        />
      )}
    </div>
  );
}
