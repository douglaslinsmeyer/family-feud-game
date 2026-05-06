import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { TournamentState } from '../../state/types';
import { QUESTIONS } from '../../content/questions';
import { getCurrentMatch } from '../../state/bracketLogic';
import { matchOverWinningTeamId } from '../../state/selectors';
import { useSfx } from '../../audio/AudioContext';
import { StrikeOverlay } from './StrikeOverlay';
import './GameModeView.css';

export function GameModeView({ state }: { state: TournamentState }) {
  const { play } = useSfx();
  const m = getCurrentMatch(state);
  const q = m ? m.questions[m.questions.length - 1] : null;
  const def = q ? QUESTIONS.find(d => d.id === q.questionId) : null;
  const a = m ? state.teams.find(t => t.id === m.teamAId) : null;
  const b = m ? state.teams.find(t => t.id === m.teamBId) : null;
  const activeIsA = q?.activeTeamId === m?.teamAId;
  const strikes = activeIsA ? q?.strikesA : q?.strikesB;
  const winnerTeamId = matchOverWinningTeamId(state);

  // --- Strike detection ---
  const totalStrikes = (q?.strikesA ?? 0) + (q?.strikesB ?? 0);
  const prevTotalStrikes = useRef(totalStrikes);
  const [strikeVisible, setStrikeVisible] = useState(false);

  useEffect(() => {
    if (totalStrikes > prevTotalStrikes.current) {
      setStrikeVisible(true);
      play('strike');
      const t = setTimeout(() => setStrikeVisible(false), 1200);
      prevTotalStrikes.current = totalStrikes;
      return () => clearTimeout(t);
    }
    prevTotalStrikes.current = totalStrikes;
  }, [totalStrikes, play]);

  // --- Reveal detection ---
  const revealedCount = q?.revealedAnswers.length ?? 0;
  const prevRevealed = useRef(revealedCount);
  useEffect(() => {
    if (revealedCount > prevRevealed.current) {
      play('reveal');
    }
    prevRevealed.current = revealedCount;
  }, [revealedCount, play]);

  // --- Match-end detection ---
  const matchState = state.currentMatchState;
  const prevMatchState = useRef(matchState);
  useEffect(() => {
    if (matchState === 'awarded' && prevMatchState.current !== 'awarded') {
      play('matchEnd');
    }
    prevMatchState.current = matchState;
  }, [matchState, play]);

  // --- Champion detection ---
  const champion = state.bracket.champion;
  const prevChampion = useRef(champion);
  useEffect(() => {
    if (champion !== null && prevChampion.current === null) {
      play('champion');
    }
    prevChampion.current = champion;
  }, [champion, play]);

  if (!m) return <div style={{ padding: 48 }}>Tournament not started.</div>;

  return (
    <div className="gm-mockup">
      <StrikeOverlay visible={strikeVisible} />

      <div className="gm-q-large">
        {def?.prompt ?? 'Waiting for face-off…'}
      </div>

      <div className="gm-board">
        {def?.answers.map((ans, i) => {
          const revealed = q?.revealedAnswers.includes(i);
          return (
            <motion.div
              key={i}
              className={`gm-row ${revealed ? 'revealed' : 'hidden'}`}
              initial={false}
              animate={{ rotateX: revealed ? 360 : 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="ans">{revealed ? ans.text : i + 1}</span>
              <span className="pts">{revealed ? ans.points : ''}</span>
            </motion.div>
          );
        })}
      </div>

      <div className="gm-scores">
        <div className={`gm-team ${activeIsA ? 'active' : ''} ${winnerTeamId === m.teamAId ? 'match-winner' : ''}`}>
          <span className="name">{a?.name}</span>
          <span className="score">{m.scoreA}</span>
        </div>
        <div className="gm-strikes">
          {[0, 1, 2].map(i => (
            <span key={i} className={`x ${i < (strikes ?? 0) ? '' : 'dim'}`}>X</span>
          ))}
        </div>
        <div className={`gm-team ${!activeIsA ? 'active' : ''} ${winnerTeamId === m.teamBId ? 'match-winner' : ''}`}>
          <span className="name">{b?.name}</span>
          <span className="score">{m.scoreB}</span>
        </div>
      </div>
    </div>
  );
}
