import { useState, useEffect, useRef } from 'react';
import { useGameState } from '../../hooks/useGameState';
import { QUESTIONS } from '../../content/questions';
import { FAST_MONEY_QUESTION_IDS } from '../../content/fastMoneyConfig';
import { useSfx } from '../../audio/useSfx';
import type { FastMoneyAnswer } from '../../state/types';

const FM_QUESTIONS = FAST_MONEY_QUESTION_IDS.map(id => QUESTIONS.find(q => q.id === id)!).filter(Boolean);
const NUM_QUESTIONS = FM_QUESTIONS.length;

const TIMER_SECONDS = 20;

type Phase = 'player1' | 'player2' | 'reveal';

export function FastMoneySubview() {
  const { state, dispatch } = useGameState();
  const { play } = useSfx();
  const fm = state.bracket.fastMoney;

  const [phase, setPhase] = useState<Phase>('player1');
  const [answers, setAnswers] = useState<string[]>(Array(NUM_QUESTIONS).fill(''));
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [timerRunning, setTimerRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Clock tick / time-up sounds
  useEffect(() => {
    if (!timerRunning) return;
    if (timeLeft <= 0) {
      play('fmTimeUp');
      return;
    }
    if (timeLeft <= 10) {
      play('fmTick');
    }
  }, [timeLeft, timerRunning, play]);

  function startTimer() {
    setTimeLeft(TIMER_SECONDS);
    setTimerRunning(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimerRunning(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function stopTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimerRunning(false);
  }

  function submitPlayer(player: 1 | 2) {
    stopTimer();
    answers.forEach((text, i) => {
      const q = FM_QUESTIONS[i];
      const matchedAnswer = q?.answers.find(
        a => a.text.toLowerCase().includes(text.trim().toLowerCase()) && text.trim().length > 0,
      );
      const points = matchedAnswer?.points ?? 0;
      const answer: FastMoneyAnswer = { text: text.trim() || '(no answer)', points };
      dispatch({ type: 'SUBMIT_FM_ANSWER', player, answer });
    });

    if (player === 1) {
      setPhase('player2');
      setAnswers(Array(NUM_QUESTIONS).fill(''));
    } else {
      dispatch({ type: 'COMPLETE_FAST_MONEY' });
      setPhase('reveal');
    }
  }

  // Reveal phase
  if (phase === 'reveal') {
    const finalFm = state.bracket.fastMoney;
    if (!finalFm) {
      return <div>Fast Money complete — no data to show.</div>;
    }
    const total = [...finalFm.player1, ...finalFm.player2].reduce(
      (sum, a) => sum + a.points,
      0,
    );
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: 16 }}>
        <h2 style={{ marginBottom: 16 }}>Fast Money — Final Results</h2>
        <div
          style={{
            fontSize: '2em',
            fontWeight: 'bold',
            color: finalFm.won ? 'var(--gold, #f5c518)' : '#e55',
            marginBottom: 24,
            textAlign: 'center',
          }}
        >
          {total} points — {finalFm.won ? 'YOU WIN!' : 'Not enough (need 200)'}
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <h3>Player 1</h3>
            {finalFm.player1.map((a, i) => (
              <div
                key={i}
                style={{
                  padding: '6px 10px',
                  marginBottom: 4,
                  background: a.points > 0 ? 'var(--blue, #1a4a8a)' : 'var(--navy, #0a1a3a)',
                  borderRadius: 4,
                }}
              >
                <span style={{ flex: 1 }}>{FM_QUESTIONS[i]?.prompt.slice(0, 40)}…</span>
                <strong style={{ float: 'right', color: 'var(--gold, #f5c518)' }}>
                  {a.text} ({a.points})
                </strong>
              </div>
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <h3>Player 2</h3>
            {finalFm.player2.map((a, i) => (
              <div
                key={i}
                style={{
                  padding: '6px 10px',
                  marginBottom: 4,
                  background: a.points > 0 ? 'var(--blue, #1a4a8a)' : 'var(--navy, #0a1a3a)',
                  borderRadius: 4,
                }}
              >
                <span style={{ flex: 1 }}>{FM_QUESTIONS[i]?.prompt.slice(0, 40)}…</span>
                <strong style={{ float: 'right', color: 'var(--gold, #f5c518)' }}>
                  {a.text} ({a.points})
                </strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const currentPlayer = phase === 'player1' ? 1 : 2;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>Fast Money — Player {currentPlayer}</h2>
        <div
          style={{
            fontSize: '2em',
            fontWeight: 'bold',
            color: timeLeft <= 5 ? '#e55' : 'var(--gold, #f5c518)',
            minWidth: 50,
          }}
        >
          {timeLeft}s
        </div>
        <button onClick={startTimer} disabled={timerRunning} style={{ padding: '4px 12px' }}>
          {timerRunning ? 'Running…' : 'Start Timer'}
        </button>
        <button onClick={stopTimer} disabled={!timerRunning} style={{ padding: '4px 12px' }}>
          Stop
        </button>
      </div>

      {/* Note: Player 2 answers are entered after Player 1 is hidden from the projector */}
      {phase === 'player2' && (
        <div
          style={{
            marginBottom: 16,
            padding: 8,
            background: 'rgba(245,197,24,0.1)',
            border: '1px solid var(--gold-dim, #888)',
            borderRadius: 4,
            fontSize: '0.9em',
          }}
        >
          Player 1 is seated — enter Player 2 answers now.
          {fm && fm.player1.length > 0 && (
            <span style={{ marginLeft: 8, color: 'var(--gold, #f5c518)' }}>
              Player 1 total: {fm.player1.reduce((s, a) => s + a.points, 0)} pts
            </span>
          )}
        </div>
      )}

      <div>
        {FM_QUESTIONS.map((q, i) => (
          <div
            key={q.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 12,
              padding: '8px 12px',
              background: 'var(--navy, #0a1a3a)',
              borderRadius: 6,
              border: '1px solid var(--gold-dim, #555)',
            }}
          >
            <span
              style={{
                fontWeight: 'bold',
                color: 'var(--gold, #f5c518)',
                minWidth: 20,
              }}
            >
              {i + 1}.
            </span>
            <span style={{ flex: 1, fontSize: '0.9em' }}>{q.prompt}</span>
            <input
              type="text"
              value={answers[i]}
              onChange={e => {
                const next = [...answers];
                next[i] = e.target.value;
                setAnswers(next);
              }}
              placeholder="Answer…"
              style={{ width: 200, padding: '4px 8px' }}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
        <button
          onClick={() => submitPlayer(currentPlayer)}
          style={{
            padding: '10px 24px',
            fontWeight: 'bold',
            fontSize: '1.1em',
          }}
        >
          Submit Player {currentPlayer} Answers
        </button>
      </div>
    </div>
  );
}
