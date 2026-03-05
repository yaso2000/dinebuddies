/**
 * OffersBanner.jsx
 * Cinematic offers slideshow — 7s per card (1s in / 5s hold / 1s out)
 * Beautiful inter-slide transitions cycling through 4 effects.
 * Loops infinitely. Expired offers (professional plan) are auto-filtered.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { db } from '../firebase/config';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import PremiumOfferCard from './PremiumOfferCard';
import './OffersBanner.css';

/* ─── Timing constants (ms) ─────────────────────────────────────── */
const T_IN = 1000;   // enter animation
const T_HOLD = 5000;   // display time
const T_OUT = 1000;   // exit animation

/* ─── Phase enum ────────────────────────────────────────────────── */
const PHASE = { ENTERING: 'entering', HOLDING: 'holding', EXITING: 'exiting' };

/* ─── Transition effects (4 styles, cycle per slide) ───────────── */
const EFFECTS = ['rise', 'sweep', 'zoom', 'flip'];

const OffersBanner = ({ onHasOffers } = {}) => {
    const navigate = useNavigate();
    const [offers, setOffers] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [phase, setPhase] = useState(PHASE.ENTERING);
    const [effectIdx, setEffectIdx] = useState(0);

    const phaseTimer = useRef(null);
    const clearTimers = () => { clearTimeout(phaseTimer.current); };

    /* ── Fetch active offers, filtering out expired ones ──────────── */
    useEffect(() => {
        const q = query(collection(db, 'active_offers'), where('status', '==', 'active'));
        const unsub = onSnapshot(q, snap => {
            const now = Date.now();
            const active = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(offer => {
                    // Elite offers are perpetual (expiresAt === null)
                    if (!offer.expiresAt) return true;
                    // Professional offers expire after 50h
                    const expiry = offer.expiresAt?.toDate?.() || new Date(offer.expiresAt);
                    return expiry.getTime() > now;
                });
            setOffers(active);
            onHasOffers?.(active.length > 0);
        }, err => console.error('❌ OffersBanner fetch error:', err));
        return () => { unsub(); clearTimers(); };
    }, []);

    /* ── Phase machine ─────────────────────────────────────────── */
    const advance = useCallback(() => {
        setPhase(PHASE.EXITING);

        phaseTimer.current = setTimeout(() => {
            setCurrentIndex(prev => (prev + 1) % offers.length);
            setEffectIdx(prev => (prev + 1) % EFFECTS.length);
            setPhase(PHASE.ENTERING);

            phaseTimer.current = setTimeout(() => {
                setPhase(PHASE.HOLDING);

                phaseTimer.current = setTimeout(advance, T_HOLD);
            }, T_IN);
        }, T_OUT);
    }, [offers.length]);

    useEffect(() => {
        if (offers.length === 0) return;
        clearTimers();

        // Kick off first cycle
        setPhase(PHASE.ENTERING);
        phaseTimer.current = setTimeout(() => {
            setPhase(PHASE.HOLDING);
            phaseTimer.current = setTimeout(advance, T_HOLD);
        }, T_IN);

        return clearTimers;
    }, [offers.length, advance]);

    if (offers.length === 0) return null;

    const effect = EFFECTS[effectIdx];
    const offer = offers[currentIndex];

    return (
        <div className="ob-container">
            {/* Progress bar */}
            <div
                className={`ob-progress ${phase === PHASE.HOLDING ? 'ob-progress--run' : ''}`}
                style={{ '--hold-ms': `${T_HOLD}ms` }}
            />

            {/* Card wrapper — class drives the animation */}
            <div
                key={`${currentIndex}-${effectIdx}`}
                className={`ob-slide ob-slide--${effect} ob-slide--${phase}`}
                onClick={() => offer?.partnerId && navigate(`/partner/${offer.partnerId}`)}
                style={{ cursor: offer?.partnerId ? 'pointer' : 'default' }}
            >
                <PremiumOfferCard offer={offer} compactHeight={true} />
            </div>

            {/* Dot indicators */}
            {offers.length > 1 && (
                <div className="ob-dots">
                    {offers.map((_, i) => (
                        <span key={i} className={`ob-dot ${i === currentIndex ? 'ob-dot--active' : ''}`} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default OffersBanner;
