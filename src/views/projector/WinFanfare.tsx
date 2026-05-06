import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

interface Props {
  teamName: string | null;
}

/**
 * Full-screen champion fanfare overlay.
 *
 * Renders when teamName is non-null. Auto-dismisses after 12 seconds so the
 * bracket is visible again for the audience. The host can also manually dismiss
 * by clicking the overlay.
 */
export function WinFanfare({ teamName }: Props) {
  const [visible, setVisible] = useState(false);
  const [shownTeam, setShownTeam] = useState<string | null>(null);

  // Delay-mount 1s after champion is set, then auto-dismiss after 12s
  useEffect(() => {
    if (!teamName) {
      setVisible(false);
      return;
    }
    setShownTeam(teamName);
    const mountTimer = setTimeout(() => setVisible(true), 1000);
    const dismissTimer = setTimeout(() => setVisible(false), 13000); // 1s delay + 12s display
    return () => {
      clearTimeout(mountTimer);
      clearTimeout(dismissTimer);
    };
  }, [teamName]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          onClick={() => setVisible(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'radial-gradient(ellipse at center, rgba(255,215,0,0.95) 0%, var(--bg-deep) 70%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 998,
            cursor: 'pointer',
          }}
        >
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: [0.4, 1.15, 1], opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.2, 1, 0.4, 1] }}
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 'clamp(36px, 6vw, 72px)',
              letterSpacing: 10,
              color: 'var(--bg-deep)',
              textShadow: '0 2px 0 rgba(0,0,0,0.15)',
            }}
          >
            CHAMPIONS
          </motion.div>

          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 'clamp(72px, 14vw, 200px)',
              color: 'var(--bg-deep)',
              textShadow: '0 8px 0 rgba(0,0,0,0.2)',
              lineHeight: 1,
              textAlign: 'center',
              maxWidth: '90vw',
            }}
          >
            {shownTeam}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            style={{
              position: 'absolute',
              bottom: 32,
              color: 'rgba(0,0,0,0.4)',
              fontFamily: 'Fjalla One, sans-serif',
              fontSize: 14,
              letterSpacing: 2,
            }}
          >
            Click to dismiss
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
