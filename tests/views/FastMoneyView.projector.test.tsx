import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FastMoneyView } from '../../src/views/projector/FastMoneyView';
import { AudioProvider } from '../../src/audio/AudioContext';
import { initialState } from '../../src/state/initialState';
import { FAST_MONEY_QUESTION_IDS } from '../../src/content/fastMoneyConfig';
import type { TournamentState } from '../../src/state/types';

function fmCompletedNotWonState(threshold: number): TournamentState {
  const base = initialState();
  // Total score = 100, definitely below any threshold >= 100 we'll test.
  return {
    ...base,
    fastMoneyThreshold: threshold,
    bracket: {
      ...base.bracket,
      fastMoney: {
        player1: FAST_MONEY_QUESTION_IDS.map(() => ({ text: 'x', points: 10 })),
        player2: FAST_MONEY_QUESTION_IDS.map(() => ({ text: 'x', points: 10 })),
        totalScore: 100,
        won: false,
      },
    },
  };
}

describe('FastMoneyView projector copy', () => {
  it('shows "NEED 175" when threshold is 175 and round did not win', async () => {
    render(
      <AudioProvider>
        <FastMoneyView state={fmCompletedNotWonState(175)} />
      </AudioProvider>
    );
    expect(await screen.findByText(/need\s+175/i)).toBeInTheDocument();
  });
});
