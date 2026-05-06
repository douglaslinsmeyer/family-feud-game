import type { TournamentState, Team, QuestionPlay } from './types';
import { QUESTIONS, type Question } from '../content/questions';
import { getCurrentMatch } from './bracketLogic';

export function teamById(state: TournamentState, id: string | null | undefined): Team | undefined {
  if (!id) return undefined;
  return state.teams.find(t => t.id === id);
}

export function currentQuestion(
  state: TournamentState,
): { play: QuestionPlay; def: Question } | null {
  const m = getCurrentMatch(state);
  if (!m || m.questions.length === 0) return null;
  const play = m.questions[m.questions.length - 1];
  const def = QUESTIONS.find(q => q.id === play.questionId);
  if (!def) return null;
  return { play, def };
}

export function canAdvanceMatch(state: TournamentState): boolean {
  const m = getCurrentMatch(state);
  if (!m) return false;
  return state.currentMatchState === 'awarded' && m.scoreA !== m.scoreB;
}

export function matchOverWinningTeamId(state: TournamentState): string | null {
  const m = getCurrentMatch(state);
  if (!m || state.currentMatchState !== 'awarded') return null;
  if (m.scoreA === m.scoreB) return null;
  return m.scoreA > m.scoreB ? m.teamAId : m.teamBId;
}
