import { useTournamentPolling } from '../../hooks/useDDBPolling';
import { useSfx } from '../../audio/useSfx';
import { isFastMoneyPhase } from '../../state/selectors';
import { GameModeView } from './GameModeView';
import { BracketView } from './BracketView';
import { FastMoneyView } from './FastMoneyView';
import { ProjectorSplash } from './ProjectorSplash';

const STORAGE_KEY = 'family-feud:tournamentId';

function ProjectorContent({ id }: { id: string }) {
  const state = useTournamentPolling(id);
  if (!state) return <div style={{ padding: 48 }}>Loading…</div>;

  if (isFastMoneyPhase(state)) {
    return <FastMoneyView state={state} />;
  }

  return state.projectorView === 'bracket' ? <BracketView state={state} /> : <GameModeView state={state} />;
}

export function ProjectorView() {
  const { unlocked } = useSfx();
  const id = localStorage.getItem(STORAGE_KEY);

  if (!unlocked) return <ProjectorSplash />;
  if (!id) return <div style={{ padding: 48 }}>No tournament started yet — open the admin window first.</div>;
  return <ProjectorContent id={id} />;
}
