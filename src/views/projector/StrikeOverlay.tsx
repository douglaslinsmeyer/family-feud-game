import { motion, AnimatePresence } from 'framer-motion';

export function StrikeOverlay({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.92 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.2, 1, 0.4, 1] }}
          style={{
            position: 'fixed', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', zIndex: 999,
          }}
        >
          <motion.div
            initial={{ rotate: -8 }}
            animate={{ rotate: [-8, 4, -3, 0] }}
            transition={{ duration: 0.5 }}
            style={{
              fontFamily: 'Bebas Neue',
              fontSize: '48vh',
              color: 'var(--red)',
              textShadow: '0 0 60px var(--red), 0 0 120px var(--red)',
            }}
          >X</motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
