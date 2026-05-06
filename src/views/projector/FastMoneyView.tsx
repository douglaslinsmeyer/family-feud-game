import { motion, AnimatePresence, animate, useMotionValue } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import type { TournamentState } from '../../state/types';
import { useSfx } from '../../audio/AudioContext';

/**
 * Animates from 0 up to `to` over ~3 seconds.
 * Used in the reveal phase to show the final Fast Money total.
 */
function CountUp({ to }: { to: number }) {
  const [shown, setShown] = useState(0);
  const v = useMotionValue(0);

  useEffect(() => {
    const controls = animate(v, to, {
      duration: 3,
      ease: 'easeOut',
      onUpdate: latest => setShown(Math.round(latest)),
    });
    return controls.stop;
  }, [to, v]);

  return <span>{shown}</span>;
}

interface Props {
  state: TournamentState;
}

/**
 * Simplified Fast Money projector view.
 *
 * Trade-off: no synchronized countdown clock. The admin window owns the timer;
 * keeping it out of persisted state avoids a DDB write every second (20 writes
 * per player, 40 total) and prevents 1-3 second polling lag making the projector
 * timer look broken. The projector shows: player indicator + current totals.
 * In "reveal" phase (after COMPLETE_FAST_MONEY), the score counts up from 0.
 */
export function FastMoneyView({ state }: Props) {
  const fm = state.bracket.fastMoney!;
  const { play } = useSfx();

  // Phase detection:
  // - player1: fm.player2 is empty
  // - player2: fm.player2 has answers but totalScore not yet set (COMPLETE not fired)
  // - reveal: COMPLETE_FAST_MONEY has fired (totalScore > 0 or won is set)
  const hasPlayer2Answers = fm.player2.length > 0;
  const isReveal = hasPlayer2Answers && (fm.totalScore > 0 || fm.won);
  const phase = isReveal ? 'reveal' : hasPlayer2Answers ? 'player2' : 'player1';

  const runningTotal = fm.player1.reduce((s, a) => s + a.points, 0)
                     + fm.player2.reduce((s, a) => s + a.points, 0);

  // Play champion fanfare once when fm.won flips to true
  const prevWon = useRef(fm.won);
  useEffect(() => {
    if (fm.won && !prevWon.current) {
      play('champion');
    }
    prevWon.current = fm.won;
  }, [fm.won, play]);

  return (
    <div
      style={{
        height: '100vh',
        background: 'linear-gradient(180deg, #0a1d4f 0%, #061236 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 24,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <h1
        style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontSize: 'clamp(48px, 8vw, 96px)',
          color: 'var(--gold)',
          textShadow: '0 0 32px var(--gold)',
          margin: 0,
          letterSpacing: 4,
        }}
      >
        FAST MONEY
      </h1>

      <AnimatePresence mode="wait">
        {isReveal ? (
          <motion.div
            key="reveal"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 'clamp(120px, 20vw, 260px)',
              lineHeight: 1,
              color: fm.won ? 'var(--gold)' : '#e55',
              textShadow: `0 0 60px ${fm.won ? 'var(--gold)' : '#e55'}`,
            }}
          >
            <CountUp to={runningTotal} />
          </motion.div>
        ) : (
          <motion.div
            key="player-indicator"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 'clamp(56px, 10vw, 140px)',
              lineHeight: 1,
              color: 'white',
              textAlign: 'center',
            }}
          >
            PLAYER {phase === 'player1' ? '1' : '2'}
          </motion.div>
        )}
      </AnimatePresence>

      {isReveal && (
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 'clamp(28px, 4vw, 52px)',
            letterSpacing: 6,
            color: fm.won ? 'var(--gold)' : '#ff7777',
            textShadow: fm.won ? '0 0 20px var(--gold)' : 'none',
          }}
        >
          {fm.won ? '★ YOU WIN! ★' : 'NOT ENOUGH — NEED 200'}
        </motion.div>
      )}

      {!isReveal && phase === 'player2' && fm.player1.length > 0 && (
        <div
          style={{
            fontFamily: 'Fjalla One, sans-serif',
            fontSize: 'clamp(18px, 2.5vw, 28px)',
            color: 'rgba(255,215,0,0.7)',
            letterSpacing: 2,
          }}
        >
          Player 1 scored: {fm.player1.reduce((s, a) => s + a.points, 0)} pts
        </div>
      )}
    </div>
  );
}
