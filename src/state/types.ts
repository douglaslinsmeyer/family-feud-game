export type TournamentStatus = 'setup' | 'in_progress' | 'done';

export type Team = {
  id: string;
  name: string;
  members: string[];
};

export type QuestionPlay = {
  questionId: string;
  revealedAnswers: number[];   // indices 0..4
  strikesA: number;
  strikesB: number;
  activeTeamId: string | null;
  pointsAwardedTo: string | null;
  stealAttempted: boolean;
  stealSuccessful: boolean | null;
};

export type Match = {
  teamAId: string;
  teamBId: string | null;       // null if wildcard not yet resolved
  questions: QuestionPlay[];
  scoreA: number;
  scoreB: number;
  winnerId: string | null;
  isWildcardEntry?: boolean;
};

export type FastMoneyAnswer = { text: string; points: number };
export type FastMoneyResult = {
  player1: FastMoneyAnswer[];
  player2: FastMoneyAnswer[];
  totalScore: number;
  won: boolean;
};

export type Bracket = {
  round1: Match[];              // length 3
  wildcard: { teamId: string | null; score: number | null };
  semis: Match[];               // length 2
  final: Match | null;
  fastMoney: FastMoneyResult | null;
  champion: string | null;      // teamId
};

export type MatchStateName =
  | 'face_off'
  | 'board_play'
  | 'steal'
  | 'awarded'
  | 'match_over';

export type MatchPath =
  | { round: 'round1'; index: 0 | 1 | 2 }
  | { round: 'semis'; index: 0 | 1 }
  | { round: 'final'; index: 0 };

export type ProjectorView = 'game' | 'bracket';

export type Action =
  | { type: 'SET_TEAMS'; teams: Team[] }
  | { type: 'START_TOURNAMENT' }
  | { type: 'RESOLVE_FACE_OFF'; teamId: string }
  | { type: 'REVEAL_ANSWER'; answerIndex: number }
  | { type: 'MARK_STRIKE' }
  | { type: 'CLEAR_STRIKES' }
  | { type: 'SWITCH_ACTIVE_TEAM' }
  | { type: 'AWARD_POINTS_TO_ACTIVE' }
  | { type: 'AWARD_POINTS_TO_OPPONENT' }
  | { type: 'START_STEAL' }
  | { type: 'RESOLVE_STEAL'; successful: boolean }
  | { type: 'SKIP_QUESTION' }
  | { type: 'ADVANCE_MATCH' }
  | { type: 'SUBMIT_FM_ANSWER'; player: 1 | 2; answer: FastMoneyAnswer }
  | { type: 'COMPLETE_FAST_MONEY' }
  | { type: 'SET_PROJECTOR_VIEW'; view: ProjectorView }
  | { type: 'UNDO' }
  | { type: 'HYDRATE'; state: TournamentState };

export type StackedAction = Exclude<Action, { type: 'UNDO' } | { type: 'HYDRATE' }>;

export type TournamentState = {
  tournamentId: string;
  createdAt: number;
  status: TournamentStatus;
  teams: Team[];
  bracket: Bracket;
  currentMatchPath: MatchPath | null;
  currentMatchState: MatchStateName;
  questionPool: { used: string[]; available: string[] };
  fastMoneyPool: { used: string[]; available: string[] };
  projectorView: ProjectorView;
  actionStack: StackedAction[];
  updatedAt: number;
  matchStartSnapshot: TournamentState | null;
};
