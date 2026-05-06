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
