import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LuX } from 'react-icons/lu';
import { ICEBREAKER_ITEMS } from '../../data/discoveryMockProfiles';
import './discovery.css';
import { AppText } from "../base";

export default function IcebreakerBottomSheet({ open, onClose, onSelect, profileName }) {
  return (
    <AnimatePresence>
            {open ?
      <>
                    <motion.button
          type="button"
          aria-label="Close"
          className="discovery-sheet-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose} />
        
                    <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Icebreaker menu"
          className="discovery-sheet"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.12}
          onDragEnd={(_, info) => {
            if (info.offset.y > 80 || info.velocity.y > 400) onClose();
          }}>
          
                        <div className="discovery-sheet__handle" />
                        <div className="discovery-sheet__header">
                            <div>
                                <AppText as="p" style={{ margin: 0, fontSize: '0.7rem', opacity: 0.55, fontWeight: 600 }}>
                                    Icebreaker
                                </AppText>
                                <AppText as="h3" style={{ margin: '0.2rem 0 0', fontSize: '1.1rem', fontWeight: 800 }}>
                                    {profileName ? `قل مرحباً لـ ${profileName}` : 'اختر تحية'}
                                </AppText>
                            </div>
                            <button type="button" className="discovery-icon-btn" onClick={onClose}>
                                <LuX size={18} />
                            </button>
                        </div>
                        <div className="discovery-sheet__grid">
                            {ICEBREAKER_ITEMS.map((item) =>
            <button
              key={item.id}
              type="button"
              className="discovery-sheet__item"
              onClick={() => {
                onSelect?.(item);
                onClose();
              }}>
              
                                    <AppText as="span" className="discovery-sheet__emoji" aria-hidden>
                                        {item.emoji}
                                    </AppText>
                                    <AppText as="span" className="discovery-sheet__label">{item.label}</AppText>
                                </button>
            )}
                        </div>
                    </motion.div>
                </> :
      null}
        </AnimatePresence>);

}