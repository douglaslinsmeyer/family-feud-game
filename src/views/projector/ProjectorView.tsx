import { useTournamentPolling } from '../../hooks/useDDBPolling';
import { GameModeView } from './GameModeView';
import { BracketView } from './BracketView';

const STORAGE_KEY = 'family-feud:tournamentId';

function ProjectorContent({ id }: { id: string }) {
  const state = useTournamentPolling(id);
  if (!state) return <div style={{ padding: 48 }}>Loading…</div>;
  return state.projectorView === 'bracket' ? <BracketView state={state} /> : <GameModeView state={state} />;
}

export function ProjectorView() {
  const id = localStorage.getItem(STORAGE_KEY);
  if (!id) return <div style={{ padding: 48 }}>No tournament started yet — open the admin window first.</div>;
  return <ProjectorContent id={id} />;
}
