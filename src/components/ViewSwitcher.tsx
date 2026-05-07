import { Tv, Trophy } from 'lucide-react';
import { useGameState } from '../hooks/useGameState';

export function ViewSwitcher() {
  const { state, dispatch } = useGameState();
  return (
    <div className="adm-glyphs">
      <button
        className="adm-glyph"
        aria-pressed={state.projectorView === 'game'}
        title="Game mode (G)"
        onClick={() => dispatch({ type: 'SET_PROJECTOR_VIEW', view: 'game' })}
      >
        <Tv size={16} />
      </button>
      <button
        className="adm-glyph"
        aria-pressed={state.projectorView === 'bracket'}
        title="Bracket (B)"
        onClick={() => dispatch({ type: 'SET_PROJECTOR_VIEW', view: 'bracket' })}
      >
        <Trophy size={16} />
      </button>
    </div>
  );
}
