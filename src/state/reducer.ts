import type { TournamentState, Action, Match, QuestionPlay } from './types';
import { getCurrentMatch, pickRandom, computeWildcard, nextMatchPath } from './bracketLogic';
import { QUESTIONS } from '../content/questions';

function emptyMatch(teamAId: string, teamBId: string | null): Match {
  return {
    teamAId,
    teamBId,
    questions: [],
    scoreA: 0,
    scoreB: 0,
    winnerId: null,
  };
}

function setCurrentMatch(
  state: TournamentState,
  updater: (m: Match) => Match,
): TournamentState {
  const p = state.currentMatchPath;
  if (!p) return state;
  const bracket = { ...state.bracket };
  if (p.round === 'round1') {
    const round1 = [...bracket.round1];
    round1[p.index] = updater(round1[p.index]);
    bracket.round1 = round1;
  } else if (p.round === 'semis') {
    const semis = [...bracket.semis];
    semis[p.index] = updater(semis[p.index]);
    bracket.semis = semis;
  } else if (p.round === 'final' && bracket.final) {
    bracket.final = updater(bracket.final);
  }
  return { ...state, bracket };
}

function pointsForQuestion(q: QuestionPlay): number {
  const def = QUESTIONS.find(d => d.id === q.questionId);
  if (!def) return 0;
  return q.revealedAnswers.reduce((sum, i) => sum + (def.answers[i]?.points ?? 0), 0);
}

function determineWinner(m: Match): string | null {
  if (m.scoreA === m.scoreB) return null;
  return m.scoreA > m.scoreB ? m.teamAId : (m.teamBId ?? null);
}

export function reducer(state: TournamentState, action: Action): TournamentState {
  switch (action.type) {
    case 'SET_TEAMS':
      return { ...state, teams: action.teams, updatedAt: Date.now() };

    case 'START_TOURNAMENT': {
      if (state.teams.length !== 6) {
        throw new Error('Need exactly 6 teams to start tournament');
      }
      const [a, b, c, d, e, f] = state.teams;
      const round1: Match[] = [
        emptyMatch(a.id, b.id),
        emptyMatch(c.id, d.id),
        emptyMatch(e.id, f.id),
      ];
      return {
        ...state,
        status: 'in_progress',
        bracket: { ...state.bracket, round1 },
        currentMatchPath: { round: 'round1', index: 0 },
        currentMatchState: 'face_off',
        updatedAt: Date.now(),
      };
    }

    case 'RESOLVE_FACE_OFF': {
      const available = state.questionPool.available;
      if (available.length === 0) throw new Error('Question pool exhausted');
      const questionId = pickRandom(available);
      const newQuestion: QuestionPlay = {
        questionId,
        revealedAnswers: [],
        strikesA: 0,
        strikesB: 0,
        activeTeamId: action.teamId,
        pointsAwardedTo: null,
        stealAttempted: false,
        stealSuccessful: null,
      };
      const snapshotBase = state.matchStartSnapshot ?? state;
      const next = setCurrentMatch(state, m => ({
        ...m,
        questions: [...m.questions, newQuestion],
      }));
      return {
        ...next,
        matchStartSnapshot: snapshotBase,
        currentMatchState: 'board_play',
        questionPool: {
          used: [...state.questionPool.used, questionId],
          available: available.filter(id => id !== questionId),
        },
        actionStack: [...state.actionStack, action],
        updatedAt: Date.now(),
      };
    }

    case 'REVEAL_ANSWER': {
      const next = setCurrentMatch(state, m => {
        if (m.questions.length === 0) return m;
        const questions = [...m.questions];
        const last = { ...questions[questions.length - 1] };
        if (!last.revealedAnswers.includes(action.answerIndex)) {
          last.revealedAnswers = [...last.revealedAnswers, action.answerIndex];
        }
        questions[questions.length - 1] = last;
        return { ...m, questions };
      });
      return {
        ...next,
        actionStack: [...state.actionStack, action],
        updatedAt: Date.now(),
      };
    }

    case 'MARK_STRIKE': {
      const cur = getCurrentMatch(state);
      if (!cur || cur.questions.length === 0) return state;
      const q = cur.questions[cur.questions.length - 1];
      const isA = q.activeTeamId === cur.teamAId;
      const nextStrikeCount = (isA ? q.strikesA : q.strikesB) + 1;
      const next = setCurrentMatch(state, m => {
        const questions = [...m.questions];
        const lastQ = { ...questions[questions.length - 1] };
        if (isA) lastQ.strikesA = nextStrikeCount; else lastQ.strikesB = nextStrikeCount;
        questions[questions.length - 1] = lastQ;
        return { ...m, questions };
      });
      return {
        ...next,
        currentMatchState: nextStrikeCount >= 3 ? 'steal' : 'board_play',
        actionStack: [...state.actionStack, action],
        updatedAt: Date.now(),
      };
    }

    case 'SWITCH_ACTIVE_TEAM': {
      const next = setCurrentMatch(state, m => {
        if (m.questions.length === 0 || !m.teamBId) return m;
        const questions = [...m.questions];
        const lastQ = { ...questions[questions.length - 1] };
        lastQ.activeTeamId = lastQ.activeTeamId === m.teamAId ? m.teamBId : m.teamAId;
        questions[questions.length - 1] = lastQ;
        return { ...m, questions };
      });
      return {
        ...next,
        actionStack: [...state.actionStack, action],
        updatedAt: Date.now(),
      };
    }

    case 'AWARD_POINTS_TO_ACTIVE': {
      const cur = getCurrentMatch(state);
      if (!cur || cur.questions.length === 0) return state;
      const q = cur.questions[cur.questions.length - 1];
      if (!q.activeTeamId) return state;
      const pts = pointsForQuestion(q);
      const isA = q.activeTeamId === cur.teamAId;
      const next = setCurrentMatch(state, m => {
        const questions = [...m.questions];
        const lastQ = { ...questions[questions.length - 1], pointsAwardedTo: q.activeTeamId };
        questions[questions.length - 1] = lastQ;
        return {
          ...m,
          questions,
          scoreA: m.scoreA + (isA ? pts : 0),
          scoreB: m.scoreB + (isA ? 0 : pts),
        };
      });
      return {
        ...next,
        currentMatchState: 'awarded',
        actionStack: [...state.actionStack, action],
        updatedAt: Date.now(),
      };
    }

    case 'RESOLVE_STEAL': {
      const cur = getCurrentMatch(state);
      if (!cur || cur.questions.length === 0 || !cur.teamBId) return state;
      const q = cur.questions[cur.questions.length - 1];
      if (!q.activeTeamId) return state;
      const pts = pointsForQuestion(q);
      const opponentId = q.activeTeamId === cur.teamAId ? cur.teamBId : cur.teamAId;
      const winnerOfQuestion = action.successful ? opponentId : q.activeTeamId;
      const isA = winnerOfQuestion === cur.teamAId;
      const next = setCurrentMatch(state, m => {
        const questions = [...m.questions];
        const lastQ = {
          ...questions[questions.length - 1],
          stealAttempted: true,
          stealSuccessful: action.successful,
          pointsAwardedTo: winnerOfQuestion,
        };
        questions[questions.length - 1] = lastQ;
        return {
          ...m,
          questions,
          scoreA: m.scoreA + (isA ? pts : 0),
          scoreB: m.scoreB + (isA ? 0 : pts),
        };
      });
      return {
        ...next,
        currentMatchState: 'awarded',
        actionStack: [...state.actionStack, action],
        updatedAt: Date.now(),
      };
    }

    case 'ADVANCE_MATCH': {
      const cur = getCurrentMatch(state);
      if (!cur) return state;
      const winnerId = determineWinner(cur);
      if (!winnerId) throw new Error('Cannot advance — match is tied');

      const bracket = { ...state.bracket };
      const path = state.currentMatchPath!;
      if (path.round === 'round1') {
        const round1 = [...bracket.round1];
        round1[path.index] = { ...round1[path.index], winnerId };
        bracket.round1 = round1;
      } else if (path.round === 'semis') {
        const semis = [...bracket.semis];
        semis[path.index] = { ...semis[path.index], winnerId };
        bracket.semis = semis;
      } else if (path.round === 'final' && bracket.final) {
        bracket.final = { ...bracket.final, winnerId };
        bracket.champion = winnerId;
      }

      const next = nextMatchPath(path);

      if (path.round === 'round1' && path.index === 2) {
        const wildcard = computeWildcard(bracket.round1);
        bracket.wildcard = wildcard;
        const w1 = bracket.round1[0].winnerId!;
        const w2 = bracket.round1[1].winnerId!;
        const w3 = bracket.round1[2].winnerId!;
        bracket.semis = [
          { teamAId: w1, teamBId: w2, questions: [], scoreA: 0, scoreB: 0, winnerId: null },
          { teamAId: w3, teamBId: wildcard.teamId, questions: [], scoreA: 0, scoreB: 0, winnerId: null, isWildcardEntry: true },
        ];
      }
      if (path.round === 'semis' && path.index === 1) {
        const finA = bracket.semis[0].winnerId!;
        const finB = bracket.semis[1].winnerId!;
        bracket.final = { teamAId: finA, teamBId: finB, questions: [], scoreA: 0, scoreB: 0, winnerId: null };
      }

      return {
        ...state,
        bracket,
        currentMatchPath: next,
        currentMatchState: next ? 'face_off' : 'match_over',
        status: next ? 'in_progress' : 'done',
        actionStack: [],
        matchStartSnapshot: null,
        updatedAt: Date.now(),
      };
    }

    case 'UNDO': {
      const snap = state.matchStartSnapshot;
      if (!snap || state.actionStack.length === 0) return state;
      const newStack = state.actionStack.slice(0, -1);
      let replayed = snap;
      for (const a of newStack) {
        replayed = reducer(replayed, a);
      }
      return { ...replayed, matchStartSnapshot: snap };
    }

    case 'SET_PROJECTOR_VIEW':
      return { ...state, projectorView: action.view, updatedAt: Date.now() };

    case 'SKIP_QUESTION': {
      const next = setCurrentMatch(state, m => {
        const questions = m.questions.slice(0, -1);
        return { ...m, questions };
      });
      return {
        ...next,
        currentMatchState: 'face_off',
        actionStack: state.actionStack.slice(0, -1),
        updatedAt: Date.now(),
      };
    }

    case 'SUBMIT_FM_ANSWER': {
      // Lazy-initialize fastMoney record on first call so callers don't need
      // a separate START_FAST_MONEY action (Plan B will add a cleaner action).
      const fm = state.bracket.fastMoney ?? { player1: [], player2: [], totalScore: 0, won: false };
      const updated =
        action.player === 1
          ? { ...fm, player1: [...fm.player1, action.answer] }
          : { ...fm, player2: [...fm.player2, action.answer] };
      return {
        ...state,
        bracket: { ...state.bracket, fastMoney: updated },
        updatedAt: Date.now(),
      };
    }

    case 'COMPLETE_FAST_MONEY': {
      const fm = state.bracket.fastMoney;
      if (!fm) return state;
      const totalScore =
        [...fm.player1, ...fm.player2].reduce((sum, a) => sum + a.points, 0);
      const updated = { ...fm, totalScore, won: totalScore >= 200 };
      return {
        ...state,
        bracket: { ...state.bracket, fastMoney: updated },
        updatedAt: Date.now(),
      };
    }

    case 'HYDRATE':
      return action.state;

    default:
      return state;
  }
}
