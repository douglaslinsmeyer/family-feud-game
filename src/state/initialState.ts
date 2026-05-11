import type { TournamentState } from './types';
import { QUESTIONS } from '../content/questions';
import { FAST_MONEY_QUESTION_IDS, FM_THRESHOLD_DEFAULT } from '../content/fastMoneyConfig';

export function initialState(): TournamentState {
  const allIds = QUESTIONS.map(q => q.id);
  const fmIds = new Set(FAST_MONEY_QUESTION_IDS);
  const mainPoolIds = allIds.filter(id => !fmIds.has(id));

  return {
    tournamentId: crypto.randomUUID(),
    createdAt: Date.now(),
    status: 'setup',
    teams: [],
    bracket: {
      round1: [],
      wildcard: { teamId: null, score: null },
      semis: [],
      final: null,
      fastMoney: null,
      champion: null,
    },
    currentMatchPath: null,
    currentMatchState: 'face_off',
    questionPool: { used: [], available: mainPoolIds },
    fastMoneyPool: { used: [], available: [...FAST_MONEY_QUESTION_IDS] },
    projectorView: 'game',
    actionStack: [],
    updatedAt: Date.now(),
    matchStartSnapshot: null,
    fastMoneyThreshold: FM_THRESHOLD_DEFAULT,
  };
}
