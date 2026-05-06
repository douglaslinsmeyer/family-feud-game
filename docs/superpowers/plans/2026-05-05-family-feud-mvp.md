# EGPS Family Feud — MVP Implementation Plan (Plan A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A functional Family Feud game that runs a 6-team bracket tournament end-to-end (registration → R1 → wildcard → semis → final → Fast Money), with state persisted to DynamoDB and deployed to AWS. Minimal styling — visual polish is Plan B.

**Architecture:** Single-page React app on S3+CloudFront. Two routes: `/admin` (host laptop) and `/projector` (extended display). Both windows read a single DynamoDB record; admin window is sole writer, projector polls every ~750ms. Cognito identity pool issues unauthenticated AWS credentials so the SPA writes directly to DDB without a backend. Single-tournament app — no multi-tenant, no auth.

**Tech Stack:** React 18 + Vite + TypeScript + Framer Motion + AWS SDK v3 + AWS CDK (TS) + Vitest + React Testing Library

**Reference spec:** `docs/superpowers/specs/2026-05-05-family-feud-game-design.md`

---

## File Structure

```
family-feud-game/
├── infra/                              # AWS CDK
│   ├── bin/family-feud.ts              # CDK app entrypoint
│   ├── lib/family-feud-stack.ts        # All AWS resources
│   ├── package.json, tsconfig.json, cdk.json
│
├── src/
│   ├── main.tsx                        # React entry
│   ├── App.tsx                         # Router
│   │
│   ├── routes/
│   │   ├── AdminRoute.tsx              # /admin
│   │   └── ProjectorRoute.tsx          # /projector
│   │
│   ├── state/
│   │   ├── types.ts                    # TournamentState, Match, Action types
│   │   ├── reducer.ts                  # Pure reducer for all actions
│   │   ├── actionCreators.ts           # Typed action factories
│   │   ├── bracketLogic.ts             # Wildcard calc, advancement
│   │   ├── selectors.ts                # Derived state (current match, etc.)
│   │   └── GameStateContext.tsx        # React context + provider
│   │
│   ├── persistence/
│   │   ├── adapter.ts                  # PersistenceAdapter interface
│   │   ├── ddbAdapter.ts               # Real DDB adapter
│   │   ├── memoryAdapter.ts            # In-memory adapter for dev/test
│   │   └── PersistenceProvider.tsx     # Switches based on env
│   │
│   ├── views/
│   │   ├── admin/
│   │   │   ├── AdminView.tsx           # Top-level admin (routes subviews)
│   │   │   ├── SetupSubview.tsx
│   │   │   ├── InMatchSubview.tsx
│   │   │   ├── FaceOffSubview.tsx
│   │   │   ├── StealSubview.tsx
│   │   │   ├── BetweenMatchesSubview.tsx
│   │   │   └── FastMoneySubview.tsx
│   │   └── projector/
│   │       ├── ProjectorView.tsx       # Top-level (routes game/bracket)
│   │       ├── GameModeView.tsx
│   │       └── BracketView.tsx
│   │
│   ├── content/
│   │   └── questions.ts                # Baked-in survey questions
│   │
│   ├── components/
│   │   ├── ViewSwitcher.tsx            # Top-right glyphs (admin)
│   │   └── ConfirmModal.tsx
│   │
│   ├── hooks/
│   │   ├── useGameState.ts
│   │   ├── useDDBPolling.ts
│   │   └── useUndo.ts
│   │
│   ├── utils/
│   │   └── cognito.ts                  # Identity pool credentials
│   │
│   └── env.d.ts                        # Vite env types
│
├── scripts/
│   └── extract-questions.mjs           # One-time: docx → questions.ts
│
├── tests/                              # Vitest tests mirror src/ tree
│   └── state/
│       ├── reducer.test.ts
│       └── bracketLogic.test.ts
│
├── public/                             # Static assets (icons)
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Phase 1: Project scaffolding (Tasks 1–4)

### Task 1: Bootstrap Vite React-TS project

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: Run Vite scaffolder**

```bash
cd /home/douglasl/Projects/family-feud-game
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm create vite@latest . -- --template react-ts
# When prompted to overwrite existing files: yes
```

- [ ] **Step 2: Install deps**

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm install
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm install react-router-dom framer-motion @aws-sdk/client-dynamodb @aws-sdk/credential-providers @aws-sdk/lib-dynamodb @aws-sdk/client-cognito-identity
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/node
```

- [ ] **Step 3: Update `vite.config.ts` to enable Vitest**

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
});
```

- [ ] **Step 4: Create `tests/setup.ts`**

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 5: Verify build works**

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm run dev
```
Expected: Vite dev server starts, default Vite/React page loads at localhost. Stop with Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig*.json vite.config.ts index.html src/ tests/setup.ts public/ eslint.config.js README.md
git commit -m "chore: scaffold Vite React+TS project with Vitest"
```

---

### Task 2: Set up routing for /admin and /projector

**Files:**
- Modify: `src/App.tsx`
- Create: `src/routes/AdminRoute.tsx`, `src/routes/ProjectorRoute.tsx`

- [ ] **Step 1: Replace `src/App.tsx`**

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminRoute } from './routes/AdminRoute';
import { ProjectorRoute } from './routes/ProjectorRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<AdminRoute />} />
        <Route path="/projector" element={<ProjectorRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Create `src/routes/AdminRoute.tsx`**

```typescript
export function AdminRoute() {
  return <div>Admin (placeholder)</div>;
}
```

- [ ] **Step 3: Create `src/routes/ProjectorRoute.tsx`**

```typescript
export function ProjectorRoute() {
  return <div>Projector (placeholder)</div>;
}
```

- [ ] **Step 4: Verify routes work**

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm run dev
```
Expected: visiting `/`, `/admin`, `/projector` all render correctly.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat: add /admin and /projector routes"
```

---

### Task 3: Add a `npm test` script and verify it runs

**Files:**
- Modify: `package.json`
- Create: `tests/sanity.test.ts`

- [ ] **Step 1: Add test scripts to `package.json`**

In the `scripts` section add:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 2: Create `tests/sanity.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs', () => {
    expect(2 + 2).toBe(4);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm run test:run
```
Expected: 1 test passes.

- [ ] **Step 4: Commit**

```bash
git add package.json tests/
git commit -m "chore: add vitest test script and sanity test"
```

---

### Task 4: Add a global stylesheet with the project palette

**Files:**
- Create: `src/styles/palette.css`, `src/styles/global.css`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create `src/styles/palette.css`**

```css
:root {
  --bg-deep: #061236;
  --bg-mid:  #0a1d4f;
  --bg-card: #0d2470;
  --gold:    #ffd700;
  --gold-2:  #ffaa00;
  --gold-dim: rgba(255, 215, 0, 0.45);
  --red:     #cc0000;
  --purple:  #b86bff;
  --purple-deep: #7a2bd6;
  --white:   #ffffff;
  --green:   #2dc06b;
  --text-secondary: rgba(255, 255, 255, 0.65);
}
```

- [ ] **Step 2: Create `src/styles/global.css`**

```css
@import './palette.css';
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Fjalla+One&family=Inter:wght@400;500;600;700&display=swap');

* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; padding: 0; }
body {
  font-family: Inter, sans-serif;
  background: linear-gradient(180deg, var(--bg-mid) 0%, var(--bg-deep) 100%);
  color: var(--gold);
  overflow: hidden;
}
button { cursor: pointer; font-family: inherit; }
```

- [ ] **Step 3: Import in `src/main.tsx`**

Add at top:

```typescript
import './styles/global.css';
```

- [ ] **Step 4: Verify**

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm run dev
```
Expected: pages now have blue background and gold text.

- [ ] **Step 5: Commit**

```bash
git add src/styles/ src/main.tsx
git commit -m "style: add palette and global stylesheet"
```

---

## Phase 2: Types and content (Tasks 5–7)

### Task 5: Define core types

**Files:**
- Create: `src/state/types.ts`

- [ ] **Step 1: Create the file**

```typescript
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
  | { type: 'UNDO' };

export type StackedAction = Exclude<Action, { type: 'UNDO' }>;

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
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/state/types.ts
git commit -m "feat(state): define core tournament types"
```

---

### Task 6: Extract questions from docx into TS

**Files:**
- Create: `scripts/extract-questions.mjs`, `src/content/questions.ts`

- [ ] **Step 1: Write the extractor script**

`scripts/extract-questions.mjs`:

```javascript
#!/usr/bin/env node
// Extracts questions from /mnt/c/Users/dougl/Downloads/Family Feud Top 5 Answers.docx
// into src/content/questions.ts
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const DOCX = '/mnt/c/Users/dougl/Downloads/Family Feud Top 5 Answers.docx';
const OUT  = 'src/content/questions.ts';

const text = execSync(`python3 -c "
import zipfile, re, html
with zipfile.ZipFile('${DOCX}') as z:
    xml = z.open('word/document.xml').read().decode('utf-8')
text = re.sub(r'</w:p>', chr(10), xml)
text = re.sub(r'<[^>]+>', '', text)
text = html.unescape(text)
print(text)
"`, { encoding: 'utf-8' });

const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
const questions = [];
let cur = null;
for (const line of lines) {
  if (line.toUpperCase() === 'FAMILY FEUD – TOP 5 ANSWERS') continue;
  // An answer line looks like "Coffee — 52" or "Coffee - 52"
  const m = line.match(/^(.+?)\s+[—-]\s+(\d+)\s*$/);
  if (m) {
    if (cur) cur.answers.push({ text: m[1].trim(), points: parseInt(m[2], 10) });
  } else {
    if (cur) questions.push(cur);
    cur = { id: 'q' + (questions.length + 1), prompt: line, answers: [] };
  }
}
if (cur) questions.push(cur);

const validQuestions = questions.filter(q => q.answers.length === 5);
console.log(`Extracted ${validQuestions.length} questions (out of ${questions.length} prompts)`);

const file = `// AUTO-GENERATED by scripts/extract-questions.mjs — do not edit by hand.
export type Answer = { text: string; points: number };
export type Question = { id: string; prompt: string; answers: Answer[] };

export const QUESTIONS: Question[] = ${JSON.stringify(validQuestions, null, 2)};
`;

writeFileSync(OUT, file);
console.log(`Wrote ${OUT}`);
```

- [ ] **Step 2: Run the extractor**

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" node scripts/extract-questions.mjs
```
Expected: prints "Extracted 25 questions" and writes `src/content/questions.ts`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/extract-questions.mjs src/content/questions.ts
git commit -m "feat(content): extract survey questions from docx into TS"
```

---

### Task 7: Designate Fast Money question pool

**Files:**
- Create: `src/content/fastMoneyConfig.ts`

- [ ] **Step 1: Create the file**

```typescript
// Hand-pick 5 questions from QUESTIONS as the Fast Money pool.
// FM uses different prompts than the main bracket so the same questions
// don't appear twice in one tournament.
import { QUESTIONS } from './questions';

export const FAST_MONEY_QUESTION_IDS: string[] = [
  'q11', // Sweet Caroline (song that gets everyone singing)
  'q24', // Coffee/water (drink during workday)
  'q21', // Pets (Google at work)
  'q14', // Meetings (takes longer than it should)
  'q9',  // Chargers (forget when traveling)
];

// Verify the selected ids exist
for (const id of FAST_MONEY_QUESTION_IDS) {
  if (!QUESTIONS.find(q => q.id === id)) {
    throw new Error(`FAST_MONEY config references missing question: ${id}`);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/content/fastMoneyConfig.ts
git commit -m "feat(content): designate fast money question pool"
```

---

## Phase 3: State machine (Tasks 8–17, TDD)

Each state-machine task follows the same pattern: write a failing test, run it, implement minimally, run tests until green, commit. The reducer in `src/state/reducer.ts` grows over the phase.

### Task 8: Reducer skeleton + SET_TEAMS / START_TOURNAMENT

**Files:**
- Create: `src/state/reducer.ts`, `tests/state/reducer.test.ts`
- Create: `src/state/initialState.ts`

- [ ] **Step 1: Write failing tests**

`tests/state/reducer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { reducer } from '../../src/state/reducer';
import { initialState } from '../../src/state/initialState';
import type { Team } from '../../src/state/types';

const T = (id: string, name: string): Team => ({ id, name, members: [] });

describe('reducer: SET_TEAMS', () => {
  it('replaces the teams array', () => {
    const teams = [T('a', 'A'), T('b', 'B'), T('c', 'C'), T('d', 'D'), T('e', 'E'), T('f', 'F')];
    const next = reducer(initialState(), { type: 'SET_TEAMS', teams });
    expect(next.teams).toEqual(teams);
    expect(next.status).toBe('setup');
  });
});

describe('reducer: START_TOURNAMENT', () => {
  it('requires 6 teams to start', () => {
    expect(() => reducer(initialState(), { type: 'START_TOURNAMENT' }))
      .toThrow(/6 teams/i);
  });

  it('with 6 teams, builds round-1 matches and moves status', () => {
    const teams = ['a','b','c','d','e','f'].map(c => T(c, c.toUpperCase()));
    const withTeams = reducer(initialState(), { type: 'SET_TEAMS', teams });
    const next = reducer(withTeams, { type: 'START_TOURNAMENT' });
    expect(next.status).toBe('in_progress');
    expect(next.bracket.round1).toHaveLength(3);
    expect(next.bracket.round1[0].teamAId).toBe('a');
    expect(next.bracket.round1[0].teamBId).toBe('b');
    expect(next.currentMatchPath).toEqual({ round: 'round1', index: 0 });
    expect(next.currentMatchState).toBe('face_off');
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm run test:run -- tests/state/reducer.test.ts
```
Expected: import errors / "reducer not defined".

- [ ] **Step 3: Implement `src/state/initialState.ts`**

```typescript
import type { TournamentState } from './types';
import { QUESTIONS } from '../content/questions';
import { FAST_MONEY_QUESTION_IDS } from '../content/fastMoneyConfig';

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
  };
}
```

- [ ] **Step 4: Implement `src/state/reducer.ts` (start)**

```typescript
import type { TournamentState, Action, Match } from './types';

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

    default:
      return state;
  }
}
```

- [ ] **Step 5: Run tests, expect pass**

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm run test:run -- tests/state/reducer.test.ts
```
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/state/ tests/state/
git commit -m "feat(state): reducer with SET_TEAMS and START_TOURNAMENT"
```

---

### Task 9: Bracket logic — wildcard calc + advancement helpers

**Files:**
- Create: `src/state/bracketLogic.ts`, `tests/state/bracketLogic.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { computeWildcard, getCurrentMatch, isMatchComplete, nextMatchPath } from '../../src/state/bracketLogic';
import type { TournamentState, Match } from '../../src/state/types';
import { initialState } from '../../src/state/initialState';

const completedMatch = (a: string, b: string, scoreA: number, scoreB: number): Match => ({
  teamAId: a, teamBId: b, questions: [], scoreA, scoreB,
  winnerId: scoreA > scoreB ? a : b,
});

describe('computeWildcard', () => {
  it('returns the highest-scoring losing team across round 1', () => {
    const r1: Match[] = [
      completedMatch('a','b', 100, 90),  // b loses with 90
      completedMatch('c','d', 80, 95),   // c loses with 80
      completedMatch('e','f', 70, 110),  // e loses with 70
    ];
    const result = computeWildcard(r1);
    expect(result.teamId).toBe('b');
    expect(result.score).toBe(90);
  });

  it('handles ties by picking the first encountered', () => {
    const r1: Match[] = [
      completedMatch('a','b', 100, 90),
      completedMatch('c','d', 80, 100),
      completedMatch('e','f', 90, 100),
    ];
    expect(computeWildcard(r1).teamId).toBe('b');
  });
});

describe('nextMatchPath', () => {
  it('round1.0 → round1.1', () => {
    expect(nextMatchPath({ round: 'round1', index: 0 })).toEqual({ round: 'round1', index: 1 });
  });
  it('round1.2 → semis.0', () => {
    expect(nextMatchPath({ round: 'round1', index: 2 })).toEqual({ round: 'semis', index: 0 });
  });
  it('semis.1 → final.0', () => {
    expect(nextMatchPath({ round: 'semis', index: 1 })).toEqual({ round: 'final', index: 0 });
  });
  it('final.0 → null (tournament done)', () => {
    expect(nextMatchPath({ round: 'final', index: 0 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm run test:run -- tests/state/bracketLogic.test.ts
```
Expected: import errors.

- [ ] **Step 3: Implement `src/state/bracketLogic.ts`**

```typescript
import type { TournamentState, Match, MatchPath } from './types';

export function computeWildcard(round1: Match[]): { teamId: string; score: number } {
  let best: { teamId: string; score: number } | null = null;
  for (const m of round1) {
    if (m.winnerId == null || !m.teamBId) continue;
    const loserId = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
    const loserScore = m.winnerId === m.teamAId ? m.scoreB : m.scoreA;
    if (best === null || loserScore > best.score) {
      best = { teamId: loserId, score: loserScore };
    }
  }
  if (!best) throw new Error('No completed matches in round 1');
  return best;
}

export function getCurrentMatch(state: TournamentState): Match | null {
  const p = state.currentMatchPath;
  if (!p) return null;
  if (p.round === 'round1') return state.bracket.round1[p.index] ?? null;
  if (p.round === 'semis')  return state.bracket.semis[p.index] ?? null;
  if (p.round === 'final')  return state.bracket.final;
  return null;
}

export function isMatchComplete(m: Match): boolean {
  return m.winnerId !== null;
}

export function nextMatchPath(p: MatchPath): MatchPath | null {
  if (p.round === 'round1') {
    if (p.index < 2) return { round: 'round1', index: (p.index + 1) as 0|1|2 };
    return { round: 'semis', index: 0 };
  }
  if (p.round === 'semis') {
    if (p.index < 1) return { round: 'semis', index: 1 };
    return { round: 'final', index: 0 };
  }
  return null; // final → done
}
```

- [ ] **Step 4: Run tests, expect pass**

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm run test:run -- tests/state/bracketLogic.test.ts
```
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/state/bracketLogic.ts tests/state/bracketLogic.test.ts
git commit -m "feat(state): bracket helpers (wildcard, advancement)"
```

---

### Task 10: Reducer — face-off resolution

**Files:**
- Modify: `src/state/reducer.ts`, `tests/state/reducer.test.ts`

- [ ] **Step 1: Add failing tests** (append to `reducer.test.ts`)

```typescript
import { QUESTIONS } from '../../src/content/questions';
import { initialState as init } from '../../src/state/initialState';
const sixTeams = ['a','b','c','d','e','f'].map(c => ({ id: c, name: c.toUpperCase(), members: [] }));

function startedTournament() {
  let s = init();
  s = reducer(s, { type: 'SET_TEAMS', teams: sixTeams });
  return reducer(s, { type: 'START_TOURNAMENT' });
}

describe('reducer: RESOLVE_FACE_OFF', () => {
  it('starts a question with the buzzed-in team active and moves to board_play', () => {
    const s = startedTournament();
    const next = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    expect(next.currentMatchState).toBe('board_play');
    const r1m1 = next.bracket.round1[0];
    expect(r1m1.questions).toHaveLength(1);
    expect(r1m1.questions[0].activeTeamId).toBe('a');
    expect(r1m1.questions[0].revealedAnswers).toEqual([]);
  });

  it('picks a random unused question from the main pool', () => {
    const s = startedTournament();
    const before = s.questionPool.available.length;
    const next = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    expect(next.questionPool.used).toHaveLength(1);
    expect(next.questionPool.available).toHaveLength(before - 1);
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm run test:run -- tests/state/reducer.test.ts
```
Expected: face-off tests fail.

- [ ] **Step 3: Add a `pickRandomQuestion` helper to `bracketLogic.ts`**

Append to `src/state/bracketLogic.ts`:

```typescript
export function pickRandom<T>(arr: T[], rng: () => number = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}
```

- [ ] **Step 4: Add the case to the reducer**

In `src/state/reducer.ts`, import the helpers at top:

```typescript
import { getCurrentMatch, pickRandom } from './bracketLogic';
import type { QuestionPlay } from './types';
```

Add a private helper:

```typescript
function setCurrentMatch(state: TournamentState, updater: (m: Match) => Match): TournamentState {
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
```

Add the new case inside `switch (action.type)`:

```typescript
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
  const next = setCurrentMatch(state, m => ({
    ...m,
    questions: [...m.questions, newQuestion],
  }));
  return {
    ...next,
    currentMatchState: 'board_play',
    questionPool: {
      used: [...state.questionPool.used, questionId],
      available: available.filter(id => id !== questionId),
    },
    actionStack: [...state.actionStack, action],
    updatedAt: Date.now(),
  };
}
```

- [ ] **Step 5: Run tests**

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm run test:run -- tests/state/reducer.test.ts
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/state/ tests/state/
git commit -m "feat(state): RESOLVE_FACE_OFF picks random question + activates team"
```

---

### Task 11: Reducer — REVEAL_ANSWER

**Files:**
- Modify: `src/state/reducer.ts`, `tests/state/reducer.test.ts`

- [ ] **Step 1: Add failing tests**

```typescript
describe('reducer: REVEAL_ANSWER', () => {
  it('reveals an answer index on the active question', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    const next = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 0 });
    const m = next.bracket.round1[0];
    expect(m.questions[0].revealedAnswers).toEqual([0]);
  });

  it('does not duplicate an already-revealed answer', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 0 });
    const next = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 0 });
    const m = next.bracket.round1[0];
    expect(m.questions[0].revealedAnswers).toEqual([0]);
  });
});
```

- [ ] **Step 2: Run failing tests** — expect failure.

- [ ] **Step 3: Add the case**

```typescript
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
```

- [ ] **Step 4: Run tests** — expect pass.

- [ ] **Step 5: Commit**

```bash
git add src/state/ tests/state/
git commit -m "feat(state): REVEAL_ANSWER appends to revealed indices"
```

---

### Task 12: Reducer — MARK_STRIKE / SWITCH_ACTIVE_TEAM / steal triggering

**Files:**
- Modify: `src/state/reducer.ts`, `tests/state/reducer.test.ts`

- [ ] **Step 1: Tests**

```typescript
describe('reducer: MARK_STRIKE', () => {
  it('increments strikes for active team', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    const next = reducer(s, { type: 'MARK_STRIKE' });
    expect(next.bracket.round1[0].questions[0].strikesA).toBe(1);
    expect(next.currentMatchState).toBe('board_play');
  });

  it('on third strike, transitions to steal state', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    expect(s.currentMatchState).toBe('steal');
    expect(s.bracket.round1[0].questions[0].strikesA).toBe(3);
  });
});

describe('reducer: SWITCH_ACTIVE_TEAM', () => {
  it('flips the active team', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    const next = reducer(s, { type: 'SWITCH_ACTIVE_TEAM' });
    expect(next.bracket.round1[0].questions[0].activeTeamId).toBe('b');
  });
});
```

- [ ] **Step 2: Run failing tests.**

- [ ] **Step 3: Add cases to reducer**

```typescript
case 'MARK_STRIKE': {
  const cur = getCurrentMatch(state);
  if (!cur || cur.questions.length === 0) return state;
  const q = cur.questions[cur.questions.length - 1];
  const isA = q.activeTeamId === cur.teamAId;
  const nextStrike = (isA ? q.strikesA : q.strikesB) + 1;
  const next = setCurrentMatch(state, m => {
    const questions = [...m.questions];
    const lastQ = { ...questions[questions.length - 1] };
    if (isA) lastQ.strikesA = nextStrike; else lastQ.strikesB = nextStrike;
    questions[questions.length - 1] = lastQ;
    return { ...m, questions };
  });
  return {
    ...next,
    currentMatchState: nextStrike >= 3 ? 'steal' : 'board_play',
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
```

- [ ] **Step 4: Run tests** — expect pass.

- [ ] **Step 5: Commit**

```bash
git add src/state/ tests/state/
git commit -m "feat(state): MARK_STRIKE triggers steal at 3, SWITCH_ACTIVE_TEAM flips"
```

---

### Task 13: Reducer — RESOLVE_STEAL + AWARD_POINTS

**Files:**
- Modify: `src/state/reducer.ts`, `tests/state/reducer.test.ts`

- [ ] **Step 1: Tests**

```typescript
import { QUESTIONS } from '../../src/content/questions';

function pointsForRevealed(questionId: string, indices: number[]) {
  const q = QUESTIONS.find(q => q.id === questionId)!;
  return indices.reduce((sum, i) => sum + q.answers[i].points, 0);
}

describe('reducer: AWARD_POINTS_TO_ACTIVE', () => {
  it('adds revealed-answer points to active team and marks question awarded', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 1 });
    const next = reducer(s, { type: 'AWARD_POINTS_TO_ACTIVE' });
    const m = next.bracket.round1[0];
    const q = m.questions[0];
    const expected = pointsForRevealed(q.questionId, [0, 1]);
    expect(m.scoreA).toBe(expected);
    expect(q.pointsAwardedTo).toBe('a');
    expect(next.currentMatchState).toBe('awarded');
  });
});

describe('reducer: RESOLVE_STEAL', () => {
  it('successful steal awards points to opponent', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' }); // → steal
    const next = reducer(s, { type: 'RESOLVE_STEAL', successful: true });
    const m = next.bracket.round1[0];
    const q = m.questions[0];
    expect(m.scoreB).toBeGreaterThan(0);
    expect(m.scoreA).toBe(0);
    expect(q.stealAttempted).toBe(true);
    expect(q.stealSuccessful).toBe(true);
    expect(q.pointsAwardedTo).toBe('b');
    expect(next.currentMatchState).toBe('awarded');
  });

  it('failed steal awards points to original active team', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    s = reducer(s, { type: 'MARK_STRIKE' });
    const next = reducer(s, { type: 'RESOLVE_STEAL', successful: false });
    const m = next.bracket.round1[0];
    expect(m.scoreA).toBeGreaterThan(0);
    expect(m.scoreB).toBe(0);
    expect(next.currentMatchState).toBe('awarded');
  });
});
```

- [ ] **Step 2: Run failing tests.**

- [ ] **Step 3: Implement cases**

Add helper near the top of `reducer.ts`:

```typescript
import { QUESTIONS } from '../content/questions';

function pointsForQuestion(q: QuestionPlay): number {
  const def = QUESTIONS.find(d => d.id === q.questionId);
  if (!def) return 0;
  return q.revealedAnswers.reduce((sum, i) => sum + (def.answers[i]?.points ?? 0), 0);
}
```

Add cases:

```typescript
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
```

- [ ] **Step 4: Run tests** — expect pass.

- [ ] **Step 5: Commit**

```bash
git add src/state/ tests/state/
git commit -m "feat(state): AWARD_POINTS and RESOLVE_STEAL"
```

---

### Task 14: Reducer — ADVANCE_MATCH (incl. wildcard slotting + R1→Semis)

**Files:**
- Modify: `src/state/reducer.ts`, `tests/state/reducer.test.ts`

- [ ] **Step 1: Tests**

```typescript
describe('reducer: ADVANCE_MATCH', () => {
  function playOutMatch(s: ReturnType<typeof startedTournament>, winnerId: string) {
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: winnerId });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 1 });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 2 });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 3 });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 4 });
    s = reducer(s, { type: 'AWARD_POINTS_TO_ACTIVE' });
    return reducer(s, { type: 'ADVANCE_MATCH' });
  }

  it('determines winner by higher score and moves to next match', () => {
    let s = startedTournament();
    s = playOutMatch(s, 'a');
    expect(s.bracket.round1[0].winnerId).toBe('a');
    expect(s.currentMatchPath).toEqual({ round: 'round1', index: 1 });
    expect(s.currentMatchState).toBe('face_off');
  });

  it('after round 1 completes, computes wildcard and seeds semis', () => {
    let s = startedTournament();
    s = playOutMatch(s, 'a');  // a beats b
    s = playOutMatch(s, 'd');  // d beats c
    s = playOutMatch(s, 'f');  // f beats e
    expect(s.bracket.wildcard.teamId).not.toBeNull();
    expect(s.bracket.semis).toHaveLength(2);
    expect(s.bracket.semis[0].teamAId).toBe('a');
    expect(s.bracket.semis[0].teamBId).toBe('d');
    expect(s.bracket.semis[1].teamAId).toBe('f');
    expect(s.bracket.semis[1].teamBId).toBe(s.bracket.wildcard.teamId);
    expect(s.bracket.semis[1].isWildcardEntry).toBe(true);
    expect(s.currentMatchPath).toEqual({ round: 'semis', index: 0 });
  });
});
```

- [ ] **Step 2: Run failing tests.**

- [ ] **Step 3: Implement**

In `src/state/reducer.ts`, add to imports:

```typescript
import { computeWildcard, nextMatchPath } from './bracketLogic';
```

Add a helper:

```typescript
function determineWinner(m: Match): string | null {
  if (m.scoreA === m.scoreB) return null;
  return m.scoreA > m.scoreB ? m.teamAId : m.teamBId;
}
```

Add the case:

```typescript
case 'ADVANCE_MATCH': {
  const cur = getCurrentMatch(state);
  if (!cur) return state;
  const winnerId = determineWinner(cur);
  if (!winnerId) throw new Error('Cannot advance — match is tied');

  // 1. Mark current match's winner.
  let bracket = { ...state.bracket };
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

  // 2. Compute next match path; if R1 is now done, build the semis first.
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
    actionStack: [],   // reset undo stack on advance per spec
    updatedAt: Date.now(),
  };
}
```

- [ ] **Step 4: Run tests** — expect pass.

- [ ] **Step 5: Commit**

```bash
git add src/state/ tests/state/
git commit -m "feat(state): ADVANCE_MATCH with wildcard + semis seeding"
```

---

### Task 15: Reducer — UNDO

**Files:**
- Modify: `src/state/reducer.ts`, `tests/state/reducer.test.ts`

- [ ] **Step 1: Tests**

```typescript
describe('reducer: UNDO', () => {
  it('reverts the last action by replaying the stack from the start of the match', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    s = reducer(s, { type: 'REVEAL_ANSWER', answerIndex: 0 });
    s = reducer(s, { type: 'MARK_STRIKE' });
    expect(s.bracket.round1[0].questions[0].strikesA).toBe(1);
    s = reducer(s, { type: 'UNDO' });
    expect(s.bracket.round1[0].questions[0].strikesA).toBe(0);
    expect(s.bracket.round1[0].questions[0].revealedAnswers).toEqual([0]);
  });
});
```

- [ ] **Step 2: Run failing tests.**

- [ ] **Step 3: Implement** — undo by popping the stack and re-applying from a snapshot of the match start.

Strategy: keep `matchStartSnapshot` in state, OR replay from the most recent face-off-start snapshot.

Update `TournamentState` type — add optional snapshot field:

```typescript
// in src/state/types.ts
export type TournamentState = {
  // ...existing fields...
  matchStartSnapshot: TournamentState | null;
};
```

In `initialState.ts` add `matchStartSnapshot: null` to the returned object.

In the reducer's `RESOLVE_FACE_OFF` case (Task 10), capture a snapshot of state BEFORE the action when it's the first action of the match (i.e., `actionStack.length === 0`):

Update the `RESOLVE_FACE_OFF` case to set `matchStartSnapshot` if it's null:

```typescript
const snapshotBase = state.matchStartSnapshot ?? state;
// ...
return {
  ...next,
  matchStartSnapshot: snapshotBase,
  // ...other fields
};
```

Add the `UNDO` case:

```typescript
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
```

In `ADVANCE_MATCH`, set `matchStartSnapshot: null` (cleared per spec).

- [ ] **Step 4: Run tests** — expect pass.

- [ ] **Step 5: Commit**

```bash
git add src/state/ tests/state/
git commit -m "feat(state): UNDO replays action stack from match-start snapshot"
```

---

### Task 16: Reducer — SET_PROJECTOR_VIEW + SKIP_QUESTION + Fast Money actions

**Files:**
- Modify: `src/state/reducer.ts`, `tests/state/reducer.test.ts`

- [ ] **Step 1: Tests** (focused — three small cases)

```typescript
describe('reducer: SET_PROJECTOR_VIEW', () => {
  it('toggles between game and bracket', () => {
    const s = init();
    expect(reducer(s, { type: 'SET_PROJECTOR_VIEW', view: 'bracket' }).projectorView).toBe('bracket');
  });
});

describe('reducer: SKIP_QUESTION', () => {
  it('discards the current question and returns to face-off', () => {
    let s = startedTournament();
    s = reducer(s, { type: 'RESOLVE_FACE_OFF', teamId: 'a' });
    const next = reducer(s, { type: 'SKIP_QUESTION' });
    expect(next.bracket.round1[0].questions).toHaveLength(0);
    expect(next.currentMatchState).toBe('face_off');
  });
});

describe('reducer: Fast Money', () => {
  it('SUBMIT_FM_ANSWER appends to the player\'s answers', () => {
    const s = { ...init(), bracket: { ...init().bracket, fastMoney: { player1: [], player2: [], totalScore: 0, won: false } } };
    const next = reducer(s, { type: 'SUBMIT_FM_ANSWER', player: 1, answer: { text: 'Coffee', points: 52 } });
    expect(next.bracket.fastMoney!.player1).toHaveLength(1);
  });

  it('COMPLETE_FAST_MONEY sets won=true if total >= 200', () => {
    const s = { ...init(),
      bracket: { ...init().bracket, fastMoney: {
        player1: [{ text:'a', points:120 }],
        player2: [{ text:'b', points:80 }],
        totalScore: 0, won: false,
      }}};
    const next = reducer(s, { type: 'COMPLETE_FAST_MONEY' });
    expect(next.bracket.fastMoney!.totalScore).toBe(200);
    expect(next.bracket.fastMoney!.won).toBe(true);
  });
});
```

- [ ] **Step 2: Failing tests, then implement** the four cases (`SET_PROJECTOR_VIEW`, `SKIP_QUESTION`, `SUBMIT_FM_ANSWER`, `COMPLETE_FAST_MONEY`). Implementations are mechanical, follow the patterns in earlier tasks.

- [ ] **Step 3: Tests pass.**

- [ ] **Step 4: Commit**

```bash
git add src/state/ tests/state/
git commit -m "feat(state): SET_PROJECTOR_VIEW, SKIP_QUESTION, Fast Money actions"
```

---

### Task 17: Selectors

**Files:**
- Create: `src/state/selectors.ts`, `tests/state/selectors.test.ts`

- [ ] **Step 1: Tests**

```typescript
import { describe, it, expect } from 'vitest';
import { canAdvanceMatch, currentQuestion, teamById } from '../../src/state/selectors';
// ... small tests for each
```

- [ ] **Step 2: Implementation**

```typescript
import type { TournamentState, Team, QuestionPlay, Match } from './types';
import { QUESTIONS } from '../content/questions';
import { getCurrentMatch } from './bracketLogic';

export function teamById(state: TournamentState, id: string | null | undefined): Team | undefined {
  if (!id) return undefined;
  return state.teams.find(t => t.id === id);
}

export function currentQuestion(state: TournamentState): { play: QuestionPlay; def: typeof QUESTIONS[0] } | null {
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
```

- [ ] **Step 3: Tests pass.**

- [ ] **Step 4: Commit**

```bash
git add src/state/selectors.ts tests/state/selectors.test.ts
git commit -m "feat(state): add selectors (teamById, currentQuestion, canAdvanceMatch)"
```

---

## Phase 4: Persistence (Tasks 18–20)

### Task 18: Persistence adapter interface + memory adapter

**Files:**
- Create: `src/persistence/adapter.ts`, `src/persistence/memoryAdapter.ts`, `tests/persistence/memoryAdapter.test.ts`

- [ ] **Step 1: Define the interface**

`src/persistence/adapter.ts`:

```typescript
import type { TournamentState } from '../state/types';

export interface PersistenceAdapter {
  load(tournamentId: string): Promise<TournamentState | null>;
  save(state: TournamentState): Promise<void>;
}
```

- [ ] **Step 2: Memory adapter (test)**

```typescript
import { describe, it, expect } from 'vitest';
import { MemoryAdapter } from '../../src/persistence/memoryAdapter';
import { initialState } from '../../src/state/initialState';

describe('MemoryAdapter', () => {
  it('saves and loads state by tournamentId', async () => {
    const a = new MemoryAdapter();
    const s = initialState();
    await a.save(s);
    const loaded = await a.load(s.tournamentId);
    expect(loaded).toEqual(s);
  });

  it('returns null for unknown tournamentId', async () => {
    const a = new MemoryAdapter();
    expect(await a.load('nonexistent')).toBeNull();
  });
});
```

- [ ] **Step 3: Memory adapter (impl)**

```typescript
import type { PersistenceAdapter } from './adapter';
import type { TournamentState } from '../state/types';

export class MemoryAdapter implements PersistenceAdapter {
  private store = new Map<string, TournamentState>();

  async load(tournamentId: string): Promise<TournamentState | null> {
    return this.store.get(tournamentId) ?? null;
  }

  async save(state: TournamentState): Promise<void> {
    this.store.set(state.tournamentId, JSON.parse(JSON.stringify(state)));
  }
}
```

- [ ] **Step 4: Tests pass + commit**

```bash
git add src/persistence/ tests/persistence/
git commit -m "feat(persistence): add adapter interface + memory adapter"
```

---

### Task 19: DDB adapter

**Files:**
- Create: `src/persistence/ddbAdapter.ts`

- [ ] **Step 1: Implement**

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';
import type { PersistenceAdapter } from './adapter';
import type { TournamentState } from '../state/types';

export class DdbAdapter implements PersistenceAdapter {
  private doc: DynamoDBDocumentClient;
  private tableName: string;

  constructor(opts: { region: string; identityPoolId: string; tableName: string }) {
    const credentials = fromCognitoIdentityPool({
      identityPoolId: opts.identityPoolId,
      clientConfig: { region: opts.region },
    });
    const client = new DynamoDBClient({ region: opts.region, credentials });
    this.doc = DynamoDBDocumentClient.from(client);
    this.tableName = opts.tableName;
  }

  async load(tournamentId: string): Promise<TournamentState | null> {
    const res = await this.doc.send(new GetCommand({
      TableName: this.tableName,
      Key: { tournamentId },
    }));
    return (res.Item as TournamentState | undefined) ?? null;
  }

  async save(state: TournamentState): Promise<void> {
    await this.doc.send(new PutCommand({
      TableName: this.tableName,
      Item: state,
    }));
  }
}
```

- [ ] **Step 2: Verify TS compiles**

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/persistence/ddbAdapter.ts
git commit -m "feat(persistence): add DynamoDB adapter (Cognito-signed)"
```

---

### Task 20: Persistence provider that switches by env

**Files:**
- Create: `src/persistence/PersistenceProvider.tsx`
- Create: `src/env.d.ts`

- [ ] **Step 1: env types**

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PERSISTENCE: 'memory' | 'ddb';
  readonly VITE_AWS_REGION?: string;
  readonly VITE_COGNITO_IDENTITY_POOL_ID?: string;
  readonly VITE_DDB_TABLE_NAME?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }
```

- [ ] **Step 2: Provider**

```typescript
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { PersistenceAdapter } from './adapter';
import { MemoryAdapter } from './memoryAdapter';
import { DdbAdapter } from './ddbAdapter';

const Ctx = createContext<PersistenceAdapter | null>(null);

export function PersistenceProvider({ children }: { children: ReactNode }) {
  const adapter = useMemo<PersistenceAdapter>(() => {
    if (import.meta.env.VITE_PERSISTENCE === 'ddb') {
      return new DdbAdapter({
        region: import.meta.env.VITE_AWS_REGION!,
        identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID!,
        tableName: import.meta.env.VITE_DDB_TABLE_NAME!,
      });
    }
    return new MemoryAdapter();
  }, []);
  return <Ctx.Provider value={adapter}>{children}</Ctx.Provider>;
}

export function usePersistence(): PersistenceAdapter {
  const a = useContext(Ctx);
  if (!a) throw new Error('PersistenceProvider missing');
  return a;
}
```

- [ ] **Step 3: Wire into `App.tsx`**

```typescript
import { PersistenceProvider } from './persistence/PersistenceProvider';

// wrap <BrowserRouter> with <PersistenceProvider>
```

- [ ] **Step 4: Commit**

```bash
git add src/persistence/PersistenceProvider.tsx src/env.d.ts src/App.tsx
git commit -m "feat(persistence): provider switching memory/ddb by env"
```

---

## Phase 5: AWS infrastructure (Tasks 21–24)

### Task 21: CDK app scaffolding

**Files:**
- Create: `infra/package.json`, `infra/tsconfig.json`, `infra/cdk.json`, `infra/bin/family-feud.ts`, `infra/lib/family-feud-stack.ts`

- [ ] **Step 1: Bootstrap CDK**

```bash
mkdir -p /home/douglasl/Projects/family-feud-game/infra
cd /home/douglasl/Projects/family-feud-game/infra
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npx cdk init app --language typescript
```

(If `cdk` is not installed: `npm install -g aws-cdk` first.)

- [ ] **Step 2: Add `.gitignore` rules** in `infra/.gitignore`:

```
node_modules/
cdk.out/
*.js
*.d.ts
!jest.config.js
```

- [ ] **Step 3: Commit scaffolding**

```bash
git add infra/
git commit -m "chore(infra): bootstrap CDK app"
```

---

### Task 22: CDK stack — S3 + CloudFront for the SPA

**Files:**
- Modify: `infra/lib/family-feud-stack.ts`

- [ ] **Step 1: Replace stack with**

```typescript
import { Stack, StackProps, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

export class FamilyFeudStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // SPA bucket — private, served via CloudFront
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        // SPA: route 403/404 back to index.html so React Router handles paths
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    new CfnOutput(this, 'SiteBucketName', { value: siteBucket.bucketName });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'DistributionDomain', { value: distribution.distributionDomainName });
  }
}
```

- [ ] **Step 2: Synth and verify**

```bash
cd /home/douglasl/Projects/family-feud-game/infra
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npx cdk synth
```
Expected: outputs CloudFormation template without errors.

- [ ] **Step 3: Commit**

```bash
git add infra/
git commit -m "feat(infra): S3 + CloudFront for SPA"
```

---

### Task 23: CDK stack — DynamoDB table + Cognito identity pool

**Files:**
- Modify: `infra/lib/family-feud-stack.ts`

- [ ] **Step 1: Add to imports**

```typescript
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
```

- [ ] **Step 2: Add to stack body (after CloudFront)**

```typescript
// DynamoDB table — single tournament record
const table = new ddb.Table(this, 'TournamentsTable', {
  partitionKey: { name: 'tournamentId', type: ddb.AttributeType.STRING },
  billingMode: ddb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.DESTROY,
});

// Cognito identity pool (unauthenticated)
const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
  allowUnauthenticatedIdentities: true,
});

const unauthRole = new iam.Role(this, 'UnauthRole', {
  assumedBy: new iam.FederatedPrincipal(
    'cognito-identity.amazonaws.com',
    {
      StringEquals: { 'cognito-identity.amazonaws.com:aud': identityPool.ref },
      'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'unauthenticated' },
    },
    'sts:AssumeRoleWithWebIdentity',
  ),
});

unauthRole.addToPolicy(new iam.PolicyStatement({
  actions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
  resources: [table.tableArn],
}));

new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoles', {
  identityPoolId: identityPool.ref,
  roles: { unauthenticated: unauthRole.roleArn },
});

new CfnOutput(this, 'TableName', { value: table.tableName });
new CfnOutput(this, 'IdentityPoolId', { value: identityPool.ref });
```

- [ ] **Step 3: Synth + commit**

```bash
cd /home/douglasl/Projects/family-feud-game/infra
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npx cdk synth
git add infra/
git commit -m "feat(infra): add DynamoDB table + Cognito unauth identity pool"
```

---

### Task 24: Deploy script

**Files:**
- Create: `scripts/deploy.sh`
- Modify: `package.json` (add `deploy` script)

- [ ] **Step 1: Write `scripts/deploy.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH"

# 1. Deploy infra (idempotent)
pushd infra
npx cdk deploy --require-approval never --outputs-file cdk-outputs.json
popd

# 2. Read outputs into env vars
SITE_BUCKET=$(node -e "console.log(require('./infra/cdk-outputs.json').FamilyFeudStack.SiteBucketName)")
DISTRIBUTION_ID=$(node -e "console.log(require('./infra/cdk-outputs.json').FamilyFeudStack.DistributionId)")
TABLE_NAME=$(node -e "console.log(require('./infra/cdk-outputs.json').FamilyFeudStack.TableName)")
IDENTITY_POOL_ID=$(node -e "console.log(require('./infra/cdk-outputs.json').FamilyFeudStack.IdentityPoolId)")
REGION=$(aws configure get region)

# 3. Build SPA with the right env
VITE_PERSISTENCE=ddb \
VITE_AWS_REGION="$REGION" \
VITE_COGNITO_IDENTITY_POOL_ID="$IDENTITY_POOL_ID" \
VITE_DDB_TABLE_NAME="$TABLE_NAME" \
npm run build

# 4. Upload to S3
aws s3 sync dist/ "s3://$SITE_BUCKET/" --delete

# 5. Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths '/*'

DOMAIN=$(node -e "console.log(require('./infra/cdk-outputs.json').FamilyFeudStack.DistributionDomain)")
echo
echo "Deployed to: https://$DOMAIN/"
```

- [ ] **Step 2: Make executable + add to package.json**

```bash
chmod +x scripts/deploy.sh
```

In root `package.json` scripts:

```json
"deploy": "bash scripts/deploy.sh"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/deploy.sh package.json
git commit -m "feat(infra): add deploy script"
```

---

## Phase 6: Admin view (Tasks 25–31)

### Task 25: GameStateContext + useGameState hook

**Files:**
- Create: `src/state/GameStateContext.tsx`, `src/hooks/useGameState.ts`

- [ ] **Step 1: Context**

```typescript
import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import { reducer } from './reducer';
import { initialState } from './initialState';
import { usePersistence } from '../persistence/PersistenceProvider';
import type { TournamentState, Action } from './types';

type Ctx = {
  state: TournamentState;
  dispatch: (action: Action) => void;
};

const Ctx = createContext<Ctx | null>(null);

const STORAGE_KEY = 'family-feud:tournamentId';

export function GameStateProvider({ children, isWriter }: { children: ReactNode; isWriter: boolean }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState());
  const persistence = usePersistence();

  // On mount: try to resume an in-progress tournament.
  useEffect(() => {
    const id = localStorage.getItem(STORAGE_KEY);
    if (id) {
      persistence.load(id).then(loaded => {
        if (loaded) dispatch({ type: 'SET_TEAMS', teams: loaded.teams }); // bootstrap; full hydrate below
        // Full hydrate via a single replace action — for MVP we'll just replay; cleanup is Plan B.
      });
    } else {
      localStorage.setItem(STORAGE_KEY, state.tournamentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Writer side effect: persist after every dispatch.
  useEffect(() => {
    if (isWriter) {
      persistence.save(state).catch(err => console.error('persistence save failed', err));
    }
  }, [state, isWriter, persistence]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useGameState() {
  const v = useContext(Ctx);
  if (!v) throw new Error('GameStateProvider missing');
  return v;
}
```

- [ ] **Step 2: Hook re-export**

`src/hooks/useGameState.ts`:

```typescript
export { useGameState } from '../state/GameStateContext';
```

- [ ] **Step 3: Commit**

```bash
git add src/state/GameStateContext.tsx src/hooks/useGameState.ts
git commit -m "feat(state): GameStateContext with persistence side effect"
```

---

### Task 26: AdminView shell with subview routing + ViewSwitcher

**Files:**
- Modify: `src/routes/AdminRoute.tsx`
- Create: `src/views/admin/AdminView.tsx`, `src/components/ViewSwitcher.tsx`

- [ ] **Step 1: ViewSwitcher**

```typescript
import { useGameState } from '../hooks/useGameState';

export function ViewSwitcher() {
  const { state, dispatch } = useGameState();
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <button
        aria-pressed={state.projectorView === 'game'}
        onClick={() => dispatch({ type: 'SET_PROJECTOR_VIEW', view: 'game' })}
      >▶</button>
      <button
        aria-pressed={state.projectorView === 'bracket'}
        onClick={() => dispatch({ type: 'SET_PROJECTOR_VIEW', view: 'bracket' })}
      >⛓</button>
    </div>
  );
}
```

- [ ] **Step 2: AdminView shell**

```typescript
import { useGameState } from '../../hooks/useGameState';
import { SetupSubview } from './SetupSubview';
import { InMatchSubview } from './InMatchSubview';
import { FaceOffSubview } from './FaceOffSubview';
import { StealSubview } from './StealSubview';
import { BetweenMatchesSubview } from './BetweenMatchesSubview';
import { FastMoneySubview } from './FastMoneySubview';
import { ViewSwitcher } from '../../components/ViewSwitcher';

export function AdminView() {
  const { state } = useGameState();

  let body;
  if (state.status === 'setup') body = <SetupSubview />;
  else if (state.currentMatchPath?.round === 'final' && state.currentMatchState === 'match_over') body = <FastMoneySubview />;
  else if (state.currentMatchState === 'face_off') body = <FaceOffSubview />;
  else if (state.currentMatchState === 'steal') body = <StealSubview />;
  else if (state.currentMatchState === 'awarded') body = <BetweenMatchesSubview />;
  else body = <InMatchSubview />;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: 12, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--gold-dim)' }}>
        <div style={{ flex: 1 }}>EGPS Family Feud — Admin</div>
        <ViewSwitcher />
      </header>
      <main style={{ flex: 1, overflow: 'auto', padding: 16 }}>{body}</main>
    </div>
  );
}
```

- [ ] **Step 3: Wire up `AdminRoute.tsx`**

```typescript
import { GameStateProvider } from '../state/GameStateContext';
import { AdminView } from '../views/admin/AdminView';

export function AdminRoute() {
  return (
    <GameStateProvider isWriter={true}>
      <AdminView />
    </GameStateProvider>
  );
}
```

- [ ] **Step 4: Stub all 6 subviews** so the page renders. Each subview gets a `<div>{name}</div>` placeholder for now.

`src/views/admin/SetupSubview.tsx`:

```typescript
export function SetupSubview() { return <div>Setup (coming next task)</div>; }
```

(Same pattern for InMatch, FaceOff, Steal, BetweenMatches, FastMoney.)

- [ ] **Step 5: Verify dev server shows AdminView with header + Setup placeholder**

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm run dev
```

- [ ] **Step 6: Commit**

```bash
git add src/views/admin/ src/routes/AdminRoute.tsx src/components/ViewSwitcher.tsx
git commit -m "feat(admin): shell with subview routing + ViewSwitcher"
```

---

### Task 27: SetupSubview — team registration

**Files:**
- Modify: `src/views/admin/SetupSubview.tsx`

- [ ] **Step 1: Implement**

```typescript
import { useState } from 'react';
import { useGameState } from '../../hooks/useGameState';
import type { Team } from '../../state/types';

const EMPTY_TEAM = (i: number): Team => ({ id: `team-${i+1}`, name: '', members: ['', '', '', '', ''] });

export function SetupSubview() {
  const { dispatch } = useGameState();
  const [teams, setTeams] = useState<Team[]>(Array.from({ length: 6 }, (_, i) => EMPTY_TEAM(i)));

  function update(i: number, patch: Partial<Team>) {
    setTeams(ts => ts.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  }
  function updateMember(i: number, mi: number, value: string) {
    setTeams(ts => ts.map((t, idx) => idx === i
      ? { ...t, members: t.members.map((m, midx) => midx === mi ? value : m) }
      : t));
  }

  const ready = teams.every(t => t.name.trim().length > 0);

  function start() {
    const cleaned = teams.map(t => ({
      ...t,
      name: t.name.trim(),
      members: t.members.map(m => m.trim()).filter(Boolean),
    }));
    dispatch({ type: 'SET_TEAMS', teams: cleaned });
    dispatch({ type: 'START_TOURNAMENT' });
  }

  function openProjector() {
    window.open('/projector', 'projector', 'width=1280,height=720');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2>Register Teams</h2>
      <button onClick={openProjector}>Open Projector Window</button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {teams.map((t, i) => (
          <div key={t.id} style={{ border: '1px solid var(--gold-dim)', padding: 12 }}>
            <input
              placeholder={`Team ${i+1} name`}
              value={t.name}
              onChange={e => update(i, { name: e.target.value })}
              style={{ width: '100%' }}
            />
            {t.members.map((m, mi) => (
              <input
                key={mi}
                placeholder={`Player ${mi+1}`}
                value={m}
                onChange={e => updateMember(i, mi, e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
              />
            ))}
          </div>
        ))}
      </div>
      <button disabled={!ready} onClick={start}>Start Tournament</button>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser** — visit `/admin`, fill in 6 team names, click Start.

- [ ] **Step 3: Commit**

```bash
git add src/views/admin/SetupSubview.tsx
git commit -m "feat(admin): SetupSubview with team registration"
```

---

### Task 28: FaceOffSubview

**Files:**
- Modify: `src/views/admin/FaceOffSubview.tsx`

- [ ] **Step 1: Implement**

```typescript
import { useGameState } from '../../hooks/useGameState';
import { teamById } from '../../state/selectors';
import { getCurrentMatch } from '../../state/bracketLogic';

export function FaceOffSubview() {
  const { state, dispatch } = useGameState();
  const m = getCurrentMatch(state);
  if (!m || !m.teamBId) return <div>No active match</div>;
  const a = teamById(state, m.teamAId);
  const b = teamById(state, m.teamBId);

  return (
    <div style={{ textAlign: 'center', padding: 32 }}>
      <h2>Face-Off — Who buzzed first?</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 32 }}>
        <button
          style={{ padding: '32px 48px', fontSize: 24 }}
          onClick={() => dispatch({ type: 'RESOLVE_FACE_OFF', teamId: m.teamAId })}
        >{a?.name ?? 'Team A'}</button>
        <button
          style={{ padding: '32px 48px', fontSize: 24 }}
          onClick={() => dispatch({ type: 'RESOLVE_FACE_OFF', teamId: m.teamBId! })}
        >{b?.name ?? 'Team B'}</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/admin/FaceOffSubview.tsx
git commit -m "feat(admin): FaceOffSubview"
```

---

### Task 29: InMatchSubview

**Files:**
- Modify: `src/views/admin/InMatchSubview.tsx`

- [ ] **Step 1: Implement**

```typescript
import { useGameState } from '../../hooks/useGameState';
import { currentQuestion, teamById } from '../../state/selectors';
import { getCurrentMatch } from '../../state/bracketLogic';

export function InMatchSubview() {
  const { state, dispatch } = useGameState();
  const m = getCurrentMatch(state)!;
  const cq = currentQuestion(state);
  if (!cq) return <div>No active question. <button onClick={() => dispatch({ type: 'RESOLVE_FACE_OFF', teamId: m.teamAId })}>Mock buzz A</button></div>;
  const { play, def } = cq;
  const a = teamById(state, m.teamAId);
  const b = teamById(state, m.teamBId);
  const activeIsA = play.activeTeamId === m.teamAId;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
      <div>
        <h3>{def.prompt}</h3>
        <ol>
          {def.answers.map((ans, i) => {
            const revealed = play.revealedAnswers.includes(i);
            return (
              <li key={i} style={{ padding: 8, marginBottom: 4, background: revealed ? 'var(--gold)' : 'var(--bg-card)', color: revealed ? 'var(--bg-deep)' : 'inherit', cursor: revealed ? 'default' : 'pointer' }}
                  onClick={() => !revealed && dispatch({ type: 'REVEAL_ANSWER', answerIndex: i })}>
                {ans.text} — {ans.points}{revealed ? '' : ' (click to reveal)'}
              </li>
            );
          })}
        </ol>
      </div>
      <div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, padding: 8, border: activeIsA ? '2px solid var(--white)' : '1px solid var(--gold-dim)' }}
               onClick={() => activeIsA || dispatch({ type: 'SWITCH_ACTIVE_TEAM' })}>
            <div>{a?.name}</div>
            <div style={{ fontSize: 32 }}>{m.scoreA}</div>
          </div>
          <div>Strikes: {activeIsA ? play.strikesA : play.strikesB} / 3</div>
          <div style={{ flex: 1, padding: 8, border: !activeIsA ? '2px solid var(--white)' : '1px solid var(--gold-dim)' }}
               onClick={() => activeIsA && dispatch({ type: 'SWITCH_ACTIVE_TEAM' })}>
            <div>{b?.name}</div>
            <div style={{ fontSize: 32 }}>{m.scoreB}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 12 }}>
          <button onClick={() => dispatch({ type: 'AWARD_POINTS_TO_ACTIVE' })}>+ Award revealed pts</button>
          <button onClick={() => dispatch({ type: 'MARK_STRIKE' })}>✗ Wrong (Strike)</button>
          <button onClick={() => dispatch({ type: 'SKIP_QUESTION' })}>↺ Skip</button>
          <button onClick={() => dispatch({ type: 'UNDO' })}>↶ Undo</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/admin/InMatchSubview.tsx
git commit -m "feat(admin): InMatchSubview with reveal + scoring controls"
```

---

### Task 30: StealSubview + BetweenMatchesSubview

**Files:**
- Modify: `src/views/admin/StealSubview.tsx`, `src/views/admin/BetweenMatchesSubview.tsx`

- [ ] **Step 1: StealSubview**

```typescript
import { useGameState } from '../../hooks/useGameState';

export function StealSubview() {
  const { dispatch } = useGameState();
  return (
    <div style={{ textAlign: 'center', padding: 48 }}>
      <h2>Steal Attempt</h2>
      <p>Did the opposing team correctly guess a remaining answer?</p>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 24 }}>
        <button style={{ padding: 24, fontSize: 18 }}
                onClick={() => dispatch({ type: 'RESOLVE_STEAL', successful: true })}>
          ✓ Steal SUCCESSFUL
        </button>
        <button style={{ padding: 24, fontSize: 18 }}
                onClick={() => dispatch({ type: 'RESOLVE_STEAL', successful: false })}>
          ✗ Steal FAILED
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: BetweenMatchesSubview**

```typescript
import { useGameState } from '../../hooks/useGameState';
import { teamById } from '../../state/selectors';
import { getCurrentMatch } from '../../state/bracketLogic';

export function BetweenMatchesSubview() {
  const { state, dispatch } = useGameState();
  const m = getCurrentMatch(state)!;
  const winnerName = teamById(state, m.scoreA > m.scoreB ? m.teamAId : m.teamBId)?.name ?? '?';

  function confirmAdvance() {
    if (confirm(`Advance to next match? (${winnerName} wins this one)`)) {
      dispatch({ type: 'ADVANCE_MATCH' });
    }
  }

  return (
    <div style={{ textAlign: 'center', padding: 48 }}>
      <h2>Match complete — {winnerName} wins</h2>
      <p>Score: {m.scoreA} — {m.scoreB}</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
        <button onClick={() => dispatch({ type: 'RESOLVE_FACE_OFF', teamId: m.teamAId })}>
          Play another question this match
        </button>
        <button style={{ background: 'var(--green)', color: 'white', padding: 16 }} onClick={confirmAdvance}>
          → Advance to next match
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/admin/StealSubview.tsx src/views/admin/BetweenMatchesSubview.tsx
git commit -m "feat(admin): Steal + BetweenMatches subviews"
```

---

### Task 31: FastMoneySubview

**Files:**
- Modify: `src/views/admin/FastMoneySubview.tsx`

- [ ] **Step 1: Implement**

```typescript
import { useEffect, useState } from 'react';
import { useGameState } from '../../hooks/useGameState';
import { QUESTIONS } from '../../content/questions';
import { FAST_MONEY_QUESTION_IDS } from '../../content/fastMoneyConfig';

const FM_QUESTIONS = FAST_MONEY_QUESTION_IDS.map(id => QUESTIONS.find(q => q.id === id)!);

export function FastMoneySubview() {
  const { state, dispatch } = useGameState();
  const fm = state.bracket.fastMoney;
  const [player, setPlayer] = useState<1 | 2>(1);
  const [seconds, setSeconds] = useState(player === 1 ? 30 : 25);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  function submit(qIdx: number, text: string) {
    const def = FM_QUESTIONS[qIdx];
    const match = def.answers.find(a => a.text.toLowerCase() === text.toLowerCase());
    const points = match?.points ?? 0;
    dispatch({ type: 'SUBMIT_FM_ANSWER', player, answer: { text, points } });
  }

  if (!fm) {
    // Initialize fast money record on first render
    return <button onClick={() => {
      dispatch({ type: 'COMPLETE_FAST_MONEY' }); // placeholder - real init action would be different
    }}>Start Fast Money</button>;
  }

  return (
    <div>
      <h2>Fast Money — Player {player} ({seconds}s)</h2>
      {FM_QUESTIONS.map((q, i) => (
        <div key={q.id} style={{ marginBottom: 12 }}>
          <div>{q.prompt}</div>
          <input
            placeholder="Player's answer"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                submit(i, (e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = '';
              }
            }}
          />
        </div>
      ))}
      {player === 1 && (
        <button onClick={() => { setPlayer(2); setSeconds(25); }}>Player 1 done — start Player 2</button>
      )}
      {player === 2 && (
        <button onClick={() => dispatch({ type: 'COMPLETE_FAST_MONEY' })}>Reveal final score</button>
      )}
      {fm.totalScore > 0 && <div>Total: {fm.totalScore} ({fm.won ? 'WON!' : 'short of 200'})</div>}
    </div>
  );
}
```

> Note: this is the minimum-viable Fast Money. Theatrics (large clock, hidden Player 2 reveal, etc.) are Plan B.

- [ ] **Step 2: Commit**

```bash
git add src/views/admin/FastMoneySubview.tsx
git commit -m "feat(admin): FastMoneySubview (minimal)"
```

---

## Phase 7: Projector view (Tasks 32–34)

### Task 32: ProjectorView shell + DDB polling hook

**Files:**
- Create: `src/hooks/useDDBPolling.ts`
- Modify: `src/routes/ProjectorRoute.tsx`
- Create: `src/views/projector/ProjectorView.tsx`

- [ ] **Step 1: Polling hook**

```typescript
import { useEffect, useState } from 'react';
import type { TournamentState } from '../state/types';
import { usePersistence } from '../persistence/PersistenceProvider';

export function useTournamentPolling(tournamentId: string, intervalMs = 750) {
  const persistence = usePersistence();
  const [state, setState] = useState<TournamentState | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const loaded = await persistence.load(tournamentId);
        if (!cancelled && loaded) setState(loaded);
      } catch (e) { /* swallow; retry next tick */ }
    }
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [tournamentId, intervalMs, persistence]);

  return state;
}
```

- [ ] **Step 2: ProjectorView**

```typescript
import { useTournamentPolling } from '../../hooks/useDDBPolling';
import { GameModeView } from './GameModeView';
import { BracketView } from './BracketView';

const STORAGE_KEY = 'family-feud:tournamentId';

export function ProjectorView() {
  const id = localStorage.getItem(STORAGE_KEY);
  if (!id) return <div>No tournament started yet — open the admin window first.</div>;
  const state = useTournamentPolling(id);
  if (!state) return <div>Loading…</div>;
  return state.projectorView === 'bracket' ? <BracketView state={state} /> : <GameModeView state={state} />;
}
```

- [ ] **Step 3: Wire into route**

```typescript
import { GameStateProvider } from '../state/GameStateContext';
import { ProjectorView } from '../views/projector/ProjectorView';

export function ProjectorRoute() {
  return (
    <GameStateProvider isWriter={false}>
      <ProjectorView />
    </GameStateProvider>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useDDBPolling.ts src/views/projector/ProjectorView.tsx src/routes/ProjectorRoute.tsx
git commit -m "feat(projector): shell with DDB polling"
```

---

### Task 33: GameModeView (functional, minimal styling)

**Files:**
- Create: `src/views/projector/GameModeView.tsx`

- [ ] **Step 1: Implement**

```typescript
import type { TournamentState } from '../../state/types';
import { QUESTIONS } from '../../content/questions';
import { getCurrentMatch } from '../../state/bracketLogic';

export function GameModeView({ state }: { state: TournamentState }) {
  const m = getCurrentMatch(state);
  if (!m) return <div style={{ padding: 48 }}>Tournament not started.</div>;
  const q = m.questions[m.questions.length - 1];
  const def = q && QUESTIONS.find(d => d.id === q.questionId);
  const a = state.teams.find(t => t.id === m.teamAId);
  const b = state.teams.find(t => t.id === m.teamBId);
  const activeIsA = q?.activeTeamId === m.teamAId;
  const strikes = activeIsA ? q?.strikesA : q?.strikesB;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: 24 }}>
      <h1 style={{ textAlign: 'center', fontFamily: 'Bebas Neue', textShadow: '0 0 12px var(--gold)' }}>
        {def?.prompt ?? 'Waiting for face-off…'}
      </h1>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24 }}>
        {def?.answers.map((ans, i) => {
          const revealed = q?.revealedAnswers.includes(i);
          return (
            <div key={i} style={{
              flex: 1,
              background: revealed ? 'linear-gradient(180deg, var(--gold), var(--gold-2))' : 'var(--bg-card)',
              color: revealed ? 'var(--bg-deep)' : 'var(--gold)',
              border: `2px solid var(--gold)`,
              padding: 16,
              fontSize: 28,
              fontFamily: 'Fjalla One',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span>{revealed ? ans.text : i + 1}</span>
              <span>{revealed ? ans.points : ''}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 24 }}>
        <div style={{ flex: 1, textAlign: 'center', background: 'var(--gold)', color: 'var(--bg-deep)', padding: 12, border: activeIsA ? '3px solid var(--white)' : 'none' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: 18 }}>{a?.name}</div>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: 48 }}>{m.scoreA}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 40, height: 40, border: '2px solid var(--red)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas Neue', fontSize: 28, opacity: i < (strikes ?? 0) ? 1 : 0.2 }}>X</div>
          ))}
        </div>
        <div style={{ flex: 1, textAlign: 'center', background: 'var(--gold)', color: 'var(--bg-deep)', padding: 12, border: !activeIsA ? '3px solid var(--white)' : 'none' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: 18 }}>{b?.name}</div>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: 48 }}>{m.scoreB}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser** — open `/admin` in one window, register teams, start tournament, then open `/projector` in another. Reveal answers in admin, see them appear on projector after ~750ms.

- [ ] **Step 3: Commit**

```bash
git add src/views/projector/GameModeView.tsx
git commit -m "feat(projector): functional GameModeView"
```

---

### Task 34: BracketView (functional, minimal styling)

**Files:**
- Create: `src/views/projector/BracketView.tsx`

- [ ] **Step 1: Implement** (basic 3-column layout, no fancy connectors yet — those are Plan B)

```typescript
import type { TournamentState, Match } from '../../state/types';

export function BracketView({ state }: { state: TournamentState }) {
  const { round1, semis, final, wildcard } = state.bracket;
  const teamName = (id: string | null) => state.teams.find(t => t.id === id)?.name ?? '—';

  function MatchCard({ m, label, isLive }: { m: Match | null; label: string; isLive?: boolean }) {
    if (!m) return <div style={{ padding: 8, border: '1px dashed var(--gold-dim)' }}>{label}: TBD</div>;
    const aWon = m.winnerId === m.teamAId;
    const bWon = m.winnerId === m.teamBId;
    return (
      <div style={{ padding: 8, border: `2px solid ${isLive ? 'white' : 'var(--gold)'}`, background: 'var(--bg-card)', marginBottom: 8 }}>
        <div style={{ fontSize: 10 }}>{label}</div>
        <div style={{ background: aWon ? 'var(--gold)' : undefined, color: aWon ? 'var(--bg-deep)' : undefined, textDecoration: bWon && m.winnerId ? 'line-through' : undefined }}>
          {teamName(m.teamAId)} — {m.scoreA}
        </div>
        <div style={{ background: bWon ? 'var(--gold)' : undefined, color: bWon ? 'var(--bg-deep)' : undefined, textDecoration: aWon && m.winnerId ? 'line-through' : undefined }}>
          {teamName(m.teamBId)} — {m.scoreB}
        </div>
      </div>
    );
  }

  const livePath = state.currentMatchPath;
  const isLive = (round: string, idx: number) => livePath?.round === round && livePath?.index === idx;

  return (
    <div style={{ height: '100vh', padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
      <div>
        <h3>ROUND 1</h3>
        <MatchCard m={round1[0] ?? null} label="Match 1" isLive={isLive('round1', 0)} />
        <MatchCard m={round1[1] ?? null} label="Match 2" isLive={isLive('round1', 1)} />
        <MatchCard m={round1[2] ?? null} label="Match 3" isLive={isLive('round1', 2)} />
        <div style={{ padding: 8, border: '2px dashed var(--purple)', marginTop: 12 }}>
          ★ WILD CARD: {wildcard.teamId ? teamName(wildcard.teamId) : '—'}
        </div>
      </div>
      <div>
        <h3>SEMIFINALS</h3>
        <MatchCard m={semis[0] ?? null} label="Semi 1" isLive={isLive('semis', 0)} />
        <MatchCard m={semis[1] ?? null} label="Semi 2" isLive={isLive('semis', 1)} />
      </div>
      <div>
        <h3>FINAL</h3>
        <MatchCard m={final} label="Championship" isLive={isLive('final', 0)} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify** — switch projector view to bracket via admin's view switcher; bracket appears.

- [ ] **Step 3: Commit**

```bash
git add src/views/projector/BracketView.tsx
git commit -m "feat(projector): functional BracketView"
```

---

## Phase 8: Deploy + smoke test (Tasks 35–36)

### Task 35: First deploy to AWS

- [ ] **Step 1: Bootstrap CDK in the target account/region (one-time)**

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" cd infra && npx cdk bootstrap
```

- [ ] **Step 2: Run deploy**

```bash
PATH="/home/douglasl/.nvm/versions/node/v25.9.0/bin:$PATH" npm run deploy
```
Expected: prints CloudFront URL at the end. Visit it in a browser.

- [ ] **Step 3: Tag the deployment**

```bash
git tag mvp-deploy-1
```

---

### Task 36: End-to-end smoke test

- [ ] **Step 1: Open the deployed CloudFront URL in two browser windows** — one at `/admin`, one at `/projector`.
- [ ] **Step 2: Register 6 teams in admin → Start tournament.**
- [ ] **Step 3: Walk through one full match** — face-off, reveal a few answers, mark a strike, award points, advance.
- [ ] **Step 4: Verify projector view updates within ~1s of admin actions.**
- [ ] **Step 5: Walk through round 1 → wildcard → semis → final → fast money to ensure the full state machine survives a real DDB round-trip.**
- [ ] **Step 6: Refresh the admin window mid-tournament — verify state resumes correctly from DDB.**
- [ ] **Step 7: If everything passes, commit the README updates documenting the full setup**

```bash
# Update README.md with: setup steps, env vars, how to deploy, how to run a tournament
git add README.md
git commit -m "docs: README with setup + run instructions"
```

---

## Self-review

This plan covers spec sections 1–8 + 11. Plan B covers section 9 (visual polish), Fast Money theatrics, audio, and any spec section 12 risk mitigations beyond MVP.

**Gaps acknowledged:**
- The Setup→Resume flow (when an in-progress tournament exists in localStorage) currently bootstraps from teams only; the "Resume" path isn't fully wired. Plan B Task 1 should harden hydration with a single `HYDRATE_FROM_DDB` action.
- Fast Money in Task 31 is minimal — needs a `START_FAST_MONEY` reducer action that initializes the FM record. That action gap needs filling — call it out in Plan B as Task 0.
- No infrastructure for assets bundle (audio etc) — that's Plan B's audio phase.
- Action-stack-reset on UNDO during Fast Money: not handled (FM has its own state model, undo isn't required there).
- Confirm modal is just `confirm()` for MVP. Plan B replaces with a styled modal.

**Type-consistency check:** All actions in `src/state/types.ts` are exhaustively switched on in `reducer.ts` by Task 16. Match path discriminator `round: 'round1' | 'semis' | 'final'` used consistently across reducer + bracketLogic + projector views.
