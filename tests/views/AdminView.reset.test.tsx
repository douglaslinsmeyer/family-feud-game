import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminView } from '../../src/views/admin/AdminView';
import { GameStateProvider } from '../../src/state/GameStateContext';
import { PersistenceCtx } from '../../src/persistence/PersistenceCtx';
import { MemoryAdapter } from '../../src/persistence/memoryAdapter';
import { initialState } from '../../src/state/initialState';
import { reducer } from '../../src/state/reducer';
import type { Team, TournamentState } from '../../src/state/types';

// jsdom runs in opaque-origin mode: localStorage.clear() is not a function.
// Stub with a real in-memory implementation for all tests in this file.
const lsStore: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => lsStore[k] ?? null,
  setItem: (k: string, v: string) => { lsStore[k] = v; },
  removeItem: (k: string) => { delete lsStore[k]; },
  clear: () => { for (const k in lsStore) delete lsStore[k]; },
});

const T = (id: string, name: string): Team => ({ id, name, members: [] });
const sixTeams = ['a','b','c','d','e','f'].map(c => T(c, c.toUpperCase()));

function midTournamentState(): TournamentState {
  const withTeams = reducer(initialState(), { type: 'SET_TEAMS', teams: sixTeams });
  return reducer(withTeams, { type: 'START_TOURNAMENT' });
}

async function renderWithSeed(seed: TournamentState) {
  const adapter = new MemoryAdapter();
  await adapter.save(seed);
  localStorage.setItem('family-feud:tournamentId', seed.tournamentId);
  const utils = render(
    <PersistenceCtx.Provider value={adapter}>
      <GameStateProvider isWriter={true}>
        <AdminView />
      </GameStateProvider>
    </PersistenceCtx.Provider>
  );
  // Wait for hydrate effect to complete.
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /^reset$/i })).toBeInTheDocument();
  });
  return { ...utils, adapter };
}

describe('AdminView: Reset and Restart footer buttons', () => {
  beforeEach(() => {
    for (const k in lsStore) delete lsStore[k];
  });

  it('shows Reset and Restart buttons in the footer mid-tournament', async () => {
    await renderWithSeed(midTournamentState());
    expect(screen.getByRole('button', { name: /^reset$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^restart$/i })).toBeInTheDocument();
  });

  it('hides Restart when there are no teams', async () => {
    await renderWithSeed(initialState());
    expect(screen.getByRole('button', { name: /^reset$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^restart$/i })).not.toBeInTheDocument();
  });

  it('clicking Reset opens the reset confirmation modal', async () => {
    await renderWithSeed(midTournamentState());
    await userEvent.click(screen.getByRole('button', { name: /^reset$/i }));
    expect(screen.getByText(/reset tournament\?/i)).toBeInTheDocument();
    expect(screen.getByText(/everything will be cleared/i)).toBeInTheDocument();
  });

  it('clicking Restart opens the restart confirmation modal', async () => {
    await renderWithSeed(midTournamentState());
    await userEvent.click(screen.getByRole('button', { name: /^restart$/i }));
    expect(screen.getByText(/restart tournament\?/i)).toBeInTheDocument();
    expect(screen.getByText(/team names will be kept/i)).toBeInTheDocument();
  });

  it('Cancel in the modal leaves state unchanged (still mid-tournament)', async () => {
    await renderWithSeed(midTournamentState());
    await userEvent.click(screen.getByRole('button', { name: /^reset$/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(/reset tournament\?/i)).not.toBeInTheDocument();
    // Footer status text "State saved · ... used · ... remaining" only appears when status !== 'setup'.
    expect(screen.getByText(/state saved/i)).toBeInTheDocument();
  });

  it('Confirming Reset clears teams and returns to setup', async () => {
    await renderWithSeed(midTournamentState());
    await userEvent.click(screen.getByRole('button', { name: /^reset$/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset tournament' }));
    // Footer status text "Setup mode — enter team names to begin" only appears when status === 'setup'.
    await waitFor(() => {
      expect(screen.getByText(/setup mode/i)).toBeInTheDocument();
    });
    // Restart should now be hidden since teams.length === 0.
    expect(screen.queryByRole('button', { name: /^restart$/i })).not.toBeInTheDocument();
  });

  it('Confirming Restart preserves team names and returns to setup with pre-filled inputs', async () => {
    await renderWithSeed(midTournamentState());
    await userEvent.click(screen.getByRole('button', { name: /^restart$/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Restart tournament' }));
    // We're now on the setup screen — confirm via footer status.
    await waitFor(() => {
      expect(screen.getByText(/setup mode/i)).toBeInTheDocument();
    });
    // SetupSubview's team-name inputs should be pre-populated with state.teams names.
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const teamNameValues = inputs.map(i => i.value).filter(v => v.length === 1);
    expect(teamNameValues).toEqual(expect.arrayContaining(['A', 'B', 'C', 'D', 'E', 'F']));
  });
});
