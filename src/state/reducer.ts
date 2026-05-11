import type { TournamentState, Action, Match, QuestionPlay, FaceOff, MatchPath } from './types';
import { getCurrentMatch, pickRandom, computeWildcard, nextMatchPath } from './bracketLogic';
import { QUESTIONS } from '../content/questions';
import { FAST_MONEY_QUESTION_IDS, FM_THRESHOLD_MIN, FM_THRESHOLD_MAX, FM_THRESHOLD_DEFAULT } from '../content/fastMoneyConfig';
import { initialState } from './initialState';

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

function emptyFaceOff(): FaceOff {
  return {
    firstBuzzTeamId: null,
    firstAnswerIndex: null,
    firstAnswerSubmitted: false,
    secondAnswerIndex: null,
    secondAnswerSubmitted: false,
    winnerId: null,
    decision: null,
  };
}

function createInitialQuestionPlay(questionId: string): QuestionPlay {
  return {
    questionId,
    faceOff: emptyFaceOff(),
    revealedAnswers: [],
    strikesA: 0,
    strikesB: 0,
    activeTeamId: null,
    pointsAwardedTo: null,
    stealAttempted: false,
    stealSuccessful: null,
  };
}

function pickFaceOffQuestion(state: TournamentState): {
  questionId: string;
  available: string[];
  used: string[];
} {
  const available = state.questionPool.available;
  if (available.length === 0) throw new Error('Question pool exhausted');
  const questionId = pickRandom(available);
  return {
    questionId,
    available: available.filter(id => id !== questionId),
    used: [...state.questionPool.used, questionId],
  };
}

function resolveFaceOffWinner(fo: FaceOff, questionId: string, m: Match): string | null {
  if (!fo.firstBuzzTeamId || !m.teamBId) return null;
  const otherTeamId = fo.firstBuzzTeamId === m.teamAId ? m.teamBId : m.teamAId;
  const def = QUESTIONS.find(d => d.id === questionId);
  const firstPts = fo.firstAnswerIndex !== null && def
    ? def.answers[fo.firstAnswerIndex]?.points ?? 0
    : 0;
  const secondPts = fo.secondAnswerIndex !== null && def
    ? def.answers[fo.secondAnswerIndex]?.points ?? 0
    : 0;
  if (firstPts === 0 && secondPts === 0) return null;  // both wrong/no answer → host adjudicates
  if (secondPts > firstPts) return otherTeamId;
  return fo.firstBuzzTeamId;  // ties go to the buzzer
}

function seedMatchQuestion(
  bracket: TournamentState['bracket'],
  path: MatchPath,
  play: QuestionPlay,
): TournamentState['bracket'] {
  if (path.round === 'round1') {
    const r1 = [...bracket.round1];
    r1[path.index] = { ...r1[path.index], questions: [play] };
    return { ...bracket, round1: r1 };
  }
  if (path.round === 'semis') {
    const sm = [...bracket.semis];
    sm[path.index] = { ...sm[path.index], questions: [play] };
    return { ...bracket, semis: sm };
  }
  if (path.round === 'final' && bracket.final) {
    return { ...bracket, final: { ...bracket.final, questions: [play] } };
  }
  return bracket;
}

function withAllAnswersRevealed(q: QuestionPlay): QuestionPlay {
  const def = QUESTIONS.find(d => d.id === q.questionId);
  if (!def) return q;
  const all = def.answers.map((_, i) => i);
  const merged = [...q.revealedAnswers];
  for (const i of all) if (!merged.includes(i)) merged.push(i);
  return { ...q, revealedAnswers: merged };
}

function migrateHydratedState(s: TournamentState): TournamentState {
  const migrateQ = (q: QuestionPlay): QuestionPlay =>
    q.faceOff ? q : { ...q, faceOff: emptyFaceOff() };
  const migrateMatch = (m: Match): Match =>
    m.questions.length === 0 ? m : { ...m, questions: m.questions.map(migrateQ) };
  const threshold =
    typeof s.fastMoneyThreshold === 'number' && Number.isFinite(s.fastMoneyThreshold)
      ? s.fastMoneyThreshold
      : FM_THRESHOLD_DEFAULT;
  return {
    ...s,
    fastMoneyThreshold: threshold,
    bracket: {
      ...s.bracket,
      round1: s.bracket.round1.map(migrateMatch),
      semis: s.bracket.semis.map(migrateMatch),
      final: s.bracket.final ? migrateMatch(s.bracket.final) : null,
    },
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

function freshState(prev: TournamentState, opts: { keepTeams: boolean }): TournamentState {
  const fresh = initialState();
  return {
    ...fresh,
    tournamentId: prev.tournamentId,
    createdAt: prev.createdAt,
    teams: opts.keepTeams ? prev.teams : [],
    updatedAt: Date.now(),
  };
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
      const pick = pickFaceOffQuestion(state);
      const firstPlay = createInitialQuestionPlay(pick.questionId);
      const round1: Match[] = [
        { ...emptyMatch(a.id, b.id), questions: [firstPlay] },
        emptyMatch(c.id, d.id),
        emptyMatch(e.id, f.id),
      ];
      return {
        ...state,
        status: 'in_progress',
        bracket: { ...state.bracket, round1 },
        currentMatchPath: { round: 'round1', index: 0 },
        currentMatchState: 'face_off',
        questionPool: { used: pick.used, available: pick.available },
        updatedAt: Date.now(),
      };
    }

    case 'FACEOFF_BUZZ_IN': {
      const next = setCurrentMatch(state, m => {
        if (m.questions.length === 0) return m;
        const questions = [...m.questions];
        const last = { ...questions[questions.length - 1] };
        last.faceOff = { ...last.faceOff, firstBuzzTeamId: action.teamId };
        questions[questions.length - 1] = last;
        return { ...m, questions };
      });
      const snapshotBase = state.matchStartSnapshot ?? state;
      return {
        ...next,
        matchStartSnapshot: snapshotBase,
        actionStack: [...state.actionStack, action],
        updatedAt: Date.now(),
      };
    }

    case 'FACEOFF_FIRST_ANSWER': {
      const next = setCurrentMatch(state, m => {
        if (m.questions.length === 0) return m;
        const questions = [...m.questions];
        const lastIdx = questions.length - 1;
        const q = { ...questions[lastIdx] };
        const isTopAnswer = action.answerIndex === 0;
        q.faceOff = {
          ...q.faceOff,
          firstAnswerIndex: action.answerIndex,
          firstAnswerSubmitted: true,
          winnerId: isTopAnswer ? q.faceOff.firstBuzzTeamId : q.faceOff.winnerId,
        };
        if (action.answerIndex !== null && !q.revealedAnswers.includes(action.answerIndex)) {
          q.revealedAnswers = [...q.revealedAnswers, action.answerIndex];
        }
        questions[lastIdx] = q;
        return { ...m, questions };
      });
      const snapshotBase = state.matchStartSnapshot ?? state;
      return {
        ...next,
        matchStartSnapshot: snapshotBase,
        actionStack: [...state.actionStack, action],
        updatedAt: Date.now(),
      };
    }

    case 'FACEOFF_SECOND_ANSWER': {
      const next = setCurrentMatch(state, m => {
        if (m.questions.length === 0) return m;
        const questions = [...m.questions];
        const lastIdx = questions.length - 1;
        const q = { ...questions[lastIdx] };
        const fo: FaceOff = {
          ...q.faceOff,
          secondAnswerIndex: action.answerIndex,
          secondAnswerSubmitted: true,
        };
        fo.winnerId = resolveFaceOffWinner(fo, q.questionId, m);
        q.faceOff = fo;
        if (action.answerIndex !== null && !q.revealedAnswers.includes(action.answerIndex)) {
          q.revealedAnswers = [...q.revealedAnswers, action.answerIndex];
        }
        questions[lastIdx] = q;
        return { ...m, questions };
      });
      const snapshotBase = state.matchStartSnapshot ?? state;
      return {
        ...next,
        matchStartSnapshot: snapshotBase,
        actionStack: [...state.actionStack, action],
        updatedAt: Date.now(),
      };
    }

    case 'FACEOFF_ADJUDICATE': {
      const next = setCurrentMatch(state, m => {
        if (m.questions.length === 0) return m;
        const questions = [...m.questions];
        const lastIdx = questions.length - 1;
        const q = { ...questions[lastIdx] };
        q.faceOff = { ...q.faceOff, winnerId: action.winnerId };
        questions[lastIdx] = q;
        return { ...m, questions };
      });
      const snapshotBase = state.matchStartSnapshot ?? state;
      return {
        ...next,
        matchStartSnapshot: snapshotBase,
        actionStack: [...state.actionStack, action],
        updatedAt: Date.now(),
      };
    }

    case 'FACEOFF_KEEP':
    case 'FACEOFF_PASS': {
      const cur = getCurrentMatch(state);
      if (!cur || cur.questions.length === 0 || !cur.teamBId) return state;
      const lastIdx = cur.questions.length - 1;
      const q = cur.questions[lastIdx];
      const winnerId = q.faceOff.winnerId;
      if (!winnerId) return state;
      const otherTeamId = winnerId === cur.teamAId ? cur.teamBId : cur.teamAId;
      const decision: 'keep' | 'pass' = action.type === 'FACEOFF_KEEP' ? 'keep' : 'pass';
      const activeTeamId = decision === 'keep' ? winnerId : otherTeamId;
      const next = setCurrentMatch(state, m => {
        const questions = [...m.questions];
        const lastQ = { ...questions[lastIdx] };
        lastQ.faceOff = { ...lastQ.faceOff, decision };
        lastQ.activeTeamId = activeTeamId;
        questions[lastIdx] = lastQ;
        return { ...m, questions };
      });
      const snapshotBase = state.matchStartSnapshot ?? state;
      return {
        ...next,
        matchStartSnapshot: snapshotBase,
        currentMatchState: 'board_play',
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
        const lastQ = withAllAnswersRevealed({
          ...questions[questions.length - 1],
          pointsAwardedTo: q.activeTeamId,
        });
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
      const opponentId = q.activeTeamId === cur.teamAId ? cur.teamBId : cur.teamAId;
      const winnerOfQuestion = action.successful ? opponentId : q.activeTeamId;
      const next = setCurrentMatch(state, m => {
        const questions = [...m.questions];
        let lastQ: QuestionPlay = { ...questions[questions.length - 1] };
        if (
          action.successful &&
          action.answerIndex !== undefined &&
          !lastQ.revealedAnswers.includes(action.answerIndex)
        ) {
          lastQ.revealedAnswers = [...lastQ.revealedAnswers, action.answerIndex];
        }
        lastQ.stealAttempted = true;
        lastQ.stealSuccessful = action.successful;
        lastQ.pointsAwardedTo = winnerOfQuestion;
        const pts = pointsForQuestion(lastQ);
        const isA = winnerOfQuestion === m.teamAId;
        lastQ = withAllAnswersRevealed(lastQ);
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

      let nextBracket = bracket;
      let nextPool = state.questionPool;
      if (next) {
        const pick = pickFaceOffQuestion(state);
        nextBracket = seedMatchQuestion(bracket, next, createInitialQuestionPlay(pick.questionId));
        nextPool = { used: pick.used, available: pick.available };
      }

      return {
        ...state,
        bracket: nextBracket,
        currentMatchPath: next,
        currentMatchState: next ? 'face_off' : 'match_over',
        status: next ? 'in_progress' : 'done',
        questionPool: nextPool,
        actionStack: [],
        matchStartSnapshot: null,
        updatedAt: Date.now(),
      };
    }

    case 'RESET_GAME':
      return freshState(state, { keepTeams: false });

    case 'RESTART_GAME':
      return freshState(state, { keepTeams: true });

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
      const pick = pickFaceOffQuestion(state);
      const fresh = createInitialQuestionPlay(pick.questionId);
      const next = setCurrentMatch(state, m => ({
        ...m,
        questions: [...m.questions.slice(0, -1), fresh],
      }));
      return {
        ...next,
        currentMatchState: 'face_off',
        questionPool: { used: pick.used, available: pick.available },
        actionStack: state.actionStack.slice(0, -1),
        updatedAt: Date.now(),
      };
    }

    case 'PLAY_ANOTHER_QUESTION': {
      const pick = pickFaceOffQuestion(state);
      const fresh = createInitialQuestionPlay(pick.questionId);
      const next = setCurrentMatch(state, m => ({
        ...m,
        questions: [...m.questions, fresh],
      }));
      return {
        ...next,
        currentMatchState: 'face_off',
        questionPool: { used: pick.used, available: pick.available },
        actionStack: [],
        matchStartSnapshot: null,
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
      const updated = { ...fm, totalScore, won: totalScore >= state.fastMoneyThreshold };
      return {
        ...state,
        bracket: { ...state.bracket, fastMoney: updated },
        updatedAt: Date.now(),
      };
    }

    case 'SET_FM_THRESHOLD': {
      const fm = state.bracket.fastMoney;
      const completed =
        fm !== null && fm.player2.length === FAST_MONEY_QUESTION_IDS.length;
      if (completed) return state;
      const clamped = Math.max(
        FM_THRESHOLD_MIN,
        Math.min(FM_THRESHOLD_MAX, action.value),
      );
      return { ...state, fastMoneyThreshold: clamped, updatedAt: Date.now() };
    }

    case 'HYDRATE':
      return migrateHydratedState(action.state);

    default:
      return state;
  }
}
