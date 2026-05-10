import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FastMoneySubview } from '../../src/views/admin/FastMoneySubview';
import { GameStateProvider } from '../../src/state/GameStateContext';
import { PersistenceCtx } from '../../src/persistence/PersistenceCtx';
import { MemoryAdapter } from '../../src/persistence/memoryAdapter';
import { initialState } from '../../src/state/initialState';
import { FAST_MONEY_QUESTION_IDS } from '../../src/content/fastMoneyConfig';
import { AudioProvider } from '../../src/audio/AudioContext';
import type { TournamentState } from '../../src/state/types';

// jsdom stub for localStorage (mirrors AdminView.reset.test.tsx).
const lsStore: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => lsStore[k] ?? null,
  setItem: (k: string, v: string) => { lsStore[k] = v; },
  removeItem: (k: string) => { delete lsStore[k]; },
  clear: () => { for (const k in lsStore) delete lsStore[k]; },
});

async function renderWithSeed(seed: TournamentState) {
  const adapter = new MemoryAdapter();
  await adapter.save(seed);
  localStorage.setItem('family-feud:tournamentId', seed.tournamentId);
  return render(
    <PersistenceCtx.Provider value={adapter}>
      <GameStateProvider isWriter={true}>
        <AudioProvider>
          <FastMoneySubview />
        </AudioProvider>
      </GameStateProvider>
    </PersistenceCtx.Provider>
  );
}

function fmEntryState(threshold: number): TournamentState {
  // FM round in progress, no answers submitted yet → input is editable.
  return { ...initialState(), fastMoneyThreshold: threshold };
}

function fmCompletedState(threshold: number, totalScore: number): TournamentState {
  const base = initialState();
  return {
    ...base,
    fastMoneyThreshold: threshold,
    bracket: {
      ...base.bracket,
      fastMoney: {
        player1: FAST_MONEY_QUESTION_IDS.map(() => ({
          text: 'x', points: Math.floor(totalScore / (FAST_MONEY_QUESTION_IDS.length * 2)),
        })),
        player2: FAST_MONEY_QUESTION_IDS.map(() => ({
          text: 'x', points: Math.floor(totalScore / (FAST_MONEY_QUESTION_IDS.length * 2)),
        })),
        totalScore,
        won: totalScore >= threshold,
      },
    },
  };
}

describe('FastMoneySubview: threshold input', () => {
  beforeEach(() => { for (const k in lsStore) delete lsStore[k]; });

  it('renders the current threshold value in the input', async () => {
    await renderWithSeed(fmEntryState(175));
    const input = await screen.findByLabelText(/win at/i) as HTMLInputElement;
    expect(input.value).toBe('175');
  });

  it('typing in the input dispatches SET_FM_THRESHOLD', async () => {
    await renderWithSeed(fmEntryState(200));
    const input = await screen.findByLabelText(/win at/i) as HTMLInputElement;
    // Use fireEvent.change to atomically set a value — avoids intermediate
    // keystroke clamping that occurs with controlled number inputs.
    fireEvent.change(input, { target: { value: '155' } });
    expect(input.value).toBe('155');
  });

  it('replaces the input with locked text once FM is completed', async () => {
    await renderWithSeed(fmCompletedState(180, 100));
    // Wait for async state hydration, then assert locked UI.
    expect(await screen.findByText(/win at: 180/i)).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: /win at/i })).not.toBeInTheDocument();
    expect(screen.getByText(/locked/i)).toBeInTheDocument();
  });

  it('reveal-phase copy interpolates the threshold (need 175)', async () => {
    await renderWithSeed(fmCompletedState(175, 100));
    expect(await screen.findByText(/need 175/i)).toBeInTheDocument();
  });
});
